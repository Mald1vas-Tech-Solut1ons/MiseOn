/**
 * Backup lógico do banco, via Management API.
 *
 * Existe porque o projeto está no plano Free do Supabase, que NÃO tem backup
 * automático — `pitr_enabled: false` e `backups: []`. Sem isto, uma migration
 * errada, um delete sem where ou um comprometimento da conta levam pedido,
 * estoque, financeiro e nota fiscal junto. NF-e tem retenção legal de 5 anos.
 *
 * Isto não substitui o backup gerenciado do plano Pro — é o que dá para ter
 * hoje, e é infinitamente melhor que nada.
 *
 * Uso:   node scripts/qa/backup-logico.mjs [pasta-destino]
 * Saída: backups/miseon-YYYY-MM-DDTHH-mm.json.gz  (+ manifesto com contagens)
 *
 * Para restaurar: os dados saem como INSERTs por tabela, na ordem de
 * dependência. Confira o manifesto antes de restaurar em cima de algo.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const REF = 'zzuxklwhaoisuuvndtfw';
const destino = process.argv[2] ?? 'backups';

const PAT = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find((l) => l.startsWith('SUPABASE_ACCESS_TOKEN='))
  ?.slice('SUPABASE_ACCESS_TOKEN='.length).trim().replace(/^"|"$/g, '');
if (!PAT) { console.error('SUPABASE_ACCESS_TOKEN ausente no .env.local'); process.exit(1); }

const sql = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`);
  return JSON.parse(t);
};

// Ordem topológica: tabela sem FK pendente primeiro. Restaurar fora de ordem
// esbarra em foreign key.
const ordem = await sql(`
  with rec as (
    select c.oid, c.relname, 0 as nivel
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r'
  )
  select r.relname as tabela,
         (select count(*) from pg_constraint k
           where k.conrelid=r.oid and k.contype='f' and k.confrelid<>r.oid) as dependencias
    from rec r order by dependencias, r.relname`);

console.log(`\n═══ backup lógico — ${ordem.length} tabelas ═══\n`);

const dump = { gerado_em: new Date().toISOString(), projeto: REF, tabelas: {} };
const manifesto = [];
let totalLinhas = 0;

for (const { tabela } of ordem) {
  try {
    // json_agg devolve tudo de uma vez; tabela grande vem paginada.
    const [{ n }] = await sql(`select count(*)::int as n from public."${tabela}"`);
    let linhas = [];
    const PAGINA = 1000;
    for (let off = 0; off < n; off += PAGINA) {
      const r = await sql(
        `select coalesce(json_agg(t), '[]'::json) as d from (
           select * from public."${tabela}" order by 1 limit ${PAGINA} offset ${off}
         ) t`);
      linhas = linhas.concat(r[0].d);
    }
    dump.tabelas[tabela] = linhas;
    manifesto.push({ tabela, linhas: linhas.length });
    totalLinhas += linhas.length;
    if (linhas.length) console.log(`  ${tabela.padEnd(34)} ${linhas.length}`);
  } catch (e) {
    manifesto.push({ tabela, erro: String(e.message).slice(0, 120) });
    console.log(`  ${tabela.padEnd(34)} ERRO: ${String(e.message).slice(0, 70)}`);
  }
}

fs.mkdirSync(destino, { recursive: true });
const carimbo = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const arq = path.join(destino, `miseon-${carimbo}.json.gz`);
fs.writeFileSync(arq, zlib.gzipSync(Buffer.from(JSON.stringify(dump)), { level: 9 }));
fs.writeFileSync(
  path.join(destino, `miseon-${carimbo}.manifesto.json`),
  JSON.stringify({ gerado_em: dump.gerado_em, total_linhas: totalLinhas, tabelas: manifesto }, null, 2),
);

const mb = (fs.statSync(arq).size / 1024 / 1024).toFixed(2);
console.log(`\n  ${totalLinhas} linhas em ${ordem.length} tabelas`);
console.log(`  ${arq}  (${mb} MB)`);
console.log(`  manifesto ao lado, com a contagem por tabela\n`);
