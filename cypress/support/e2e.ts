import './commands';
import '@cypress/code-coverage/support';

// ── Idioma FIXO em pt-BR para toda a suite ───────────────────────────────────
//
// O app escolhe o idioma por `navigator.language` quando nao ha preferencia
// salva (src/contexts/I18nContext.tsx). O runner do GitHub Actions e `en-US` e
// a maquina de desenvolvimento e pt-BR — entao a MESMA suite renderizava em
// ingles no CI e em portugues local.
//
// Como todas as assercoes daqui procuram texto em portugues ("Sair da conta",
// "Aceitar Todos", "Por que este pedido esta sendo cancelado?"), o E2E ficou
// vermelho no CI de 21/08 a 01/09/2026 passando local o tempo todo. O
// screenshot da falha mostra a tela inteira em ingles, com o banner de LGPD de
// pe porque o helper procurava o titulo em portugues.
//
// `window:before:load` roda antes do bundle da aplicacao, e o provider le o
// localStorage antes de olhar para o navigator — entao fixar aqui torna a
// suite independente da locale de quem roda.
Cypress.on('window:before:load', (win) => {
  win.localStorage.setItem('miseon_idioma', 'pt-BR');
});
