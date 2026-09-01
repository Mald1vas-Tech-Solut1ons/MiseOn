/** Mensagem de erro legível de uma chamada a Edge Function.
 *
 *  POR QUE ISTO EXISTE:
 *  quando a function responde 2xx, o supabase-js entrega o corpo em `data` e
 *  ler `data.error` basta. Quando ela responde NÃO-2xx, `data` vem `null` e o
 *  corpo fica escondido dentro de `error.context` — um `Response` ainda não
 *  lido. Quem só olha `data?.error || error?.message` mostra ao usuário o
 *  texto genérico do SDK ("Edge Function returned a non-2xx status code") no
 *  lugar da explicação em português que a function tomou o trabalho de
 *  escrever.
 *
 *  Foi exatamente esse detalhe que travou o `conta-atualizar` em devolver 200
 *  até para "Não autenticado": corrigir o status quebraria a mensagem na tela.
 *  Com este helper, os dois passam a funcionar — status HTTP correto E texto
 *  útil para quem está olhando.
 *
 *  Devolve `null` quando não houve erro nenhum.
 */
export async function mensagemDeErro(
  error: unknown,
  data: { error?: string } | null,
  padrao: string,
): Promise<string | null> {
  if (data?.error) return data.error;
  if (!error) return null;

  // FunctionsHttpError guarda a resposta crua em `context`.
  const contexto = (error as { context?: Response })?.context;
  if (contexto && typeof contexto.json === 'function') {
    try {
      const corpo = await contexto.clone().json();
      if (corpo?.error) return String(corpo.error);
    } catch {
      // Corpo não-JSON ou já consumido: cai no padrão abaixo.
    }
  }

  return (error as { message?: string })?.message || padrao;
}
