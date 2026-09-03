// MiseOn — Cliente do Web Service NFS-e da Prefeitura de São Paulo (LoteNFe)
//
// Integração DIRETA e GRATUITA com o sistema municipal de SP
// (https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx), sem gateway pago.
// Especificação: Manual de Utilização do Web Service v2.1 (nfe.prefeitura.sp.gov.br/arquivos/nfews.pdf).
//
// Por que este caminho e não o Emissor Nacional (nfse.gov.br): testado ao vivo em
// 03/09/2026 — a inscrição municipal desta empresa ainda não está habilitada no
// ambiente nacional (nem no de testes), porque São Paulo só entra na obrigatoriedade
// do Emissor Nacional em 01/11/2026. Até lá, o sistema próprio da prefeitura é o
// único que funciona de verdade.
//
// Duas assinaturas digitais distintas são exigidas pelo protocolo:
// 1) Assinatura do RPS (tag <Assinatura> dentro de cada RPS): RSA-SHA1 sobre uma
//    string ASCII de 86 posições com os dados do RPS (item 4.3.2 do manual).
// 2) Assinatura XML da mensagem inteira (ds:Signature, enveloped): sobre o elemento
//    raiz <PedidoEnvioLoteRPS>, padrão XMLDSig com C14N (item 3.2.3 do manual).

import forge from 'npm:node-forge@1.3.1';
import { SignedXml } from 'npm:xml-crypto@6.0.1';

export interface CertificadoDecodificado {
  privateKeyPem: string;
  certPem: string;
  certDerBase64: string;
}

/** Extrai a chave privada e o certificado de um .pfx (PKCS#12) em base64. */
export function decodificarPfx(pfxBase64: string, senha: string): CertificadoDecodificado {
  const der = forge.util.decode64(pfxBase64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  if (!keyBags?.length || !certBags?.length) {
    throw new Error('Certificado .pfx sem chave privada ou certificado (senha incorreta?)');
  }

  const privateKey = keyBags[0].key;
  const cert = certBags[0].cert;
  if (!privateKey || !cert) throw new Error('Falha ao decodificar chave/certificado do .pfx');

  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
  const certPem = forge.pki.certificateToPem(cert);
  const certDerBase64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());

  return { privateKeyPem, certPem, certDerBase64 };
}

function pad(value: string | number, size: number, char = '0', left = true): string {
  const s = String(value);
  if (s.length >= size) return s.slice(0, size);
  const fill = char.repeat(size - s.length);
  return left ? fill + s : s + fill;
}

function centavos(valor: number): string {
  return pad(Math.round(valor * 100), 15);
}

export interface DadosRps {
  inscricaoMunicipalPrestador: string;
  serieRps: string;
  numeroRps: number;
  dataEmissao: string; // AAAA-MM-DD
  tributacao: 'T' | 'F' | 'I' | 'J';
  status: 'N' | 'C' | 'E';
  issRetido: boolean;
  valorServicos: number;
  valorDeducoes: number;
  codigoServico: string;
  aliquotaServicos: number;
  cpfCnpjTomador: string;
  razaoSocialTomador: string;
  emailTomador?: string;
  discriminacao: string;
}

function cadeiaAssinaturaRps(d: DadosRps): string {
  const dataCompacta = d.dataEmissao.replace(/-/g, '');
  const cpfCnpjDigits = d.cpfCnpjTomador.replace(/\D/g, '');
  const indicador = cpfCnpjDigits.length === 14 ? '2' : '1';
  return [
    pad(d.inscricaoMunicipalPrestador.replace(/\D/g, ''), 8),
    pad(d.serieRps, 5, ' ', false),
    pad(d.numeroRps, 12),
    pad(dataCompacta, 8),
    d.tributacao,
    d.status,
    d.issRetido ? 'S' : 'N',
    centavos(d.valorServicos),
    centavos(d.valorDeducoes),
    pad(d.codigoServico, 5),
    indicador,
    pad(cpfCnpjDigits, 14),
  ].join('');
}

