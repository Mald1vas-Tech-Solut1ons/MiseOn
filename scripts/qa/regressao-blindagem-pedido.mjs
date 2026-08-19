// Prova ponta a ponta com um CLIENTE LOGADO de verdade, contra produção.
// Objetivo: (1) o pedido legítimo continua passando depois das policies novas;
//           (2) as quatro fraudes de preço estão realmente fechadas.
// Loja usada: Lanche do Paulista (loja de provas). Natureba não é tocada.
import fs from 'fs';

const URL = 'https://zzuxklwhaoisuuvndtfw.supabase.co';
const env = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
const ANON = env.find(l => l.startsWith('VITE_SUPABASE_ANON_KEY='))
  .slice('VITE_SUPABASE_ANON_KEY='.length).trim().replace(/^"|"$/g, '');

const LOJA           = '34004cf0-6b5a-485b-9bf4-079aaad9aa47'; // lanchepaulista
const PRODUTO        = 'df896f99-8266-47b9-beca-151159a11e44'; // X-PAULISTA, R$32,00
const PRECO_REAL     = 32.00;
const PRODUTO_ALHEIO = 'c51e9546-4c78-44c9-905d-45b3e48d0c9a'; // Café Premium (natureba)

// Fixos: o signup exige confirmação de e-mail, então a conta é criada numa
// passada, confirmada por SQL, e reutilizada na passada seguinte.
const email = 'qa-blindagem@miseon-teste.local';
// A senha do usuario de teste NAO fica no codigo: o repositorio e publico e
// segredo commitado fica no historico para sempre. Defina QA_SENHA no
// ambiente antes de rodar:
//   QA_SENHA='<algo forte>' node scripts/qa/regressao-blindagem-pedido.mjs
const senha = process.env.QA_SENHA;
if (!senha) {
  console.error('Defina QA_SENHA no ambiente antes de rodar este script.');
  process.exit(1);
}


