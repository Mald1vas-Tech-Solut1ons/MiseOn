// MiseOn — Edge Function: Configuração Fiscal da Plataforma (NFS-e da MiseOn)
//
// Análogo a fiscal-onboarding-empresa, mas para a própria MiseOn (emissora
// da nota da assinatura), não para uma loja. Linha única em
// configuracoes_fiscais_plataforma. Só superadmin pode chamar.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
};

const json = (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  ...init
});

// Auditoria, achado 11: mesmo fallback literal versionado da função irmã.
const SECRET_KEY = Deno.env.get('FISCAL_ENCRYPTION_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!SECRET_KEY) {
  throw new Error('FISCAL_ENCRYPTION_SECRET não configurada — recusando iniciar.');
}

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
      cnpj, razao_social, nome_fantasia, inscricao_municipal, cnae_principal,
      codigo_servico, item_lista_servico, codigo_tributacao_nacional,
      codigo_opcao_simples_nacional, aliquota_iss, regime_tributario,
      logradouro, numero, complemento, bairro, cidade, uf, cep,
      codigo_ibge, telefone, email,
      certificado_base64, senha_certificado, ambiente, habilita_nfse,
    } = body;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Cabeçalho de autorização ausente' }, { status: 401 });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Chamada function-to-function (ex.: script de bootstrap operado pelo
    // próprio dono da plataforma) usa a service role key e passa direto,
    // mesmo padrão já usado em fiscal-emitir-nfse. Chamada com JWT de
    // usuário real precisa ser superadmin.
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
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
      if (userErr || !user) return json({ error: 'Não autorizado' }, { status: 401 });

      const { data: souSuperadmin } = await supabaseAdmin
        .from('plataforma_admins').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!souSuperadmin) return json({ error: 'Só o superadmin pode configurar o fiscal da plataforma' }, { status: 403 });
    }

    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    const cleanCep = (cep || '').replace(/\D/g, '');
    const cleanCertBase64 = (certificado_base64 || '').replace(/^data:[^;]+;base64,/, '');

    let certificadoEncrypted: string | undefined;
    let senhaEncrypted: string | undefined;
    if (cleanCertBase64) certificadoEncrypted = await encryptAES(cleanCertBase64);
    if (senha_certificado) senhaEncrypted = await encryptAES(senha_certificado);

    const dados: Record<string, any> = {
      id: true,
      cnpj: cleanCnpj || undefined,
      razao_social,
      nome_fantasia,
      inscricao_municipal,
      cnae_principal,
      codigo_servico,
      item_lista_servico,
      codigo_tributacao_nacional,
      codigo_opcao_simples_nacional: codigo_opcao_simples_nacional != null ? Number(codigo_opcao_simples_nacional) : undefined,
      aliquota_iss: aliquota_iss != null ? Number(aliquota_iss) : undefined,
      regime_tributario,
      logradouro, numero, complemento, bairro, cidade,
      uf: uf ? String(uf).toUpperCase() : undefined,
      cep: cleanCep || undefined,
      codigo_ibge, telefone, email,
      ambiente: ambiente === 'producao' ? 'producao' : 'homologacao',
      habilita_nfse: !!habilita_nfse,
    };
    if (certificadoEncrypted) {
      dados.certificado_nome = 'certificado_a1.pfx';
      dados.certificado_validade = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      dados.certificado_status = 'valido';
      dados.certificado_encrypted = certificadoEncrypted;
    }
    if (senhaEncrypted) dados.senha_encrypted = senhaEncrypted;

    // Remove chaves undefined para não sobrescrever valores existentes com null.
    Object.keys(dados).forEach((k) => dados[k] === undefined && delete dados[k]);

    const { error: upsertErr } = await supabaseAdmin
      .from('configuracoes_fiscais_plataforma')
      .upsert(dados, { onConflict: 'id' });
    if (upsertErr) throw upsertErr;

    return json({ success: true, message: 'Configuração fiscal da plataforma salva.' });
  } catch (err: any) {
    console.error('Crash no onboarding fiscal da plataforma:', err);
    return json({ error: err.message || String(err) }, { status: 500 });
  }
});
