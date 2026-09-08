/**
 * Gate das suítes de integração — fim do falso-verde.
 *
 * Histórico: as suítes usavam `describe.runIf(isConfigured)`. Sem
 * SUPABASE_SERVICE_ROLE_KEY elas NÃO falhavam — simplesmente deixavam de
 * existir no relatório. Em 05/09/2026 o go-live do Sprint 1 pescou um bug
 * real de produção (42804: a RPC nova de estoque nasceu quebrada) que
 * essa suíte deveria ter pego: ela "passava" porque nunca rodava.
 *
 * Regras daqui pra frente:
 *  - configurado: roda. O job de integração do CI injeta a service key de
 *    um Supabase local (Docker) e a suíte roda de verdade.
 *  - sem credencial local: a suíte APARECE no relatório como BLOCKED /
 *    NOT RUN — nunca some em silêncio.
 *  - sem credencial onde integração é obrigatória (INTEGRACAO_OBRIGATORIA=1,
 *    presente só no job de integração do CI): BLOCKED vira FALHA. O job de
 *    unidade do CI roda `vitest run` sem service key de propósito — nele o
 *    BLOCKED aparece como skip explícito, sem quebrar um pipeline que não
 *    pediu integração.
 */
import { describe, it } from 'vitest';

export function gated(
  isConfigured: boolean,
  nome: string,
  fn: () => void,
  credencialFaltante = 'SUPABASE_SERVICE_ROLE_KEY',
): void {
  if (isConfigured) {
    describe(nome, fn);
    return;
  }

  const rotulo = `${nome} — BLOCKED`;
  const motivo = `BLOCKED — NOT RUN: ${credencialFaltante} ausente; a suíte não foi executada (não é PASSED).`;

  if (process.env.INTEGRACAO_OBRIGATORIA === '1') {
    // Pipeline que promete integração não pode ficar verde sem ela.
    describe(rotulo, () => {
      it(motivo, () => {
        throw new Error(motivo);
      });
    });
    return;
  }

  // Ambiente sem obrigação (máquina local, job de unidade): skip explícito,
  // visível no relatório, em vez de suíte que nunca existiu.
  describe(rotulo, () => {
    it.skip(motivo, () => {});
  });
}