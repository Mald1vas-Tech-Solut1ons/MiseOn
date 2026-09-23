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
 *  Em 23/09/2026 só 1 das 64 chamadas do app usava `mensagemDeErro`. Em vez de
 *  remendar tela por tela, `instalarMensagemDeErroNasFunctions` (chamado em
 *  `supabase.ts`) reescreve `error.message` na origem: toda chamada existente
 *  e futura passa a receber o texto da function, sem mudar uma linha.
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

  const doCorpo = await mensagemDoContexto(error);
  if (doCorpo) return doCorpo;

  return (error as { message?: string })?.message || padrao;
}

/** Chaves que as functions usam para explicar o erro, na ordem de preferência.
 *  Medido no código: `error` (251 respostas), depois `erro`, `mensagem`,
 *  `message` e `motivo`. */
const CHAVES_DE_MENSAGEM = ['error', 'erro', 'mensagem', 'message', 'motivo'] as const;

export function mensagemDoCorpo(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== 'object') return null;
  for (const chave of CHAVES_DE_MENSAGEM) {
    const valor = (corpo as Record<string, unknown>)[chave];
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
  }
  return null;
}

async function mensagemDoContexto(error: unknown): Promise<string | null> {
  // FunctionsHttpError guarda a resposta crua em `context`. `clone()` para que
  // quem ainda lê `error.context.json()` por conta própria continue podendo.
  const contexto = (error as { context?: Response })?.context;
  if (!contexto || typeof contexto.clone !== 'function') return null;
  try {
    return mensagemDoCorpo(await contexto.clone().json());
  } catch {
    return null; // corpo não-JSON ou já consumido
  }
}

const SEM_CONEXAO = 'Não foi possível falar com o servidor. Confira a internet e tente de novo.';
const FALHA_GENERICA = 'O servidor não conseguiu concluir a operação. Tente de novo em instantes.';

/** Troca, no próprio objeto de erro, o texto do SDK pelo texto útil. */
export async function traduzirErroDeFunction(error: unknown): Promise<void> {
  if (!error || typeof error !== 'object') return;
  const e = error as { name?: string; message?: string };
  const original = e.message;

  const doCorpo = await mensagemDoContexto(error);
  let traduzida: string | null = doCorpo;
  if (!traduzida && e.name === 'FunctionsFetchError') traduzida = SEM_CONEXAO;
  if (!traduzida && (e.name === 'FunctionsHttpError' || e.name === 'FunctionsRelayError')) {
    traduzida = FALHA_GENERICA;
  }
  if (!traduzida || traduzida === original) return;

  // O texto do SDK fica no console: "Failed to send a request" também é o
  // sintoma de CORS barrando header custom, e quem depura precisa dele.
  console.warn(`[edge function] ${original}`);
  try {
    e.message = traduzida;
  } catch {
    // message não gravável: segue com o original
  }
}

type Invoke = (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>;
const INSTALADO = Symbol.for('miseon.mensagemDeErroNasFunctions');

/** `supabase.functions` é um getter que cria um FunctionsClient NOVO a cada
 *  acesso — remendar a instância não pegaria em chamada nenhuma. O remendo vai
 *  no protótipo, tirado de uma instância que o próprio cliente criou: assim é
 *  garantidamente a mesma classe que ele usa, mesmo havendo duas cópias do
 *  functions-js no node_modules. Idempotente. */
export function instalarMensagemDeErroNasFunctions(cliente: { functions: object }): void {
  const prototipo = Object.getPrototypeOf(cliente.functions) as Record<PropertyKey, unknown>;
  if (!prototipo || prototipo[INSTALADO] || typeof prototipo.invoke !== 'function') return;
  const original = prototipo.invoke as Invoke;
  prototipo.invoke = async function (this: unknown, ...args: unknown[]) {
    const resultado = await original.apply(this, args);
    if (resultado?.error) await traduzirErroDeFunction(resultado.error);
    return resultado;
  };
  prototipo[INSTALADO] = true;
}
