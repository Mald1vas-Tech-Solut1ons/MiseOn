/**
 * Põe o `.env.local` dentro de `process.env` antes das suítes de integração.
 *
 * Sem isto, rodar a integração exigia exportar três variáveis na mão a cada
 * vez. Parece detalhe; não é. O portão em `gate.ts` marca a suíte como BLOCKED
 * quando falta credencial, e uma suíte que só roda se a pessoa lembrar de um
 * ritual é uma suíte que, na prática, não roda — foi exatamente o que
 * aconteceu entre 10/09 e 11/09/2026, com oito arquivos BLOCKED cobrindo
 * código que já estava em produção.
 *
 * O Vite só injeta variáveis com prefixo `VITE_`, e só em `import.meta.env`.
 * `SUPABASE_SERVICE_ROLE_KEY` não tem o prefixo (de propósito: não pode vazar
 * para o bundle do navegador), então precisa deste caminho explícito, que roda
 * apenas em teste.
 */
import fs from 'node:fs';
import path from 'node:path';

const CHAVES = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const arquivo = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(arquivo)) {
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const igual = linha.indexOf('=');
    if (igual < 1 || linha.trimStart().startsWith('#')) continue;
    const chave = linha.slice(0, igual).trim();
    // Só o que a integração precisa. Carregar o arquivo inteiro traria chave de
    // Efí, Meta e iFood para dentro do processo de teste sem necessidade.
    if (!CHAVES.includes(chave)) continue;
    // Variável já exportada no ambiente vence o arquivo: é como o CI injeta as
    // credenciais dele.
    if (process.env[chave]) continue;
    process.env[chave] = linha.slice(igual + 1).trim().replace(/^["']|["']$/g, '');
  }
}
