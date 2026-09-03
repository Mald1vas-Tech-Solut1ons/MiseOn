// MiseOn — Edge Function: emissão da NFS-e da assinatura SaaS
//
// Dado um fatura_assinatura_id, emite a nota de serviço da Maldivas Tech
// (emissora) para a loja (tomadora). Nunca bloqueia o pagamento: se a
// configuração fiscal da plataforma ainda não está pronta (sem certificado,
// sem habilitar NFS-e), só marca a fatura como pendente_configuracao e sai.
//
// CAMINHO GRATUITO — Web Service direto da Prefeitura de São Paulo
// (nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx), sem gateway pago (Focus NFe
// removida em 03/09/2026 a pedido do operador — custo mensal incompatível
// com o estágio pré-receita da empresa). Ver supabase/functions/_shared/sp-nfse-webservice.ts.
//
// Por que o sistema municipal antigo e não o Emissor Nacional (nfse.gov.br):
// testado ao vivo em 03/09/2026 — a inscrição municipal desta empresa ainda
// não está habilitada no ambiente nacional (nem no de testes/produção
// restrita), porque São Paulo só entra na obrigatoriedade do Emissor
// Nacional em 01/11/2026 (adiado de 01/09). Até lá, o webservice próprio da
// prefeitura é o único caminho que funciona de verdade — e ele tem um método
// de teste real (TesteEnvioLoteRPS) que valida tudo sem gerar NF-e, usado
// aqui sempre que config.ambiente !== 'producao'.
//
// A empresa é Sociedade Empresária Limitada optante pelo Simples Nacional
// (não MEI, desde a migration 20260902120000) — o certificado A1 é
// obrigatório para assinar o RPS e a mensagem XML (não existe bypass como
// havia para o antigo emissor MEI de Manaus).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  decodificarPfx,
  montarXmlRps,
  montarELoteAssinado,
  enviarLoteRps,
  type DadosRps,
} from '../_shared/sp-nfse-webservice.ts';

