// Cobrança Pix REAL, ponta a ponta, contra produção.
// Cria pedido + pagamento PIX e chama pix-criar-cobranca de verdade.
// Se voltar txid e copia-e-cola, o Pix funciona. Se não, mostra o erro cru.
import fs from 'fs';

const URL = 'https://zzuxklwhaoisuuvndtfw.supabase.co';
const env = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
const ANON = env.find(l => l.startsWith('VITE_SUPABASE_ANON_KEY='))
  .slice('VITE_SUPABASE_ANON_KEY='.length).trim().replace(/^"|"$/g, '');

const LOJA    = '34004cf0-6b5a-485b-9bf4-079aaad9aa47';
const PRODUTO = 'df896f99-8266-47b9-beca-151159a11e44'; // X-PAULISTA R$32
const email = 'qa-pix@miseon-teste.local';
// A senha do usuario de teste NAO fica no codigo: o repositorio e publico e
// segredo commitado fica no historico para sempre. Defina QA_SENHA no
// ambiente antes de rodar:
//   QA_SENHA='<algo forte>' node scripts/qa/regressao-pix-real.mjs
const senha = process.env.QA_SENHA;
if (!senha) {
  console.error('Defina QA_SENHA no ambiente antes de rodar este script.');
  process.exit(1);
}


let TOKEN = null;
const req = async (metodo, caminho, corpo, tokenOverride) => {
  const r = await fetch(`${URL}${caminho}`, {
    method: metodo,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${tokenOverride ?? TOKEN ?? ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, ok: r.ok, json: j };
};

// login (a conta precisa existir e estar confirmada)
let s = await req('POST', '/auth/v1/token?grant_type=password', { email, password: senha }, ANON);
TOKEN = s.json?.access_token;
if (!TOKEN) {
  const up = await req('POST', '/auth/v1/signup', { email, password: senha }, ANON);
  TOKEN = up.json?.access_token;
  if (!TOKEN) {
    console.log('PRECISA_CONFIRMAR_EMAIL', up.json?.id ?? up.json?.user?.id ?? '');
    process.exit(2);
  }
}
const USER_ID = JSON.parse(atob(TOKEN.split('.')[1])).sub;
console.log('user_id:', USER_ID);

const ped = await req('POST', '/rest/v1/pedidos', {
  loja_id: LOJA, tipo_pedido: 'RETIRADA_BALCAO', identificador_cliente: 'QA PIX',
  telefone_contato: '11999999999', cliente_user_id: USER_ID,
  subtotal: 32, taxa_entrega: 0, desconto: 0, valor_total: 32,
});
const PEDIDO_ID = ped.json?.[0]?.id;
console.log('pedido:', ped.status, PEDIDO_ID ?? JSON.stringify(ped.json).slice(0, 200));
if (!PEDIDO_ID) process.exit(1);

const it = await req('POST', '/rest/v1/itens_pedido', {
  pedido_id: PEDIDO_ID, produto_id: PRODUTO, nome_produto: 'X-PAULISTA',
  preco_unitario: 32, quantidade: 1,
});
console.log('item:', it.status);

const pg = await req('POST', '/rest/v1/pagamentos', {
  pedido_id: PEDIDO_ID, metodo: 'PIX', valor_pago: 32,
});
console.log('pagamento:', pg.status, pg.ok ? '' : JSON.stringify(pg.json).slice(0, 200));

console.log('\n─── chamando pix-criar-cobranca de verdade ───');
const r = await fetch(`${URL}/functions/v1/pix-criar-cobranca`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ pedido_id: PEDIDO_ID }),
});
const txt = await r.text();
console.log('HTTP', r.status);
console.log(txt.slice(0, 1200));

console.log('\nPEDIDO_PARA_LIMPAR:', PEDIDO_ID);
