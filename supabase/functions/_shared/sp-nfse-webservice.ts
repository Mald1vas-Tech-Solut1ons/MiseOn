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
    // xmlns="" : o schema não declara elementFormDefault="qualified", então
    // elementos locais (RPS, e tudo dentro dele) devem ficar SEM namespace —
    // só o elemento raiz PedidoEnvioLoteRPS fica no target namespace. Sem
    // isso o XML herda o namespace do pai e o webservice rejeita com uma
    // mensagem confusa (nome do elemento certo, namespace errado).
    `<RPS xmlns="">` +
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
    // xmlns="" pelo mesmo motivo do RPS (ver montarXmlRps): elemento local,
    // sem elementFormDefault="qualified" no schema, fica sem namespace.
    // Confirmado com erro real do webservice depois dessa correção: o nome
    // do elemento é CPFCNPJRemetente (a tabela descritiva do manual usa
    // "CNPJRemetente" como texto, não é o nome real do elemento XML).
    `<Cabecalho xmlns="" Versao="1">` +
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
    // Sem isso, xml-crypto adiciona `Id="_0"` ao elemento raiz para poder
    // referenciá-lo (`Reference URI="#_0"`) — o schema da Prefeitura de SP
    // não declara esse atributo em PedidoEnvioLoteRPS e rejeita a mensagem
    // ("XML não compatível com Schema. The 'Id' attribute is not declared."),
    // confirmado em teste real em producao. `isEmptyUri` usa `Reference URI=""`
    // (referência ao documento inteiro, XMLDSig padrão), sem tocar no elemento.
    isEmptyUri: true,
  });
  // `keyInfoProvider` foi removido em 09/09: era a API de uma versão antiga do
  // xml-crypto, não existe na v6 instalada — a propriedade era ignorada e não
  // fazia nada. A v6 já monta o <X509Data> automaticamente a partir de
  // `publicCert` (passado no construtor acima), confirmado com teste local:
  // o certificado aparece no <KeyInfo> do XML final sem precisar desta linha.
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

/**
 * Chama TesteEnvioLoteRPS (não gera NF-e, só valida) ou EnvioLoteRPS (gera de
 * verdade) — via o proxy `api/fiscal-proxy-nfse` na Vercel (região gru1, São
 * Paulo), não diretamente daqui.
 *
 * POR QUÊ: confirmado em teste real em 09/09 que a Prefeitura de SP reseta a
 * conexão mTLS ("Connection reset by peer") quando a origem é uma Supabase
 * Edge Function — a mesma chamada, com o mesmo certificado, completa o
 * handshake normalmente quando a origem é um IP brasileiro comum. Corrigido
 * o bug de nomes de campo do Deno.createHttpClient (`cert`/`key`, não
 * `certChain`/`privateKey`) antes de descobrir isso — não foi o problema
 * inteiro, só parte dele. A chave privada continua nunca saindo do Supabase
 * em claro: viaja para o proxy dentro de uma chamada HTTPS autenticada por
 * token (FISCAL_PROXY_TOKEN), igual nos dois lados.
 */
export async function enviarLoteRps(
  mensagemXmlAssinada: string,
  opts: { producao: boolean; certPem: string; privateKeyPem: string },
): Promise<RetornoEnvioLote> {
  const proxyUrl = Deno.env.get('FISCAL_PROXY_URL');
  const proxyToken = Deno.env.get('FISCAL_PROXY_TOKEN');
  if (!proxyUrl || !proxyToken) {
    throw new Error('FISCAL_PROXY_URL/FISCAL_PROXY_TOKEN não configurados — emissão real exige o proxy Vercel (ver sp-nfse-webservice.ts).');
  }

  const proxyRes = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-fiscal-proxy-token': proxyToken },
    body: JSON.stringify({
      mensagemXmlAssinada,
      producao: opts.producao,
      certPem: opts.certPem,
      keyPem: opts.privateKeyPem,
    }),
  });
  const proxyJson = await proxyRes.json().catch(() => ({}));
  if (!proxyRes.ok) {
    const msg = proxyJson?.error ?? `Proxy fiscal respondeu HTTP ${proxyRes.status}`;
    return { sucesso: false, erros: [{ codigo: String(proxyRes.status), descricao: String(msg).slice(0, 2000) }], alertas: [], xmlBruto: '' };
  }
  const { status, bodyText } = proxyJson as { status: number; bodyText: string };
  if (status < 200 || status >= 300) {
    return { sucesso: false, erros: [{ codigo: String(status), descricao: bodyText.slice(0, 2000) }], alertas: [], xmlBruto: bodyText };
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
  // Confirmado com emissão real em producao (09/09): o campo é <NumeroNFe>
  // direto dentro de <ChaveNFe>, não <Numero> como eu tinha assumido sem
  // testar contra o webservice de verdade — isso fazia toda emissão bem
  // sucedida (sucesso=true, NF-e real gerada) ficar marcada como "erro" no
  // banco por falta desse número.
  const numeroNFe = retornoXml.match(/<ChaveNFe>[\s\S]*?<NumeroNFe>(\d+)<\/NumeroNFe>/)?.[1];
  const codigoVerificacao = retornoXml.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/)?.[1];
  const inscricaoPrestador = retornoXml.match(/<InscricaoPrestador>(\d+)<\/InscricaoPrestador>/)?.[1];

  return { sucesso, numeroNFe, codigoVerificacao, inscricaoPrestador, erros, alertas, xmlBruto: retornoXml };
}
