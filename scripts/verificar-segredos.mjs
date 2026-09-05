#!/usr/bin/env node
/**
 * Barreira contra commit de segredo.
 *
 * O repositório MiseOn é PÚBLICO. Segredo commitado aqui é segredo
 * vazado — e o histórico do Git é permanente: apagar depois não
 * desfaz, porque clones, forks e scrapers já copiaram.
 *
 * Roda no pre-commit sobre os arquivos em stage. Para uma varredura
 * completa da árvore: node scripts/verificar-segredos.mjs --tudo
 */
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

// `forte` = padrão inconfundível, dispara sempre. Um segredo de verdade
// não vira falso positivo só porque a linha diz "example" ou lê de env —
// aliás `Deno.env.get('X') || 'segredo-literal'` foi exatamente a forma
// do vazamento que originou este script.
const REGRAS = [
  { forte: true,  nome: 'Chave privada (PEM)',    re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { forte: true,  nome: 'Token pessoal Supabase', re: /\bsbp_[a-f0-9]{40,}\b/ },
  { forte: true,  nome: 'Chave de API Groq',      re: /\bgsk_[A-Za-z0-9]{40,}\b/ },
  { forte: true,  nome: 'Chave de API OpenAI',    re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { forte: true,  nome: 'Token do GitHub',        re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { forte: true,  nome: 'Chave AWS',              re: /\bAKIA[0-9A-Z]{16}\b/ },
  { forte: true,  nome: 'Senha de app do Gmail',  re: /['"][a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4}['"]/ },
  // Credenciais Efí: o formato é inconfundível (prefixo + 40 hex). Estas
  // estavam hardcoded em scripts locais que, por sorte, o .gitignore pegou
  // antes do primeiro commit — a barreira precisa pegar na próxima.
  { forte: true,  nome: 'Client secret Efí',      re: /\bClient_Secret_[0-9a-f]{40}\b/ },
  { forte: true,  nome: 'Client ID Efí',          re: /\bClient_Id_[0-9a-f]{40}\b/ },
  { forte: false, nome: 'JWT',                    re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { forte: false, nome: 'Senha literal em atribuição', re: /(password|senha|passwd|pwd)\s*[:=]\s*['"][^'"\s]{8,}['"]/i },
];

// Onde senha literal é esperada e inofensiva.
const IGNORAR_CAMINHO = [
  /(^|[\\/])node_modules[\\/]/,
  /(^|[\\/])dist[\\/]/,
  /(^|[\\/])\.git[\\/]/,
  /package-lock\.json$/,
  /\.(png|jpe?g|gif|webp|svg|mp4|mov|zip|ico|woff2?|ttf)$/i,
  /scripts[\\/]verificar-segredos\.mjs$/, // este arquivo contém os próprios padrões
];

// Isenção aplicada SÓ aos padrões fracos: valor entre aspas que é
// visivelmente placeholder, ou atribuição que não guarda literal nenhum.
const PLACEHOLDER = [
  /['"]<[^'"]*>['"]/,                                   // "<SUA_CHAVE>"
  /['"][^'"]*(exemplo|example|placeholder|troque|altere|cole aqui|xxx|\.\.\.)[^'"]*['"]/i,
  /[:=]\s*(process\.env|Deno\.env\.get|import\.meta\.env|current_setting)\b[^'"]*$/,
];

const tudo = process.argv.includes('--tudo');

const arquivos = execSync(
  tudo ? 'git ls-files' : 'git diff --cached --name-only --diff-filter=ACM',
  { encoding: 'utf8' },
)
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => !IGNORAR_CAMINHO.some((re) => re.test(f)));

const achados = [];

for (const arquivo of arquivos) {
  let conteudo;
  try {
    if (statSync(arquivo).size > 2_000_000) continue;
    conteudo = readFileSync(arquivo, 'utf8');
  } catch {
    continue; // binário, apagado ou ilegível
  }

  const ehPlaceholder = (linha) => PLACEHOLDER.some((re) => re.test(linha));

  conteudo.split('\n').forEach((linha, i) => {
    for (const regra of REGRAS) {
      if (!regra.re.test(linha)) continue;
      if (!regra.forte && ehPlaceholder(linha)) continue;
      achados.push({ arquivo, linha: i + 1, regra: regra.nome });
      break;
    }
  });
}

if (achados.length === 0) {
  if (tudo) console.log('Nenhum segredo encontrado nos arquivos rastreados.');
  process.exit(0);
}

console.error('\n\x1b[41m\x1b[97m  COMMIT BLOQUEADO — possível segredo detectado  \x1b[0m\n');
for (const a of achados) {
  console.error(`  ${a.arquivo}:${a.linha}  →  ${a.regra}`);
}
console.error(`
  O repositório é PÚBLICO. Um segredo commitado aqui fica no
  histórico para sempre, mesmo que você apague no commit seguinte.

  O que fazer:
    1. Tire o valor do código e leia de variável de ambiente
       (process.env / Deno.env.get / current_setting).
    2. Guarde o valor no cofre certo: Supabase Secrets, Vercel Env
       ou .env.local (que já está no .gitignore).
    3. Se o valor já foi usado em algum lugar, ROTACIONE.

  Se for falso positivo, revise o padrão em scripts/verificar-segredos.mjs.
`);
process.exit(1);
