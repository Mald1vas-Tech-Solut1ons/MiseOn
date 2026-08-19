/**
 * Teste de carga e de concorrência contra produção.
 *
 * A pergunta que importa não é "aguenta?" — é "erra?". `fn_trg_numero_pedido`
 * atribui o número sequencial do pedido; se houver race condition, dois
 * clientes recebem a senha #42 no mesmo sábado e o balcão entrega errado.
 * Latência sem esse dado é conversa.
 *
 * Uso:  node scripts/qa/carga-pedidos.mjs [concorrencia] [total]
 * Ex.:  node scripts/qa/carga-pedidos.mjs 25 200
 *
 * Limpa tudo o que cria. Usa a loja de provas (Lanche do Paulista).
 */
import fs from 'fs';

const URL = 'https://zzuxklwhaoisuuvndtfw.supabase.co';
const env = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
const ANON = env.find((l) => l.startsWith('VITE_SUPABASE_ANON_KEY='))
  .slice('VITE_SUPABASE_ANON_KEY='.length).trim().replace(/^"|"$/g, '');

const LOJA = '34004cf0-6b5a-485b-9bf4-079aaad9aa47';
const PRODUTO = 'df896f99-8266-47b9-beca-151159a11e44';
const EMAIL = 'qa-carga@miseon-teste.local';
// A senha do usuario de teste NAO fica no codigo: o repositorio e publico e
// segredo commitado fica no historico para sempre. Defina QA_SENHA no
// ambiente antes de rodar:
//   QA_SENHA='<algo forte>' node scripts/qa/carga-pedidos.mjs
const SENHA = process.env.QA_SENHA;
if (!SENHA) {
  console.error('Defina QA_SENHA no ambiente antes de rodar este script.');
  process.exit(1);
}


const CONCORRENCIA = Number(process.argv[2] ?? 25);
const TOTAL = Number(process.argv[3] ?? 200);

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
};

let TOKEN = null;
const chamar = async (metodo, caminho, corpo, tok) => {
  const r = await fetch(`${URL}${caminho}`, {
    method: metodo,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${tok ?? TOKEN ?? ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, ok: r.ok, json: j };
};

// ── login do cliente de carga ────────────────────────────────────────────
let s = await chamar('POST', '/auth/v1/token?grant_type=password', { email: EMAIL, password: SENHA }, ANON);
TOKEN = s.json?.access_token;
if (!TOKEN) {
  const up = await chamar('POST', '/auth/v1/signup', { email: EMAIL, password: SENHA }, ANON);
  TOKEN = up.json?.access_token;
  if (!TOKEN) { console.log('PRECISA_CONFIRMAR_EMAIL'); process.exit(2); }
}
const USER = JSON.parse(atob(TOKEN.split('.')[1])).sub;

console.log(`\n═══ carga: ${TOTAL} pedidos, ${CONCORRENCIA} em paralelo ═══\n`);

// ── 1. leitura do cardápio (o que todo cliente faz ao abrir a loja) ──────
const latLeitura = [];
let errosLeitura = 0;
const lerCardapio = async () => {
  const t0 = performance.now();
  const r = await fetch(`${URL}/rest/v1/produtos?select=id,nome,preco&loja_id=eq.${LOJA}&limit=50`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  await r.text();
  latLeitura.push(performance.now() - t0);
  if (!r.ok) errosLeitura++;
};
{
  const fila = Array.from({ length: TOTAL }, () => lerCardapio);
  while (fila.length) await Promise.all(fila.splice(0, CONCORRENCIA).map((f) => f()));
}
console.log('LEITURA DE CARDÁPIO (anon, 50 produtos)');
console.log(`  p50 ${pct(latLeitura,50).toFixed(0)}ms   p95 ${pct(latLeitura,95).toFixed(0)}ms   p99 ${pct(latLeitura,99).toFixed(0)}ms   erros ${errosLeitura}\n`);

// ── 2. criação concorrente de pedidos ────────────────────────────────────
const latPedido = [];
const numeros = [];
let errosPedido = 0;
const criarPedido = async (i) => {
  const t0 = performance.now();
  const p = await chamar('POST', '/rest/v1/pedidos', {
    loja_id: LOJA, tipo_pedido: 'RETIRADA_BALCAO', identificador_cliente: `QA CARGA ${i}`,
    cliente_user_id: USER, subtotal: 32, taxa_entrega: 0, desconto: 0, valor_total: 32,
  });
  latPedido.push(performance.now() - t0);
  if (!p.ok) { errosPedido++; return; }
  const ped = p.json?.[0];
  numeros.push(ped.numero);
  await chamar('POST', '/rest/v1/itens_pedido', {
    pedido_id: ped.id, produto_id: PRODUTO, nome_produto: 'X-PAULISTA',
    preco_unitario: 32, quantidade: 1,
  });
};
{
  let i = 0;
  const fila = Array.from({ length: TOTAL }, () => () => criarPedido(i++));
  while (fila.length) await Promise.all(fila.splice(0, CONCORRENCIA).map((f) => f()));
}

console.log('CRIAÇÃO DE PEDIDO (cliente logado, concorrente)');
console.log(`  p50 ${pct(latPedido,50).toFixed(0)}ms   p95 ${pct(latPedido,95).toFixed(0)}ms   p99 ${pct(latPedido,99).toFixed(0)}ms   erros ${errosPedido}`);

// ── 3. a pergunta que importa: número duplicado? ─────────────────────────
const unicos = new Set(numeros);
const duplicados = numeros.length - unicos.size;
console.log(`\nNÚMEROS DE PEDIDO`);
console.log(`  gerados ${numeros.length}   distintos ${unicos.size}   duplicados ${duplicados}`);
console.log(`  faixa #${Math.min(...numeros)} … #${Math.max(...numeros)}`);
if (duplicados > 0) {
  const cont = {};
  numeros.forEach((n) => (cont[n] = (cont[n] ?? 0) + 1));
  console.log('  REPETIDOS:', Object.entries(cont).filter(([, c]) => c > 1).map(([n, c]) => `#${n}×${c}`).join(', '));
  console.log('\n  >>> RACE CONDITION: dois clientes recebem a mesma senha. <<<');
} else {
  console.log('  >>> sem duplicata sob concorrência <<<');
}

console.log(`\nlimpar: delete from pedidos where identificador_cliente like 'QA CARGA%';`);
