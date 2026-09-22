/**
 * Rastro do cadastro de loja ("Torne-se um lojista").
 *
 * Em 22/09/2026 uma lead real entrou com Google, fez um login e sumiu — e só
 * deu para saber consultando o banco na mão. Cada passo desta tela agora vira
 * evento no servidor (`fn_onboarding_registrar`), e o superadmin lê o funil.
 *
 * Nunca atrapalha o cadastro: falha de rede aqui é silenciosa. E o `.then` é
 * obrigatório — a consulta do supabase-js é preguiçosa e, sem ninguém para
 * consumi-la, não sai do navegador (foi assim que o cancelamento do totem
 * passou duas semanas sem funcionar).
 */
import { supabase } from './supabase';

export type EventoOnboarding = 'abriu' | 'etapa' | 'erro_validacao' | 'erro_criar' | 'loja_criada';

export type RascunhoOnboarding = {
  nomeLoja?: string;
  segmento?: string;
  atendeSalao?: boolean;
  fazEntregas?: boolean;
};

export function registrarOnboarding(
  evento: EventoOnboarding,
  etapa?: string,
  detalhe?: string,
  rascunho?: RascunhoOnboarding,
): void {
  try {
    supabase.rpc('fn_onboarding_registrar', {
      p_evento: evento,
      p_etapa: etapa ?? null,
      p_detalhe: detalhe ?? null,
      p_rascunho: rascunho ?? null,
    }).then(() => undefined, () => undefined);
  } catch {
    // Rastro é acessório: nunca derruba a tela.
  }
}

/** O que a pessoa já tinha digitado, para quem volta continuar de onde parou. */
export async function carregarRascunhoOnboarding(): Promise<RascunhoOnboarding> {
  try {
    const { data } = await supabase.rpc('fn_onboarding_meu_rascunho');
    return (data && typeof data === 'object' ? data : {}) as RascunhoOnboarding;
  } catch {
    return {};
  }
}
