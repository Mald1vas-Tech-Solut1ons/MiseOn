// MiseOn — Edge Function: cria cobrança Pix imediata no Efí Bank
// Porte do EfiPixService do MySuperStore (backend/apps/payments/services.py)
//
// Secrets necessários (supabase secrets set):
//   EFI_PIX_CLIENT_ID/EFI_PIX_CLIENT_SECRET
//   ou EFI_CLIENT_ID/EFI_CLIENT_SECRET
//   + EFI_PIX_KEY, EFI_CERT_BASE64 (PEM em base64), EFI_SANDBOX=true|false
//
// Fluxo: front cria o pedido -> chama esta function -> retorna txid + copia-e-cola
// A confirmação chega via pix-webhook.

import { createClient } from 'jsr:@supabase/supabase-js@2';
// Rate limit compartilhado. Já existiu aqui uma cópia local com o MESMO nome
// mais um import lá embaixo: a função local vencia, devolvia boolean, e o
// `rl.allowed` dava undefined — 429 em 100% das cobranças. Uma declaração só.
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';
import { confirmarPagamentoPedido } from '../_shared/pedido-pix.ts';

const EFI_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://pix-h.api.efipay.com.br'
  : 'https://pix.api.efipay.com.br';

// CORS: sem isto o navegador bloqueia a chamada do checkout antes de chegar na Efí.
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

function envFirst(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  throw new Error(`Secret ausente: informe um destes nomes -> ${names.join(', ')}`);
}

// Credenciais Efí da plataforma (env) — modelo split: a cobrança nasce na conta MiseOn
// e o repasse ao lojista é feito pelo split Pix (favorecido CPF/CNPJ + conta Efí).
type EfiCreds = { clientId: string; clientSecret: string; certPem: string; pixKey: string };

function credsPlataforma(): EfiCreds {
  return {
    clientId: envFirst('EFI_PIX_CLIENT_ID', 'EFI_CLIENT_ID'),
    clientSecret: envFirst('EFI_PIX_CLIENT_SECRET', 'EFI_CLIENT_SECRET'),
    certPem: atob(envFirst('EFI_CERT_BASE64')),
    pixKey: envFirst('EFI_PIX_KEY'),
  };
}

