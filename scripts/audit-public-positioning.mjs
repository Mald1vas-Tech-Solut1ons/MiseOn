import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_ROUTES, DUPLICATE_ROUTES } from './public-routes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORT = path.join(ROOT, 'docs', 'auditoria-rotas-publicas.md');
const BASE = 'https://miseon.app.br';
const routes = [...PUBLIC_ROUTES.map((route) => route.path), ...DUPLICATE_ROUTES];
const ctaTargets = ['/cadastre-se', '/contato', '/api-whatsapp-restaurantes'];

function capture(html, regex) {
  return html.match(regex)?.[1]?.trim() ?? '';
}

function htmlFile(route) {
  if (route === '/') return path.join(DIST, 'index.html');
  return path.join(DIST, route.replace(/^\//, ''), 'index.html');
}

function schemaTypes(html) {
  const types = new Set();
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(match[1]);
      const visit = (value) => {
        if (!value || typeof value !== 'object') return;
        if (typeof value['@type'] === 'string') types.add(value['@type']);
        for (const child of Object.values(value)) visit(child);
      };
      visit(json);
    } catch {
      types.add('JSON-LD inválido');
    }
  }
  return [...types];
}

const results = [];

for (const route of routes) {
  const html = await readFile(htmlFile(route), 'utf8');
  const title = capture(html, /<title>([\s\S]*?)<\/title>/i);
  const description = capture(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const canonical = capture(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
  const ogTitle = capture(html, /<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i);
  const ogDescription = capture(html, /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i);
  const ogUrl = capture(html, /<meta\s+property=["']og:url["']\s+content=["']([^"']*)["']/i);
  const h1Count = (html.match(/<h1(?:\s|>)/gi) ?? []).length;
  const internalLinks = [...html.matchAll(/href=["'](\/[^"'#?]*)/gi)].map((match) => match[1]);
  const ctas = ctaTargets.filter((target) => internalLinks.includes(target));
  const schemas = schemaTypes(html);
  const errors = [];

  if (!title) errors.push('title ausente');
  if (!description) errors.push('description ausente');
  if (!canonical.startsWith(BASE)) errors.push('canonical inválido');
  if (h1Count !== 1) errors.push(`H1=${h1Count}`);
  if (ogTitle !== title) errors.push('Open Graph title divergente');
  if (ogDescription !== description) errors.push('Open Graph description divergente');
  if (ogUrl !== canonical) errors.push('Open Graph URL divergente');
  if (ctas.length !== ctaTargets.length) errors.push('trilha de CTAs incompleta');
  if (new Set(internalLinks).size < 4) errors.push('links internos insuficientes');
  if (schemas.length === 0 || schemas.includes('JSON-LD inválido')) errors.push('schema ausente ou inválido');
  if (/\b(?:na|da|pela) MiseOn\b/i.test(html)) errors.push('gênero da marca inconsistente');
  if (/depoimentos? de clientes reais|case(?:s)? reais? de clientes?/i.test(html)) errors.push('prova social não comprovada');

  results.push({ route, title, canonical, h1Count, ctas, schemas, errors });
}

const failures = results.filter((result) => result.errors.length > 0);
const generatedAt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Sao_Paulo',
}).format(new Date());

const lines = [
  '# Auditoria automatizada das rotas públicas',
  '',
  `**Gerada em:** ${generatedAt}`,
  `**Escopo:** ${results.length} arquivos HTML produzidos pelo build e pelo prerender.`,
  '',
  '## Critérios verificados',
  '',
  '- title e meta description;',
  '- canonical e Open Graph coerentes;',
  '- exatamente um H1;',
  '- os três CTAs comerciais e links internos;',
  '- JSON-LD válido;',
  '- gênero da marca e ausência de prova social não comprovada.',
  '',
  `## Resultado: ${failures.length === 0 ? 'APROVADO' : 'REPROVADO'}`,
  '',
  `- Rotas aprovadas: ${results.length - failures.length}`,
  `- Rotas reprovadas: ${failures.length}`,
  '',
  '| Rota | H1 | CTAs | Schema | Resultado |',
  '|---|---:|---:|---|---|',
  ...results.map((result) =>
    `| ${result.route} | ${result.h1Count} | ${result.ctas.length}/3 | ${result.schemas.join(', ')} | ${result.errors.length ? result.errors.join('; ') : 'OK'} |`
  ),
  '',
  '## Limites desta verificação',
  '',
  '- O relatório verifica o HTML gerado e não substitui revisão humana da redação nem teste visual no navegador.',
  '- O perfil oficial do LinkedIn não está representado no repositório e continua dependendo da URL ou acesso ao perfil.',
  '- Integrações externas continuam sujeitas ao estado e às credenciais de cada loja.',
  '',
];

await writeFile(REPORT, lines.join('\n'), 'utf8');

if (failures.length) {
  for (const failure of failures) {
    console.error(`${failure.route}: ${failure.errors.join('; ')}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Auditoria aprovada: ${results.length} rotas públicas; relatório em docs/auditoria-rotas-publicas.md.`);
}
