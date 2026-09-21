// Executa um arquivo .sql contra a Management API (uso interno de QA).
import { readFile } from 'node:fs/promises';

const [, , arquivo] = process.argv;
const token = (await readFile('.env.local', 'utf8'))
  .split(/\r?\n/).find((l) => l.startsWith('SUPABASE_ACCESS_TOKEN='))
  .split('=').slice(1).join('=').replace(/"/g, '').trim();

const sql = await readFile(arquivo, 'utf8');
const resp = await fetch('https://api.supabase.com/v1/projects/zzuxklwhaoisuuvndtfw/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
console.log(resp.status, await resp.text());
