// MiseOn — Edge Function: emissão da NFS-e da assinatura SaaS
//
// Dado um fatura_assinatura_id, emite a nota de serviço da MiseOn (emissora)
// para a loja (tomadora) via Focus NFe. Nunca bloqueia o pagamento: se a
// configuração fiscal da plataforma ainda não está pronta (sem certificado,
// sem habilitar NFS-e), só marca a fatura como pendente_configuracao e sai.
//
// IMPORTANTE — NFS-e Nacional: Manaus tornou obrigatória a NFS-e Padrão
// Nacional a partir de 01/01/2026 (LC 214/2025, art. 62), inclusive para
// MEI — não é mais o sistema municipal antigo (Nota Manaus). Por isso a
// emissão aqui usa o endpoint /v2/nfsen da Focus NFe (DPS Nacional), não o
// /v2/nfse legado. Pesquisado e confirmado: código de tributação nacional
// 170202 = "Expediente, secretaria em geral, apoio e infra-estrutura
// administrativa e congêneres" (bate com CNAE 8219-9/99), alíquota ISS
// Manaus 5%, codigo_opcao_simples_nacional 2 = MEI — tudo já vem
// pré-preenchido em configuracoes_fiscais_plataforma. Ainda assim, alguns
// nomes de campo/valores de enum do payload da DPS Nacional (ex.:
// regime_especial_tributacao, subcampos de tributacao_iss) só puderam ser
// confirmados parcialmente pela documentação pública da Focus NFe — validar
// no ambiente de homologação antes de habilitar produção, mesma prática já
// usada no módulo fiscal das lojas (NFe/NFC-e).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const isServiceRole = jwtPayload
      ? JSON.parse(atob(jwtPayload.replace(/-/g, '+').replace(/_/g, '/')))?.role === 'service_role'
      : false;
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

    // Trava de emissao.
    //
    // Era `habilita_nfse && certificado_status === 'valido'` — e o certificado
    // NUNCA e enviado a Focus nesta chamada: a autenticacao e o
    // FOCUS_API_TOKEN via Basic, e o certificado, quando exigido, fica no
    // painel da Focus. Ou seja, `certificado_status` era um flag local que nao
    // correspondia a exigencia nenhuma da API — e bloqueava a emissao sozinho.
    //
    // Para MEI na NFS-e Nacional isso e especialmente errado: o Emissor
    // Nacional aceita MEI sem certificado A1. O payload abaixo ja manda tudo o
    // que esse caso precisa (codigo_ibge, cnpj, codigo_opcao_simples_nacional
    // = 2 para MEI, codigo_tributacao_nacional, aliquota) e em momento algum
    // pede inscricao municipal.
    //
    // A trava passa a ser o que de fato importa: o operador ligou a emissao
    // (`habilita_nfse`) e existe CNPJ do prestador. Certificado so e cobrado
    // fora do regime MEI, onde a Focus costuma exigi-lo.
    const ehMei = String(config?.regime_tributario ?? '').toUpperCase() === 'MEI';
    const certificadoOk = ehMei || config?.certificado_status === 'valido';
    const pronta = !!config?.habilita_nfse && !!config?.cnpj && certificadoOk;
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
    const baseUrl = isProd ? 'https://api.focusnfe.com.br/v2' : 'https://homologacao.focusnfe.com.br/v2';
    const tokenMaster = isProd
      ? Deno.env.get('FOCUS_API_TOKEN_PROD')
      : Deno.env.get('FOCUS_API_TOKEN_HOMOLOG');
    if (!tokenMaster) {
      await supabase.from('faturas_assinatura')
        .update({ nfse_status: 'erro', nfse_erro: 'Token Focus NFe não configurado (secret FOCUS_API_TOKEN_PROD/HOMOLOG).' })
        .eq('id', fatura_id);
      return json({ error: 'Token Focus NFe ausente' }, { status: 500 });
    }

    const ref = `assinatura-${fatura_id}`;
    const cpfCnpjTomador = String(fatura.tomador_cpf_cnpj).replace(/\D/g, '');
    const ehCnpjTomador = cpfCnpjTomador.length === 14;

    // Payload da DPS Nacional (NFS-e Nacional) — Focus NFe /v2/nfsen.
    const payload: Record<string, any> = {
      data_emissao: new Date().toISOString(),
      data_competencia: new Date().toISOString().slice(0, 10),
      natureza_operacao: 1, // 1 = Tributação no município
      codigo_municipio_emissora: config.codigo_ibge, // Manaus = 1302603
      codigo_municipio_prestacao: config.codigo_ibge,
      cnpj_prestador: config.cnpj,
      codigo_opcao_simples_nacional: config.codigo_opcao_simples_nacional ?? 2, // 2 = MEI
      cnpj_tomador: ehCnpjTomador ? cpfCnpjTomador : undefined,
      cpf_tomador: !ehCnpjTomador ? cpfCnpjTomador : undefined,
      razao_social_tomador: fatura.tomador_razao_social,
      email_tomador: fatura.tomador_email || undefined,
      endereco_tomador: fatura.tomador_logradouro ? {
        logradouro: fatura.tomador_logradouro,
        numero: fatura.tomador_numero || 'S/N',
        complemento: fatura.tomador_complemento || undefined,
        bairro: fatura.tomador_bairro || undefined,
        uf: fatura.tomador_uf || undefined,
        cep: fatura.tomador_cep || undefined,
      } : undefined,
      descricao_servico: `Serviços de apoio administrativo e processamento de dados para gestão do estabelecimento — Assinatura MiseOn SaaS Pro (${fatura.ciclo === 'anual' ? 'plano anual' : 'plano mensal'}).`,
      valor_servico: Number(fatura.valor_cobrado),
      codigo_tributacao_nacional_iss: config.codigo_tributacao_nacional || '170202',
      aliquota_iss: config.aliquota_iss ?? 5,
      iss_retido: false,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const res = await fetch(`${baseUrl}/nfsen?ref=${ref}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(tokenMaster + ':')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const focusData = await res.json().catch(() => ({}));

    if (!res.ok || focusData?.erros) {
      const msg = focusData?.mensagem || focusData?.erros?.[0]?.mensagem || 'Erro ao emitir NFS-e na Focus NFe';
      await supabase.from('faturas_assinatura')
        .update({ nfse_status: 'erro', nfse_erro: msg })
        .eq('id', fatura_id);
      return json({ error: msg, detail: focusData }, { status: 400 });
    }

    const emitida = focusData?.status === 'autorizado' || !!focusData?.numero || !!focusData?.chave_acesso;
    await supabase.from('faturas_assinatura').update({
      nfse_status: emitida ? 'emitida' : 'processando',
      nfse_numero: focusData?.numero ?? focusData?.chave_acesso ?? null,
      nfse_codigo_verificacao: focusData?.codigo_verificacao ?? null,
      nfse_pdf_url: focusData?.url ?? focusData?.caminho_pdf_nfse ?? null,
      nfse_xml_url: focusData?.caminho_xml_nfse ?? null,
      nfse_emitida_em: emitida ? new Date().toISOString() : null,
    }).eq('id', fatura_id);

    if (emitida) {
      await supabase.rpc('fn_email_enfileirar', {
        p_loja: fatura.loja_id,
        p_evento: 'nota-fiscal-assinatura',
        p_destinatario: fatura.tomador_email,
        p_payload: {
          valor: Number(fatura.valor_cobrado).toFixed(2).replace('.', ','),
          nfse_numero: focusData?.numero ?? focusData?.chave_acesso ?? null,
          nfse_pdf_url: focusData?.url ?? focusData?.caminho_pdf_nfse ?? null,
        },
        p_referencia_id: fatura_id,
        p_classe: 'TRANSACIONAL',
      });
    }

    return json({ ok: true, nfse_status: emitida ? 'emitida' : 'processando', detail: focusData });
  } catch (e) {
    console.error('Falha ao emitir NFS-e:', e);
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