const SECRET_KEY = Deno.env.get('FISCAL_ENCRYPTION_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

async function decryptAES(base64: string): Promise<string> {
  if (!SECRET_KEY) throw new Error('FISCAL_ENCRYPTION_SECRET não configurada');
  const enc = new TextEncoder();
  const keyData = enc.encode(SECRET_KEY.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
  const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { fatura_id } = await req.json();
    if (!fatura_id) return json({ error: 'fatura_id é obrigatório' }, { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Chamada function-to-function (saas-assinar, efi-assinatura-webhook) usa
    // a service role key e passa direto. Chamada com JWT de usuário real (ex:
    // botão "reprocessar" no painel do superadmin) precisa ser superadmin.
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwtPayload = authHeader.replace(/^Bearer\s+/i, '').split('.')[1];
    // base64url → base64 com padding correto antes de atob
    const isServiceRole = (() => {
      if (!jwtPayload) return false;
      try {
        const b64 = jwtPayload.replace(/-/g, '+').replace(/_/g, '/').padEnd(
          Math.ceil(jwtPayload.length / 4) * 4, '='
        );
        return JSON.parse(atob(b64))?.role === 'service_role';
      } catch { return false; }
    })();
    if (!isServiceRole) {
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      const { data: souSuperadmin } = user
        ? await supabase.from('plataforma_admins').select('user_id').eq('user_id', user.id).maybeSingle()
        : { data: null };
      if (!souSuperadmin) return json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { data: fatura, error: eFatura } = await supabase
      .from('faturas_assinatura').select('*').eq('id', fatura_id).single();
    if (eFatura || !fatura) return json({ error: 'Fatura não encontrada' }, { status: 404 });

    const { data: config } = await supabase
      .from('configuracoes_fiscais_plataforma').select('*').eq('id', true).maybeSingle();

    // Trava de emissao. Assinamos o RPS e a mensagem XML localmente com o
    // certificado A1 da empresa — não é opcional como era com a Focus
    // (aquela autenticava via token, o certificado nunca saía daqui). Sem
    // certificado válido e sem inscrição municipal não há como montar o
    // envelope assinado, então os dois entram na trava.
    const pronta = !!config?.habilita_nfse
      && !!config?.cnpj
      && !!config?.inscricao_municipal
      && config?.certificado_status === 'valido'
      && !!config?.certificado_encrypted
      && !!config?.senha_encrypted;
    if (!pronta) {
      await supabase.from('faturas_assinatura')
        .update({ nfse_status: 'pendente_configuracao' })
        .eq('id', fatura_id);
      return json({ ok: true, nfse_status: 'pendente_configuracao' });
    }

    if (!fatura.tomador_cpf_cnpj || !fatura.tomador_razao_social) {
      await supabase.from('faturas_assinatura')
        .update({ nfse_status: 'erro', nfse_erro: 'Dados fiscais do tomador ausentes (cadastro incompleto).' })
        .eq('id', fatura_id);
      return json({ error: 'Dados fiscais do tomador ausentes' }, { status: 422 });
    }

    await supabase.from('faturas_assinatura').update({ nfse_status: 'processando' }).eq('id', fatura_id);

    const isProd = config.ambiente === 'producao';

    let cert;
    try {
      const [pfxBase64, senha] = await Promise.all([
        decryptAES(config.certificado_encrypted),
        decryptAES(config.senha_encrypted),
      ]);
      cert = decodificarPfx(pfxBase64, senha);
    } catch (e) {
      const msg = `Falha ao decodificar certificado A1: ${(e as Error)?.message ?? e}`;
      await supabase.from('faturas_assinatura').update({ nfse_status: 'erro', nfse_erro: msg }).eq('id', fatura_id);
      return json({ error: msg }, { status: 500 });
    }

    // Numeração do RPS: série fixa "MS" (Maldivas Software), número
    // sequencial = quantidade de notas já emitidas + 1. Sem tabela de
    // sequência dedicada por ora — volume da plataforma ainda é baixo o
    // suficiente pra isso não colidir; revisitar se o volume crescer.
    const { count: totalEmitidas } = await supabase
      .from('faturas_assinatura').select('id', { count: 'exact', head: true }).eq('nfse_status', 'emitida');
    const numeroRps = (totalEmitidas ?? 0) + 1;

    const hoje = new Date().toISOString().slice(0, 10);
    const dadosRps: DadosRps = {
      inscricaoMunicipalPrestador: config.inscricao_municipal,
      serieRps: 'MS',
      numeroRps,
      dataEmissao: hoje,
      tributacao: 'T',
      status: 'N',
      issRetido: false,
      valorServicos: Number(fatura.valor_cobrado),
      valorDeducoes: 0,
      codigoServico: config.codigo_servico || '02800', // Licenciamento/cessão de uso de programa de computação
      aliquotaServicos: Number(config.aliquota_iss ?? 0.05),
      cpfCnpjTomador: fatura.tomador_cpf_cnpj,
      razaoSocialTomador: fatura.tomador_razao_social,
      emailTomador: fatura.tomador_email || undefined,
      discriminacao: `Assinatura MiseOn SaaS (${fatura.ciclo === 'anual' ? 'plano anual' : 'plano mensal'}) - competencia ${hoje.slice(0, 7)}`,
    };

    const rpsXml = montarXmlRps(dadosRps, cert.privateKeyPem);
    const loteAssinado = montarELoteAssinado({
      cnpjRemetente: config.cnpj,
      dataInicio: hoje,
      dataFim: hoje,
      rpsXmlList: [rpsXml],
      valorTotalServicos: Number(fatura.valor_cobrado),
      valorTotalDeducoes: 0,
    }, cert);

    const retorno = await enviarLoteRps(loteAssinado, {
      producao: isProd,
      certPem: cert.certPem,
      privateKeyPem: cert.privateKeyPem,
    });

    if (!retorno.sucesso) {
      const msg = retorno.erros.length
        ? retorno.erros.map((e) => `[${e.codigo}] ${e.descricao}`).join(' | ')
        : 'Erro desconhecido no webservice da NFS-e Paulistana';
      await supabase.from('faturas_assinatura')
        .update({ nfse_status: 'erro', nfse_erro: msg })
        .eq('id', fatura_id);
      return json({ error: msg, detail: retorno }, { status: 400 });
    }

    // Em ambiente de teste (TesteEnvioLoteRPS) nenhuma NF-e é gerada de
    // verdade — sucesso aqui só confirma que a mensagem passaria. Só marcamos
    // "emitida" quando veio um número de NF-e real (ambiente de produção).
    const emitida = isProd && !!retorno.numeroNFe;
    await supabase.from('faturas_assinatura').update({
      nfse_status: emitida ? 'emitida' : (isProd ? 'erro' : 'testada_ok'),
      nfse_numero: retorno.numeroNFe ?? null,
      nfse_codigo_verificacao: retorno.codigoVerificacao ?? null,
      nfse_erro: emitida ? null : (isProd ? 'Emissão em produção não retornou número de NF-e.' : null),
      nfse_emitida_em: emitida ? new Date().toISOString() : null,
    }).eq('id', fatura_id);

    if (emitida) {
      await supabase.rpc('fn_email_enfileirar', {
        p_loja: fatura.loja_id,
        p_evento: 'nota-fiscal-assinatura',
        p_destinatario: fatura.tomador_email,
        p_payload: {
          valor: Number(fatura.valor_cobrado).toFixed(2).replace('.', ','),
          nfse_numero: retorno.numeroNFe,
          nfse_codigo_verificacao: retorno.codigoVerificacao,
          nfse_inscricao_prestador: config.inscricao_municipal,
          nfse_pdf_url: `https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1/fiscal-pdf-nfse?id=${fatura_id}`,
        },
        p_referencia_id: fatura_id,
        p_classe: 'TRANSACIONAL',
      });
    }

    return json({ ok: true, nfse_status: emitida ? 'emitida' : (isProd ? 'erro' : 'testada_ok'), detail: retorno });
  } catch (e) {
    console.error('Falha ao emitir NFS-e:', e);
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
