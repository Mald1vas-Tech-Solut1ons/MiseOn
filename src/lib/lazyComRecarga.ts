import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * `lazy()` que sobrevive a um deploy feito com a aba aberta.
 *
 * O PROBLEMA, MEDIDO. Cada build troca o hash dos chunks. Quem está com o
 * sistema aberto continua com o index.html antigo na memória, e no primeiro
 * clique que carrega uma rota nova pede um arquivo que não existe mais:
 *
 *     Failed to fetch dynamically imported module:
 *     https://miseon.app.br/assets/PainelPedidos-DJPC29I3.js
 *
 * Em 22/09/2026, às 16:49, foi exatamente isso que aconteceu com o
 * /admin/pedidos do Lanche do Paulista, minutos depois de uma publicação —
 * e a tela simplesmente não respondeu. No painel do superadmin esse é o maior
 * grupo de erros que existe: 11 dos 35 tipos registrados, sempre o mesmo
 * texto, em rotas diferentes, desde que o push passou a publicar na hora.
 *
 * O QUE ISTO FAZ. A falha é recuperável e a recuperação é trivial: o arquivo
 * novo está lá, só com outro nome, e basta recarregar para pegar o index.html
 * atual. Então em vez de mostrar tela quebrada, recarrega uma vez.
 *
 * A TRAVA CONTRA LAÇO. Recarregar por erro de carregamento é perigoso: se o
 * arquivo estiver realmente indisponível, a página entraria em ciclo infinito
 * de recarga. Por isso a permissão fica em `sessionStorage` e é gasta na
 * primeira tentativa. Se falhar de novo antes de o app subir, o erro sobe de
 * verdade — vira registro no painel, que é o comportamento honesto. Quem
 * devolve a permissão é `liberarNovaRecarga()`, chamada só depois que o app
 * ficou de pé, para que a próxima publicação do dia também seja coberta.
 */

const CHAVE = 'miseon_recarga_por_chunk';

/** sessionStorage pode lançar (aba anônima, cookies bloqueados). Nunca derruba o app por isso. */
function podeRecarregar(): boolean {
  try {
    if (sessionStorage.getItem(CHAVE)) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
    return true;
  } catch {
    // Sem armazenamento não há como impedir laço: melhor não recarregar.
    return false;
  }
}

/**
 * Devolve a permissão de recarga. Chamada quando o app já está de pé — a
 * partir daí, uma publicação nova que quebre um chunk pode ser recuperada de
 * novo, na mesma sessão.
 */
export function liberarNovaRecarga(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    // Nada a fazer: sem armazenamento, o caminho de recarga já estava desligado.
  }
}

/**
 * A restrição é a mesma que o `lazy` do React usa, e por um motivo prático:
 * qualquer tipo mais fechado apaga as props das telas que recebem alguma
 * (`forcedSlug`, `lojaId`) e não infere nas que exportam por nome, com
 * `.then((m) => ({ default: m.X }))`. Aqui o genérico só precisa atravessar.
 */
 
export function lazyComRecarga<T extends ComponentType<any>>(
  importar: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await importar();
    } catch (erro) {
      if (!podeRecarregar()) throw erro;

      window.location.reload();
      // A página está indo embora. Uma promessa que nunca resolve evita que o
      // React pinte a tela de erro no meio da recarga.
      return new Promise<{ default: T }>(() => {});
    }
  });
}