function assinarHashRsaSha1(cadeia: string, privateKeyPem: string): string {
  const md = forge.md.sha1.create();
  md.update(cadeia, 'utf8');
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const signature = privateKey.sign(md);
  return forge.util.encode64(signature);
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Monta o XML do RPS (tpRPS) já com a assinatura interna do RPS. */
export function montarXmlRps(d: DadosRps, privateKeyPem: string): string {
  const cadeia = cadeiaAssinaturaRps(d);
  const assinatura = assinarHashRsaSha1(cadeia, privateKeyPem);
  const cpfCnpjDigits = d.cpfCnpjTomador.replace(/\D/g, '');
  const ehCnpj = cpfCnpjDigits.length === 14;
  const discriminacaoSanitizada = escapeXml(
    d.discriminacao.replace(/\r\n|\n|\r/g, '|').slice(0, 2000)
  );

  return (
    `<RPS>` +
    `<Assinatura>${assinatura}</Assinatura>` +
    `<ChaveRPS>` +
    `<InscricaoPrestador>${pad(d.inscricaoMunicipalPrestador.replace(/\D/g, ''), 8)}</InscricaoPrestador>` +
    `<SerieRPS>${escapeXml(d.serieRps.trim())}</SerieRPS>` +
    `<NumeroRPS>${d.numeroRps}</NumeroRPS>` +
    `</ChaveRPS>` +
    `<TipoRPS>RPS</TipoRPS>` +
    `<DataEmissao>${d.dataEmissao}</DataEmissao>` +
    `<StatusRPS>${d.status}</StatusRPS>` +
    `<TributacaoRPS>${d.tributacao}</TributacaoRPS>` +
    `<ValorServicos>${d.valorServicos.toFixed(2)}</ValorServicos>` +
    `<ValorDeducoes>${d.valorDeducoes.toFixed(2)}</ValorDeducoes>` +
    `<CodigoServico>${pad(d.codigoServico, 5)}</CodigoServico>` +
    `<AliquotaServicos>${d.aliquotaServicos}</AliquotaServicos>` +
    `<ISSRetido>${d.issRetido ? 'true' : 'false'}</ISSRetido>` +
    `<CPFCNPJTomador>${ehCnpj ? `<CNPJ>${cpfCnpjDigits}</CNPJ>` : `<CPF>${cpfCnpjDigits}</CPF>`}</CPFCNPJTomador>` +
    `<RazaoSocialTomador>${escapeXml(d.razaoSocialTomador)}</RazaoSocialTomador>` +
    (d.emailTomador ? `<EmailTomador>${escapeXml(d.emailTomador)}</EmailTomador>` : '') +
    `<Discriminacao>${discriminacaoSanitizada}</Discriminacao>` +
    `</RPS>`
  );
}

export interface DadosLote {
  cnpjRemetente: string;
  dataInicio: string; // AAAA-MM-DD
  dataFim: string;
  rpsXmlList: string[]; // já montados via montarXmlRps
  valorTotalServicos: number;
  valorTotalDeducoes: number;
}

/** Monta e assina (XMLDSig enveloped) o PedidoEnvioLoteRPS completo. */
export function montarELoteAssinado(lote: DadosLote, cert: CertificadoDecodificado): string {
  const cnpjDigits = lote.cnpjRemetente.replace(/\D/g, '');
  const semAssinatura =
    `<PedidoEnvioLoteRPS xmlns="http://www.prefeitura.sp.gov.br/nfe">` +
    `<Cabecalho Versao="1">` +
    `<CPFCNPJRemetente><CNPJ>${cnpjDigits}</CNPJ></CPFCNPJRemetente>` +
    `<transacao>true</transacao>` +
    `<dtInicio>${lote.dataInicio}</dtInicio>` +
    `<dtFim>${lote.dataFim}</dtFim>` +
    `<QtdRPS>${lote.rpsXmlList.length}</QtdRPS>` +
    `<ValorTotalServicos>${lote.valorTotalServicos.toFixed(2)}</ValorTotalServicos>` +
    `<ValorTotalDeducoes>${lote.valorTotalDeducoes.toFixed(2)}</ValorTotalDeducoes>` +
    `</Cabecalho>` +
    lote.rpsXmlList.join('') +
    `</PedidoEnvioLoteRPS>`;

  const sig = new SignedXml({
    privateKey: cert.privateKeyPem,
    publicCert: cert.certPem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });
  sig.addReference({
    xpath: "//*[local-name(.)='PedidoEnvioLoteRPS']",
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
  });
  sig.keyInfoProvider = {
    getKeyInfo: () => `<X509Data><X509Certificate>${cert.certDerBase64}</X509Certificate></X509Data>`,
    getKey: () => new TextEncoder().encode(cert.privateKeyPem),
  };
  sig.computeSignature(semAssinatura);
  return sig.getSignedXml();
}

export interface RetornoEnvioLote {
  sucesso: boolean;
  numeroNFe?: string;
  codigoVerificacao?: string;
  inscricaoPrestador?: string;
  erros: { codigo: string; descricao: string }[];
  alertas: { codigo: string; descricao: string }[];
  xmlBruto: string;
}

/** Chama TesteEnvioLoteRPS (não gera NF-e, só valida) ou EnvioLoteRPS (gera de verdade). */
export async function enviarLoteRps(
  mensagemXmlAssinada: string,
  opts: { producao: boolean; certPem: string; privateKeyPem: string },
): Promise<RetornoEnvioLote> {
  // SOAPActions corretos conforme WSDL em /ws/lotenfe.asmx?WSDL
  const metodo = opts.producao ? 'EnvioLoteRPS' : 'TesteEnvioLoteRPS';
  const soapAction = opts.producao
    ? 'http://www.prefeitura.sp.gov.br/nfe/ws/envioLoteRPS'
    : 'http://www.prefeitura.sp.gov.br/nfe/ws/testeenvio';
  const envelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body>` +
    `<${metodo}Request xmlns="http://www.prefeitura.sp.gov.br/nfe">` +
    `<VersaoSchema>1</VersaoSchema>` +
    `<MensagemXML>${escapeXml(mensagemXmlAssinada)}</MensagemXML>` +
    `</${metodo}Request>` +
    `</soap:Body>` +
    `</soap:Envelope>`;

  // Usa Deno.createHttpClient para habilitar mTLS (autenticação mútua exigida pela Prefeitura)
  const client = typeof Deno !== 'undefined' && Deno.createHttpClient
    ? Deno.createHttpClient({ caCerts: [], certChain: opts.certPem, privateKey: opts.privateKeyPem })
    : undefined;

  const res = await fetch('https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${soapAction}"`,
    },
    body: envelope,
    client, // Injeta o client com os certificados no Deno fetch
  });
  const bodyText = await res.text();
  if (!res.ok) {
    return { sucesso: false, erros: [{ codigo: String(res.status), descricao: bodyText.slice(0, 2000) }], alertas: [], xmlBruto: bodyText };
  }

  const retornoMatch = bodyText.match(/<RetornoXML>([\s\S]*?)<\/RetornoXML>/);
  const retornoXmlEscapado = retornoMatch?.[1] ?? '';
  const retornoXml = retornoXmlEscapado
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

  const sucesso = /<Sucesso>true<\/Sucesso>/i.test(retornoXml);
  const erros = [...retornoXml.matchAll(/<Erro>[\s\S]*?<Codigo>(\d+)<\/Codigo>(?:[\s\S]*?<Descricao>([^<]*)<\/Descricao>)?[\s\S]*?<\/Erro>/g)]
    .map((m) => ({ codigo: m[1], descricao: m[2] ?? '' }));
  const alertas = [...retornoXml.matchAll(/<Alerta>[\s\S]*?<Codigo>(\d+)<\/Codigo>(?:[\s\S]*?<Descricao>([^<]*)<\/Descricao>)?[\s\S]*?<\/Alerta>/g)]
    .map((m) => ({ codigo: m[1], descricao: m[2] ?? '' }));
  const numeroNFe = retornoXml.match(/<ChaveNFe>[\s\S]*?<Numero>(\d+)<\/Numero>/)?.[1];
  const codigoVerificacao = retornoXml.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/)?.[1];
  const inscricaoPrestador = retornoXml.match(/<InscricaoPrestador>(\d+)<\/InscricaoPrestador>/)?.[1];

  return { sucesso, numeroNFe, codigoVerificacao, inscricaoPrestador, erros, alertas, xmlBruto: retornoXml };
}
