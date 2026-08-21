import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extrairChave, parseHtmlSefazSp } from './parser.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...cors, ...(init.headers ?? {}) },
  });

const erro = (msg: string, status = 400) => json({ error: msg }, { status });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { url_qrcode, chave_acesso } = await req.json();
    const entrada = url_qrcode || chave_acesso;
    if (!entrada) return erro('url_qrcode ou chave_acesso é obrigatório');

    const info = extrairChave(entrada);
    if (!info) return erro('Chave ou URL da NFC-e inválida (deve conter 44 dígitos)');

    // A consulta pública da SEFAZ exige o hash do QR Code — um HMAC calculado
    // com o CSC do estabelecimento emitente. Não há como derivá-lo da chave,
    // então a chave sozinha nunca vai resolver: a SEFAZ devolve
    // "Hash QR Code inválido". Avisa direito em vez de repassar esse erro.
    if (!url_qrcode) {
      return erro(
        'Só a chave de acesso não basta: a SEFAZ exige o código de segurança que vem dentro do QR Code. ' +
        'Escaneie o QR Code impresso no cupom (ou cole a URL completa que ele contém).',
        422,
      );
    }

    // A URL impressa em "Consulte pela Chave de Acesso em ..." NÃO é a do QR
    // Code: ela leva ao formulário com captcha e não tem o hash de segurança.
    // A do QR traz ?p=<chave>|<versão>|<ambiente>|<idToken>|<hash>. Sem o hash
    // a SEFAZ responde "Hash QR Code inválido", então recusa aqui com um texto
    // que diz o que fazer, em vez de repassar erro de terceiro.
    const parametroP = url_qrcode.match(/[?&]p=([^&\s]+)/i)?.[1];
    const campos = decodeURIComponent(parametroP ?? '').split('|');
    if (!parametroP || campos.length < 4 || !campos[campos.length - 1]?.trim()) {
      return erro(
        'Esse endereço é o da consulta impressa no cupom, não o conteúdo do QR Code. ' +
        'O QR Code guarda uma URL com "?p=" seguida da chave e do código de segurança, separados por barra vertical. ' +
        'Escaneie o QR pela câmera ou pela foto do cupom.',
        422,
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return erro('Não autenticado', 401);

    if (info.uf !== 'SP') {
      return erro(
        `Esta nota é de ${info.uf}. Por enquanto a importação automática lê apenas cupons de São Paulo.`,
        422,
      );
    }

    const resp = await fetch(url_qrcode, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!resp.ok) {
      return erro(`Não foi possível acessar a SEFAZ (Status: ${resp.status}). Verifique o QR Code.`, 502);
    }

    const html = await resp.text();
    const dados = parseHtmlSefazSp(html, info.chave);

    if (dados.itens.length === 0) {
      const motivo = html.match(/Erro\(s\):\s*-?\s*([^'<]+)/i)?.[1]?.trim();
      return erro(
        motivo
          ? `A SEFAZ recusou a consulta: ${motivo}`
          : 'A SEFAZ respondeu, mas nenhum produto foi encontrado na nota. O QR Code pode estar incompleto.',
        422,
      );
    }

    return json(dados);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
