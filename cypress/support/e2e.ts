import './commands';
import '@cypress/code-coverage/support';

// ── Idioma da suite ──────────────────────────────────────────────────────────
//
// Todas as assercoes daqui afirmam texto em portugues. O app, porem, escolhe o
// idioma por `navigator.language` quando nao ha preferencia salva
// (src/contexts/I18nContext.tsx) — e o runner do GitHub Actions e en-US
// enquanto a maquina de desenvolvimento e pt-BR. A suite ficou vermelha no CI
// de 21/08 a 01/09/2026 exatamente por isso, passando local o tempo todo.
//
// A fixacao NAO mora aqui. Duas tentativas por `window:before:load` (gravar
// `miseon_idioma` no localStorage e sobrescrever `navigator.language`)
// funcionaram na maquina local e nao chegaram na janela do app no runner
// Linux. Medido dentro do proprio CI, com os dois pins no lugar:
//
//     nav=en-US  ls=null  html=en-US
//
// Quem fixa e o BUILD: `VITE_IDIOMA_PADRAO=pt-BR`, definido em
// .github/workflows/e2e.yml e lido pelo provider. E o unico ponto que as duas
// maquinas enxergam igual.
//
// Para rodar a suite localmente numa maquina que nao seja pt-BR, builde com a
// mesma variavel:
//
//     VITE_IDIOMA_PADRAO=pt-BR npm run build
