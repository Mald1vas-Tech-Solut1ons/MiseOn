/**
 * Publica UMA Edge Function no projeto de produção, pela Management API.
 *
 *   node scripts/deploy-edge-function.mjs cartao-pagar
 *
 * Por que existe: o deploy pelo MCP exige mandar o conteúdo de cada arquivo
 * inline, o que na prática significa reenviar 30 KB de código a cada ajuste.
 * Aqui o script lê os arquivos do disco e monta o multipart igual ao CLI.
 *
 * Ele descobre sozinho quais módulos de `_shared` a função importa (um nível
 * de profundidade basta para o que temos hoje) — esquecer um deles é o erro
 * clássico que derruba a função em produção com "module not found".
 *
 * Lê SUPABASE_ACCESS_TOKEN do .env.local. Nada é impresso além do resultado.
 */
import fs from 'node:fs';
import path from 'node:path';

const REF = 'zzuxklwhaoisuuvndtfw';
const slug = process.argv[2];
if (!slug) {
  console.error('uso: node scripts/deploy-edge-function.mjs <slug-da-funcao>');
  process.exit(1);
}

const env = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
const g = (k) => env.find((l) => l.startsWith(k + '='))?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
const PAT = g('SUPABASE_ACCESS_TOKEN') ?? g('SUPABASE_PAT') ?? g('VITE_SUPABASE_PAT');
if (!PAT) { console.error('SUPABASE_ACCESS_TOKEN ausente no .env.local'); process.exit(1); }

const raizFuncoes = 'supabase/functions';
const entrada = `${raizFuncoes}/${slug}/index.ts`;
if (!fs.existsSync(entrada)) { console.error(`nao encontrei ${entrada}`); process.exit(1); }

/** Caminhos, no formato que o deploy espera: `functions/<...>`. */
const arquivos = new Map();
const visitados = new Set();

function incluir(caminhoNoDisco) {
  if (visitados.has(caminhoNoDisco)) return;
  visitados.add(caminhoNoDisco);
  const conteudo = fs.readFileSync(caminhoNoDisco, 'utf8');
  const nome = 'functions/' + path.relative(raizFuncoes, caminhoNoDisco).split(path.sep).join('/');
  arquivos.set(nome, conteudo);

  // Segue os imports relativos (../_shared/x.ts, ./y.ts) de forma recursiva.
  for (const m of conteudo.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const alvo = path.resolve(path.dirname(caminhoNoDisco), m[1]);
    if (fs.existsSync(alvo)) incluir(alvo);
  }
}
incluir(entrada);

/**
 * `verify_jwt` é PRESERVADO, nunca assumido.
 *
 * Este script já fixava `true`. Em 11/09/2026 isso derrubou a `ifood-polling`:
 * ela estava publicada com `false` de propósito, porque quem a chama é o
 * pg_cron usando o `IFOOD_POLLING_TOKEN` do Vault — um token opaco, de menor
 * privilégio, que NÃO é um JWT. Com `verify_jwt: true` a plataforma recusa a
 * chamada com 401 antes da função rodar, e o coletor de pedidos do iFood
 * simplesmente parou, sem erro nenhum dentro da função para explicar.
 *
 * Um flag de segurança que muda sozinho num deploy de rotina é a pior
 * combinação possível: silencioso e grave. Aqui ele passa a vir do estado
 * atual da função; só muda se alguém pedir explicitamente com --verify-jwt
 * ou --no-verify-jwt.
 */
const pedido = process.argv.includes('--verify-jwt') ? true
  : process.argv.includes('--no-verify-jwt') ? false
  : null;

let verifyJwt = pedido;
if (verifyJwt === null) {
  const atual = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/${slug}`, {
    headers: { Authorization: `Bearer ${PAT}` },
  });
  if (atual.ok) {
    verifyJwt = (await atual.json()).verify_jwt;
  } else if (atual.status === 404) {
    // Função nova: o padrão seguro é exigir JWT. Quem precisar de outro
    // regime passa --no-verify-jwt e fica registrado no comando.
    verifyJwt = true;
  } else {
    console.error(`nao consegui ler o verify_jwt atual (${atual.status}) — abortando em vez de adivinhar`);
    process.exit(1);
  }
}

const metadata = {
  name: slug,
  entrypoint_path: `functions/${slug}/index.ts`,
  verify_jwt: verifyJwt,
  static_patterns: [],
};

const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
for (const [nome, conteudo] of arquivos) {
  form.append('file', new Blob([conteudo], { type: 'application/typescript' }), nome);
}

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=${slug}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${PAT}` },
  body: form,
});
const texto = await r.text();
if (!r.ok) { console.error('deploy falhou', r.status, texto.slice(0, 500)); process.exit(1); }
const j = JSON.parse(texto);
console.log(`publicado: ${j.slug} v${j.version} (${j.status}) verify_jwt=${verifyJwt}`);
console.log('arquivos:', [...arquivos.keys()].join(', '));
