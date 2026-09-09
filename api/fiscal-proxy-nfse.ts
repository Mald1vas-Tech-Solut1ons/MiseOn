/**
 * Proxy de saída para o webservice NFS-e da Prefeitura de São Paulo.
 *
 * Por que existe: confirmado em teste real (09/09) que a Prefeitura de SP
 * reseta a conexão mTLS ("Connection reset by peer") quando a origem é uma
 * Supabase Edge Function (Deno Deploy, sem IP fixo, pode sair de qualquer
 * datacenter do mundo). A mesma chamada, com o mesmo certificado, completa
 * o handshake normalmente quando a origem é um IP brasileiro comum — este
 * projeto Vercel já roda fixo na região gru1 (São Paulo), então basta a
 * chamada de rede final acontecer daqui em vez de dentro do Supabase.
 *
 * A Edge Function `fiscal-emitir-nfse` continua responsável por tudo que é
 * lógica de negócio: buscar a fatura, decodificar o certificado, montar e
 * assinar o XML do RPS/lote. Esta rota só recebe o XML JÁ ASSINADO e faz a
 * última perna da chamada (a conexão TLS com certificado de cliente).
 *
 * Autenticação: token compartilhado (FISCAL_PROXY_TOKEN), configurado igual
 * nos dois lados (Vercel env var e Supabase secret) — não é a service role
 * key, então um vazamento aqui não dá acesso ao banco.
 */
import { timingSafeEqual } from 'node:crypto';
import https from 'node:https';

export const config = { runtime: 'nodejs' };

function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface Corpo {
  mensagemXmlAssinada: string;
  producao: boolean;
  certPem: string;
  keyPem: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const token = process.env.FISCAL_PROXY_TOKEN;
  if (!token) return res.status(500).json({ error: 'Proxy fiscal não configurado (FISCAL_PROXY_TOKEN ausente)' });

  const recebido = String(req.headers['x-fiscal-proxy-token'] ?? '');
  if (!recebido || !segredoConfere(recebido, token)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const { mensagemXmlAssinada, producao, certPem, keyPem } = (req.body ?? {}) as Partial<Corpo>;
  if (!mensagemXmlAssinada || !certPem || !keyPem) {
    return res.status(400).json({ error: 'mensagemXmlAssinada, certPem e keyPem são obrigatórios' });
  }

  const metodo = producao ? 'EnvioLoteRPS' : 'TesteEnvioLoteRPS';
  const soapAction = producao
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
    `<MensagemXML>${mensagemXmlAssinada.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</MensagemXML>` +
    `</${metodo}Request>` +
    `</soap:Body>` +
    `</soap:Envelope>`;

  try {
    const { status, bodyText } = await new Promise<{ status: number; bodyText: string }>((resolve, reject) => {
      const r = https.request(
        {
          hostname: 'nfe.prefeitura.sp.gov.br',
          port: 443,
          path: '/ws/lotenfe.asmx',
          method: 'POST',
          cert: certPem,
          key: keyPem,
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            SOAPAction: `"${soapAction}"`,
            'Content-Length': Buffer.byteLength(envelope),
          },
          timeout: 20000,
        },
        (resposta) => {
          let body = '';
          resposta.on('data', (c: Buffer) => { body += c; });
          resposta.on('end', () => resolve({ status: resposta.statusCode ?? 0, bodyText: body }));
        },
      );
      r.on('timeout', () => { r.destroy(); reject(new Error('Timeout ao conectar com a Prefeitura de SP')); });
      r.on('error', (e: Error) => reject(e));
      r.end(envelope);
    });

    return res.status(200).json({ status, bodyText });
  } catch (e) {
    return res.status(502).json({ error: String((e as Error)?.message ?? e) });
  }
}