// mTLS: Deno.createHttpClient com o certificado (cert+key em PEM) da conta usada.
function efiFetch(creds: EfiCreds, path: string, init: RequestInit, token?: string) {
  const client = Deno.createHttpClient({
    // @ts-ignore — API de mTLS do Deno
    cert: creds.certPem,
    key: creds.certPem,
  });
  return fetch(`${EFI_URL}${path}`, {
    ...init,
    // @ts-ignore — opção 'client' é específica do Deno (fetch com HttpClient)
    client,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function getToken(creds: EfiCreds): Promise<string> {
  const auth = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const res = await efiFetch(creds, '/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Efí OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  
  try {
    const { pedido_id, acao } = await req.json();
    if (!pedido_id) return json({ error: 'pedido_id obrigatório' }, { status: 400 });

    // 'status' é chamada em laço pela tela enquanto o QR está aberto, então
    // tem teto próprio; criar cobrança segue com o teto apertado de sempre.
    const consultando = acao === 'status';
    const clientIp = ipDaRequisicao(req);
    const rl = await checkRateLimit(
      `pix:${consultando ? 'status' : 'criar'}:${clientIp}`,
      { windowMs: 60000, maxRequests: consultando ? 30 : 10 },
    );
    if (!rl.allowed) {
      return json({ error: 'Too Many Requests' }, { status: 429 });
    }

    // service role: roda no servidor, ignora RLS para leitura segura do pedido
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, numero, valor_total, identificador_cliente, cliente_id, cliente_user_id, loja_id, status, lojas(nome, efi_titular_documento, efi_conta)')
      .eq('id', pedido_id)
      .single();
    if (!pedido) return json({ error: 'pedido não encontrado' }, { status: 404 });

    // Validação de Autorização/Ownership:
    // Se o cabeçalho Authorization trouxer o token do usuário autenticado,
    // verificamos se o usuário pertence à loja ou se é o cliente dono do pedido.
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user: authUser } } = await userClient.auth.getUser();
      if (authUser && authUser.role !== 'anon') {
        // Usuário logado: dono do pedido ou operador/admin da loja.
        //
        // O campo é `cliente_user_id` (FK para auth.users). Aqui comparava-se
        // `cliente_id`, que é o id da linha em `clientes` — outro espaço de
        // ids, nunca igual ao do usuário autenticado. Resultado: TODO cliente
        // logado caía no 403 e não conseguia pagar por Pix. Só passava quem
        // por acaso também era da equipe da loja.
        const isClienteDono = !!pedido.cliente_user_id && pedido.cliente_user_id === authUser.id;
        if (!isClienteDono) {
          const { data: vinculo } = await supabase
            .from('usuarios_loja')
            .select('papel')
            .eq('user_id', authUser.id)
            .eq('loja_id', pedido.loja_id)
            .maybeSingle();
          if (!vinculo) {
            // Nem cliente dono do pedido, nem operador/admin da loja
            return json({ error: 'Acesso não autorizado para este pedido' }, { status: 403 });
          }
        }
      }
    }

    // ── CONSULTA DE PAGAMENTO (reconciliação) ──────────────────────────────
    // A tela do cliente pergunta aqui enquanto o QR está aberto. Não é luxo: é
    // o que faz o pedido pago ser reconhecido mesmo quando o webhook da Efí
    // falha, atrasa ou está mal configurado — situação real entre 17/08 e
    // 21/08/2026, quando o webhook recusou 100% dos callbacks e não havia
    // segundo caminho. A verdade vem da Efí, nunca do cliente.
    if (consultando) {
      const { data: pgtoPix } = await supabase
        .from('pagamentos')
        .select('status, gateway_txid')
        .eq('pedido_id', pedido_id)
        .eq('metodo', 'PIX')
        .maybeSingle();

      if (pgtoPix?.status === 'PAGO') return json({ pago: true, motivo: 'ja_processado' });
      if (!pgtoPix?.gateway_txid) return json({ pago: false, motivo: 'sem_cobranca' });

      const credsConsulta: EfiCreds = credsPlataforma();
      const tokenConsulta = await getToken(credsConsulta);
      const resCob = await efiFetch(credsConsulta, `/v2/cob/${pgtoPix.gateway_txid}`, { method: 'GET' }, tokenConsulta);
      const cob = await resCob.json().catch(() => ({}));

      const resultado = await confirmarPagamentoPedido(supabase, pgtoPix.gateway_txid, cob, {
        info: (m, c) => console.log(m, c ?? ''),
        warn: (m, c) => console.warn(m, c ?? ''),
        error: (m, e, c) => console.error(m, e ?? '', c ?? ''),
      });

      return json({
        pago: resultado.pago,
        status_cobranca_efi: cob?.status ?? null,
        motivo: resultado.motivo ?? null,
      });
    }

    // SEGURANÇA: o total é recalculado no servidor a partir dos preços reais
    // (produtos/opções/cupom) — o valor que o browser gravou NÃO é confiável.
    // fn_recalcular_pedido também corrige os totais gravados no pedido.
    const { data: totalReal, error: erroRecalc } = await supabase.rpc('fn_recalcular_pedido', { p_pedido_id: pedido_id });
    if (erroRecalc) return json({ error: 'Falha ao validar o valor do pedido', detail: String(erroRecalc?.message || erroRecalc) }, { status: 500 });
    const valorCobranca = Number(totalReal);
    if (!(valorCobranca > 0)) return json({ error: 'Valor do pedido inválido para cobrança Pix.' }, { status: 400 });

    // Modelo split: a cobrança é sempre criada pela conta da plataforma (MiseOn) e o
    // valor é repassado 100% ao lojista via split Pix (favorecido = CPF/CNPJ + conta Efí).
    // O lojista não fornece nenhuma credencial de API.
    const creds: EfiCreds = credsPlataforma();

    const token = await getToken(creds);

    // txid: 26–35 chars alfanuméricos (regra Efí — mesmo padrão do MySuperStore)
    const pedidoBase = String(pedido_id).replace(/-/g, '').slice(0, 32);
    const numeroFragmento = String(Number(pedido.numero) % 1000).padStart(3, '0');
    const txid = `${pedidoBase}${numeroFragmento}`.slice(0, 35);

    // Dados do favorecido do split Pix (conta Efí do lojista). O Pix, ao contrário do
    // cartão, NÃO usa o payee_code — exige CPF/CNPJ do titular + número da conta Efí.
    const docLojista = String((pedido as any).lojas?.efi_titular_documento ?? '').replace(/\D/g, '');
    const contaLojista = String((pedido as any).lojas?.efi_conta ?? '').replace(/\D/g, '');

    // IMPORTANTE: a API Pix da Efí NÃO aceita "split" dentro do corpo da cobrança
    // imediata (PUT /v2/cob/{txid}) — isso retorna json_invalido/additionalProperties.
    // O split é um fluxo separado: cria-se uma configuração e vincula-se à cobrança (abaixo).
    const body: any = {
      calendario: { expiracao: 3600 },
      valor: { original: valorCobranca.toFixed(2) },
      chave: creds.pixKey,
      solicitacaoPagador: `Pedido #${pedido.numero} — ${(pedido as any).lojas?.nome ?? 'MiseOn'}`.slice(0, 140),
    };

    const res = await efiFetch(creds, `/v2/cob/${txid}`, { method: 'PUT', body: JSON.stringify(body) }, token);
    const charge = await res.json();
    if (!charge.txid) throw new Error(`Efí cobrança falhou: ${charge.mensagem || charge.nome || 'Erro desconhecido'}`);

    // REPASSE AO LOJISTA (Split Pix) — best-effort: se falhar, a cobrança continua
    // válida e paga na conta da plataforma (repasse manual), sem travar o checkout.
    // Fluxo Efí: POST /v2/gn/split/config -> PUT /v2/gn/split/cob/{txid}/vinculo/{id}.
    // Favorecido identificado por { cpf|cnpj, conta } (conta = número da conta Efí).
    // split_status vai na resposta para diagnóstico (não é dado sensível).
    let splitStatus: string;
    if (!docLojista || !contaLojista) {
      splitStatus = 'sem_dados_repasse'; // loja não configurou CPF/CNPJ + conta Efí
    } else {
      try {
        const docKey = docLojista.length > 11 ? 'cnpj' : 'cpf';
        const cfgBody = {
          descricao: `Repasse MiseOn -> ${(pedido as any).lojas?.nome ?? 'loja'}`.slice(0, 140),
          lancamento: { imediato: true },
          split: {
            divisaoTarifa: 'assumir_total',
            minhaParte: { tipo: 'porcentagem', valor: '0.00' },
            repasses: [
              {
                tipo: 'porcentagem',
                valor: '100.00', // lojista recebe 100% da venda
                favorecido: { [docKey]: docLojista, conta: contaLojista },
              },
            ],
          },
        };
        const cfgRes = await efiFetch(creds, '/v2/gn/split/config', { method: 'POST', body: JSON.stringify(cfgBody) }, token);
        const cfg = await cfgRes.json();
        const cfgId = cfg?.id ?? cfg?.identificador ?? cfg?.split_config_id;
        if (cfgId) {
          const vinc = await efiFetch(creds, `/v2/gn/split/cob/${charge.txid}/vinculo/${cfgId}`, { method: 'PUT' }, token);
          splitStatus = vinc.ok ? 'vinculado' : 'vinculo_falhou';
        } else {
          splitStatus = 'config_sem_id';
          console.error('Split: config sem id');
        }
      } catch (splitErr) {
        splitStatus = 'erro_split';
        console.error('Split falhou:', String((splitErr as Error)?.message ?? splitErr));
      }
    }

    // QR Code (copia e cola vem direto; imagem via loc)
    let qrImagem: string | null = null;
    if (charge.loc?.id) {
      const qr = await efiFetch(creds, `/v2/loc/${charge.loc.id}/qrcode`, { method: 'GET' }, token);
      const qrData = await qr.json();
      qrImagem = qrData.imagemQrcode ?? null;
    }

    // O split_status era calculado e jogado fora: 'vinculo_falhou' significava
    // dinheiro parado na conta da plataforma e ninguem ficava sabendo. Agora
    // fica gravado na cobranca, que e a unica fonte de verdade sobre repasse.
    await supabase
      .from('pagamentos')
      .update({ gateway_txid: charge.txid, split_status: splitStatus })
      .eq('pedido_id', pedido_id)
      .eq('metodo', 'PIX');

    return json({
      txid: charge.txid,
      copia_e_cola: charge.pixCopiaECola ?? charge.location,
      qr_imagem: qrImagem,
      expiracao: 3600,
      split_status: splitStatus,
    });
  } catch (e) {
    console.error('Erro na função pix-criar-cobranca:', String((e as Error)?.message ?? e));
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});

