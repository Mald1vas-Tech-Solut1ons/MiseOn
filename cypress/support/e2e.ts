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
// Fixamos as DUAS fontes que o provider consulta, nao so a primeira.
//
// A primeira tentativa fixou apenas o localStorage. No CI a suite melhorou de
// 4 falhas para 1, mas a tela de /admin/pedidos AINDA renderizou em ingles
// ("Why is this order being cancelled?") — ou seja, naquele carregamento o
// valor fixado nao chegou a ser lido, e o provider caiu no navigator.
//
// Nao vale a pena caçar o porque desse carregamento especifico: o objetivo do
// ambiente de teste e ser deterministico, e para isso as duas fontes precisam
// dizer pt-BR. Fixar so uma deixa a suite dependendo de qual delas venceu a
// corrida — que e exatamente o tipo de teste que passa aqui e quebra la.
Cypress.on('window:before:load', (win) => {
  win.localStorage.setItem('miseon_idioma', 'pt-BR');
  Object.defineProperty(win.navigator, 'language', { value: 'pt-BR', configurable: true });
  Object.defineProperty(win.navigator, 'languages', { value: ['pt-BR', 'pt'], configurable: true });
});
