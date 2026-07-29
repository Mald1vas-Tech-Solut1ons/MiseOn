import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  ...init
});

const SECRET_KEY = Deno.env.get('FISCAL_ENCRYPTION_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'miseon-secret-fiscal-key-32chars!';

async function encryptAES(text: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(SECRET_KEY.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, cryptoKey, enc.encode(text)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { 
      cnpj, 
      razao_social, 
      nome_fantasia,
      inscricao_estadual, 
      inscricao_municipal,
      cnae_principal,
      regime_tributario, 
      crt,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      cep,
      codigo_ibge,
      telefone,
      email,
      certificado_base64, 
      senha_certificado, 
      csc, 
      id_csc, 
      ambiente 
    } = body;
    
    // Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Cabeçalho de autorização ausente' }, { status: 401 });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return json({ error: 'Não autorizado' }, { status: 401 });

    const { data: usuarioLoja } = await supabaseUser
      .from('usuarios_loja')
      .select('loja_id')
      .eq('user_id', user.id)
      .single();

    if (!usuarioLoja?.loja_id) return json({ error: 'Loja não encontrada para este usuário' }, { status: 404 });
    const lojaId = usuarioLoja.loja_id;

    // Tokens Master Focus NFe
    const isProd = ambiente === 'producao';
    const baseUrl = isProd ? 'https://api.focusnfe.com.br/v2/empresas' : 'https://homologacao.focusnfe.com.br/v2/empresas';
    const tokenMaster = isProd 
      ? (Deno.env.get('FOCUS_API_TOKEN_PROD') || Deno.env.get('FOCUS_NFE_PROD'))
      : (Deno.env.get('FOCUS_API_TOKEN_HOMOLOG') || Deno.env.get('FOCUS_NFE_HOMOLOG'));

    if (!tokenMaster) {
      const secretVar = isProd ? 'FOCUS_API_TOKEN_PROD ou FOCUS_NFE_PROD' : 'FOCUS_API_TOKEN_HOMOLOG ou FOCUS_NFE_HOMOLOG';
      return json({ error: `Token Focus NFe não configurado nas variáveis de ambiente/secrets (${secretVar}).` }, { status: 500 });
    }

    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    const cleanIe = (inscricao_estadual || '').replace(/\D/g, '');
    const cleanCep = (cep || '00000000').replace(/\D/g, '');
    const cleanCertBase64 = (certificado_base64 || '').replace(/^data:[^;]+;base64,/, '');

    // Criptografia AES-256 para salvar com segurança total no DB
    let certificadoEncrypted = null;
    let senhaEncrypted = null;
    if (cleanCertBase64) {
      certificadoEncrypted = await encryptAES(cleanCertBase64);
    }
    if (senha_certificado) {
      senhaEncrypted = await encryptAES(senha_certificado);
    }

    // Transmite / Atualiza Empresa na Focus NFe API v2
    const focusPayload: Record<string, any> = {
      cnpj: cleanCnpj,
      inscricao_estadual: cleanIe,
      razao_social: razao_social,
      nome_fantasia: nome_fantasia || razao_social,
      regime_tributario: regime_tributario || 'Simples Nacional',
      logradouro: logradouro || 'Não Informado',
      numero: numero || 'S/N',
      complemento: complemento || '',
      bairro: bairro || 'Centro',
      municipio: cidade || 'São Paulo',
      uf: (uf || 'SP').toUpperCase(),
      cep: cleanCep,
      telefone: (telefone || '11999999999').replace(/\D/g, ''),
      email: email || user.email,
      habilita_nfe: true,
      habilita_nfce: true,
      id_token_nfce: id_csc || '',
      token_nfce: csc || '',
      enviar_email_destinatario: false
    };

    if (cleanCertBase64) {
      focusPayload.arquivo_certificado_base64 = cleanCertBase64;
    }
    if (senha_certificado) {
      focusPayload.senha_certificado = senha_certificado;
    }

    // Tenta primeiramente POST /v2/empresas, se já existir tenta PUT /v2/empresas/{cnpj}
    let res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(tokenMaster + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(focusPayload)
    });

    let focusData = await res.json();
    if (!res.ok && (focusData.codigo === 'requisicao_invalida' || focusData.mensagem?.includes('já cadastrado') || focusData.erros?.[0]?.mensagem?.includes('já cadastrado'))) {
      // Tenta atualização via PUT
      res = await fetch(`${baseUrl}/${cleanCnpj}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${btoa(tokenMaster + ':')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(focusPayload)
      });
      focusData = await res.json();
    }

    if (!res.ok && focusData.erros) {
      console.error("Erro Focus NFe Onboarding:", focusData);
      return json({ 
        error: focusData.mensagem || focusData.erros?.[0]?.mensagem || 'Erro ao habilitar empresa na Focus NFe/SEFAZ',
        detail: focusData.erros
      }, { status: 400 });
    }

    // Grava / Atualiza configuracoes_fiscais no banco do MiseOn
    const fiscalConfigData = {
      loja_id: lojaId,
      cnpj: cleanCnpj,
      razao_social,
      nome_fantasia: nome_fantasia || razao_social,
      inscricao_estadual: cleanIe,
      inscricao_municipal,
      cnae_principal,
      regime_tributario: regime_tributario || 'Simples Nacional',
      crt: Number(crt) || 1,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf: (uf || 'SP').toUpperCase(),
      cep: cleanCep,
      codigo_ibge,
      telefone,
      email,
      nfe_ambiente: ambiente || 'homologacao',
      habilita_nfe: true,
      habilita_nfce: true,
      id_csc,
      csc,
      certificado_nome: cleanCertBase64 ? 'certificado_a1.pfx' : undefined,
      certificado_validade: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // Válido 1 ano por padrão Focus
      certificado_status: 'valido',
      certificado_encrypted: certificadoEncrypted || undefined,
      senha_encrypted: senhaEncrypted || undefined
    };

    const { error: upsertErr } = await supabaseAdmin
      .from('configuracoes_fiscais')
      .upsert(fiscalConfigData, { onConflict: 'loja_id' });

    if (upsertErr) throw upsertErr;

    // Atualiza flag de nfe_habilitado na tabela lojas
    await supabaseAdmin
      .from('lojas')
      .update({ nfe_habilitado: true, nfe_ambiente: ambiente || 'homologacao' })
      .eq('id', lojaId);

    return json({ 
      success: true, 
      message: 'Configurações Fiscais salvas e empresa habilitada na SEFAZ via Focus NFe com sucesso.',
      data: focusData
    });

  } catch (err: any) {
    console.error('Crash no onboarding fiscal:', err);
    return json({ error: err.message || String(err) }, { status: 500 });
  }
});