let TOKEN = null;
const req = async (metodo, caminho, corpo, comToken = true) => {
  const r = await fetch(`${URL}${caminho}`, {
    method: metodo,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${comToken && TOKEN ? TOKEN : ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: r.status, ok: r.ok, json };
};

const linha = (rotulo, passou, detalhe) =>
  console.log(`${passou ? '  OK  ' : ' FALHA'} │ ${rotulo.padEnd(46)} │ ${detalhe}`);

console.log('\n═══ PROVA E2E — cliente logado real, produção ═══\n');

// ── 1. Cria e loga o cliente de teste ────────────────────────────────────
const signup = await req('POST', '/auth/v1/signup', { email, password: senha }, false);
TOKEN = signup.json?.access_token;
if (!TOKEN) {
  const login = await req('POST', '/auth/v1/token?grant_type=password', { email, password: senha }, false);
  TOKEN = login.json?.access_token;
}
if (!TOKEN) { console.error('não consegui autenticar o usuário de teste:', signup.json); process.exit(1); }
const USER_ID = JSON.parse(atob(TOKEN.split('.')[1])).sub;
console.log(`cliente de teste: ${email}\nuser_id: ${USER_ID}\n`);

const cliente = await req('POST', '/rest/v1/clientes',
  { loja_id: LOJA, user_id: USER_ID, nome: 'QA Blindagem', telefone: '11999999999' });
const CLIENTE_ID = cliente.json?.[0]?.id ?? null;

// ── 2. Pedido legítimo, mas com totais FORJADOS pelo "browser" ───────────
const ped = await req('POST', '/rest/v1/pedidos', {
  loja_id: LOJA, tipo_pedido: 'RETIRADA_BALCAO', identificador_cliente: 'QA Blindagem',
  telefone_contato: '11999999999', cliente_id: CLIENTE_ID, cliente_user_id: USER_ID,
  subtotal: 0.01, taxa_entrega: 0, desconto: 0, valor_total: 0.01,
});
const PEDIDO_ID = ped.json?.[0]?.id;
linha('cliente logado cria pedido', ped.ok, `HTTP ${ped.status}`);
if (!PEDIDO_ID) { console.error(ped.json); process.exit(1); }

// ── 3. Item com produto real, mas preço forjado em R$0,01 ────────────────
const item = await req('POST', '/rest/v1/itens_pedido', {
  pedido_id: PEDIDO_ID, produto_id: PRODUTO, nome_produto: 'X-PAULISTA',
  preco_unitario: 0.01, quantidade: 1,
});
linha('cliente insere item do catálogo', item.ok, `HTTP ${item.status}`);

// ── 4. FRAUDES que precisam ser barradas ─────────────────────────────────
const semProduto = await req('POST', '/rest/v1/itens_pedido', {
  pedido_id: PEDIDO_ID, produto_id: null, nome_produto: 'Picanha (forjado)',
  preco_unitario: 0.01, quantidade: 1,
});
linha('fraude: item sem produto_id', !semProduto.ok,
  `HTTP ${semProduto.status} ${String(semProduto.json?.message ?? '').slice(0, 40)}`);

const outraLoja = await req('POST', '/rest/v1/itens_pedido', {
  pedido_id: PEDIDO_ID, produto_id: PRODUTO_ALHEIO, nome_produto: 'produto de outra loja',
  preco_unitario: 0.01, quantidade: 1,
});
linha('fraude: produto de outra loja', !outraLoja.ok,
  `HTTP ${outraLoja.status} ${String(outraLoja.json?.message ?? '').slice(0, 40)}`);

// A taxa só pode ser forjada no INSERT: o cliente não tem policy de UPDATE em
// `pedidos` (um PATCH casa zero linhas e volta 200 sem gravar nada — foi o que
// confundiu a primeira versão deste teste). O ataque real é nascer negativo.
const taxaNeg = await req('POST', '/rest/v1/pedidos', {
  loja_id: LOJA, tipo_pedido: 'DELIVERY', identificador_cliente: 'QA fraude taxa',
  cliente_user_id: USER_ID, subtotal: 60, taxa_entrega: -999, desconto: 0, valor_total: 60,
});
linha('fraude: taxa_entrega negativa no INSERT', !taxaNeg.ok,
  `HTTP ${taxaNeg.status} ${String(taxaNeg.json?.message ?? '').slice(0, 45)}`);

const descNeg = await req('POST', '/rest/v1/pedidos', {
  loja_id: LOJA, tipo_pedido: 'RETIRADA_BALCAO', identificador_cliente: 'QA fraude total',
  cliente_user_id: USER_ID, subtotal: 60, taxa_entrega: 0, desconto: 0, valor_total: -500,
});
linha('fraude: valor_total negativo no INSERT', !descNeg.ok,
  `HTTP ${descNeg.status} ${String(descNeg.json?.message ?? '').slice(0, 45)}`);

const pedidoAlheio = await req('POST', '/rest/v1/pedidos', {
  loja_id: LOJA, tipo_pedido: 'RETIRADA_BALCAO', identificador_cliente: 'QA pedido de outro',
  cliente_user_id: '00000000-0000-0000-0000-000000000000',
  subtotal: 10, taxa_entrega: 0, desconto: 0, valor_total: 10,
});
linha('fraude: pedido em nome de outro usuário', !pedidoAlheio.ok,
  `HTTP ${pedidoAlheio.status} ${String(pedidoAlheio.json?.message ?? '').slice(0, 45)}`);

const opcaoNeg = await req('POST', '/rest/v1/itens_pedido_opcoes', {
  item_id: item.json?.[0]?.id, nome_opcao: 'desconto forjado', preco_adicional: -30,
});
linha('fraude: complemento com preço negativo', !opcaoNeg.ok,
  `HTTP ${opcaoNeg.status} ${String(opcaoNeg.json?.message ?? '').slice(0, 40)}`);

// ── 5. O cliente não pode chamar o recálculo nem quitar o próprio pedido ──
// (fn_recalcular_pedido é EXECUTE só de service_role — quem chama é a edge
//  function de Pix/cartão. O valor cobrado é conferido por SQL, fora daqui.)
const recalc = await req('POST', '/rest/v1/rpc/fn_recalcular_pedido', { p_pedido_id: PEDIDO_ID });
linha('cliente NÃO executa fn_recalcular_pedido', !recalc.ok, `HTTP ${recalc.status}`);

const marcarPago = await req('PATCH', `/rest/v1/pagamentos?pedido_id=eq.${PEDIDO_ID}`,
  { status: 'PAGO', data_pagamento: new Date().toISOString() });
const pagos = Array.isArray(marcarPago.json) ? marcarPago.json.length : 0;
linha('fraude: cliente marca pagamento como PAGO', pagos === 0,
  `HTTP ${marcarPago.status}, ${pagos} linha(s) alterada(s)`);

const confirmarAlheio = await req('POST', '/rest/v1/rpc/fn_cliente_confirmar_recebimento',
  { p_pedido_id: '00000000-0000-0000-0000-000000000000' });
linha('fraude: confirmar recebimento de pedido alheio', !confirmarAlheio.ok,
  `HTTP ${confirmarAlheio.status} ${String(confirmarAlheio.json?.message ?? '').slice(0, 45)}`);

// ── 6. Limpeza ───────────────────────────────────────────────────────────
console.log('\nlimpando...');
console.log(JSON.stringify({ PEDIDO_ID, CLIENTE_ID, USER_ID, email }));
