import { supabase } from './supabase';

/**
 * Captura de erro em produção.
 *
 * Não havia nada: nenhum Sentry/Datadog no projeto. Sem isto, defeito em
 * produção só aparece quando o lojista liga — o que funciona com um cliente
 * e deixa de funcionar com cinquenta.
 *
 * Grava via RPC `fn_registrar_erro` (SECURITY DEFINER). A tabela não aceita
 * INSERT direto, e o servidor agrupa por impressão digital + hora, então um
 * laço de render quebrado não inunda o banco.
 *
 * Regra de ouro: monitoramento nunca pode derrubar a tela. Toda falha aqui é
 * engolida — se o registro do erro falhar, o usuário não fica sabendo.
 */

let lojaAtual: string | null = null;
let instalado = false;

/** O AdminLayout informa a loja assim que sabe qual é, para o erro vir com dono. */
export function definirLojaDoMonitor(lojaId: string | null) {
  lojaAtual = lojaId;
}

// Erros idênticos em sequência (um render quebrado dispara dezenas por
// segundo) são cortados aqui, antes mesmo de virar requisição.
const recentes = new Map<string, number>();
const JANELA_MS = 30_000;

function repetidoAgora(chave: string): boolean {
  const agora = Date.now();
  const visto = recentes.get(chave);
  if (visto && agora - visto < JANELA_MS) return true;
  recentes.set(chave, agora);
  if (recentes.size > 100) recentes.clear();
  return false;
}

export async function registrarErro(
  mensagem: string,
  opcoes: { contexto?: string; stack?: string; origem?: string } = {},
): Promise<void> {
  try {
    const contexto = opcoes.contexto ?? window.location.pathname;
    if (repetidoAgora(`${contexto}|${mensagem}`)) return;

    await supabase.rpc('fn_registrar_erro', {
      p_origem: opcoes.origem ?? 'browser',
      p_mensagem: mensagem,
      p_contexto: contexto,
      p_stack: opcoes.stack ?? null,
      p_url: window.location.href,
      p_user_agent: navigator.userAgent,
      p_loja_id: lojaAtual,
    });
  } catch {
    // Silêncio proposital: monitoramento que quebra a tela é pior que a
    // ausência dele.
  }
}

/** Liga os dois ganchos globais do browser. Chamado uma vez, no main.tsx. */
export function instalarMonitorDeErros() {
  if (instalado) return;
  instalado = true;

  window.addEventListener('error', (evento) => {
    registrarErro(evento.message || 'erro não identificado', {
      stack: evento.error?.stack,
      contexto: window.location.pathname,
    });
  });

  // Promise rejeitada sem catch é a forma mais comum de erro sumir sem deixar
  // rastro numa app que fala com API o tempo todo.
  window.addEventListener('unhandledrejection', (evento) => {
    const motivo = evento.reason;
    registrarErro(
      typeof motivo === 'string' ? motivo : (motivo?.message ?? 'promise rejeitada sem tratamento'),
      { stack: motivo?.stack, contexto: window.location.pathname },
    );
  });
}
