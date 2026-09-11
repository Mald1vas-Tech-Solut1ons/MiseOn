/**
 * Onde as suítes de integração podem escrever.
 *
 * ─── O QUE ESTAVA ERRADO ───────────────────────────────────────────────────
 * Seis suítes começavam assim:
 *
 *     const { data: loja } = await db.from('lojas').select('id').limit(1).single();
 *
 * "A primeira loja que vier". Depois disso elas criam usuário, produto,
 * pedido, comanda, estação de KDS e movimentação de estoque DENTRO dessa loja,
 * e alteram colunas dela (`aberto_manual`, `painel_tv_tipos`,
 * `frete_gratis_valor_minimo`).
 *
 * Com o `.env.local` apontando para produção — que é como ele está — essa
 * primeira loja podia ser a do cliente real. Não é risco teórico: é o motivo
 * pelo qual estas oito suítes nunca foram executadas e seguem marcadas como
 * BLOCKED desde 10/09/2026, deixando sem prova de integração código que já
 * está em produção.
 *
 * ─── A REGRA ───────────────────────────────────────────────────────────────
 * Nenhuma suíte escolhe loja. Cada arquivo de teste CRIA a sua, com slug que
 * não se confunde com nada (`qa-descartavel-…`), e a apaga no fim. É o padrão
 * que `entrega-taxa-e-porta` já usava e que funcionou — aqui ele deixa de ser
 * exceção e vira o único caminho.
 *
 * Uma loja por ARQUIVO, não por suíte inteira: o Vitest roda arquivos em
 * paralelo, e loja compartilhada entre eles reintroduz interferência cruzada
 * pela porta dos fundos.
 *
 * E há uma trava de alvo: qualquer id que não venha daqui é recusado por
 * `exigirDescartavel`, para nenhuma suíte futura voltar ao `limit(1)` sem que
 * alguém perceba.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Prefixo impossível de confundir com loja de verdade. */
export const PREFIXO_DESCARTAVEL = 'qa-descartavel-';

const criadas = new Set<string>();

/**
 * Cria uma loja exclusiva deste arquivo de teste.
 *
 * `etiqueta` só serve para leitura humana quando algo sobra no banco — o
 * sufixo aleatório é o que garante unicidade entre execuções paralelas.
 */
export async function criarLojaDescartavel(
  db: SupabaseClient,
  etiqueta: string,
  extra: Record<string, unknown> = {},
): Promise<{ id: string; slug: string }> {
  const slug = `${PREFIXO_DESCARTAVEL}${etiqueta}-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await db
    .from('lojas')
    .insert({ nome: `QA descartável · ${etiqueta}`, slug, ...extra })
    .select('id, slug')
    .single();

  if (error || !data) {
    throw new Error(
      `Não consegui criar a loja descartável para "${etiqueta}": ${error?.message ?? 'sem retorno'}. `
      + 'A suíte NÃO cai para outra loja de propósito — escrever numa loja que não é de teste é o risco que este módulo existe para impedir.',
    );
  }

  criadas.add(data.id);
  return data;
}

/**
 * Recusa qualquer loja que não tenha nascido aqui.
 *
 * Chamada no início das suítes. Serve contra o erro que já aconteceu: alguém
 * (inclusive eu) reaproveitar `lojas.limit(1)` numa suíte nova e só descobrir
 * depois que o teste escreveu no tenant de um cliente.
 */
export function exigirDescartavel(lojaId: string, contexto = 'esta suíte'): void {
  if (!criadas.has(lojaId)) {
    throw new Error(
      `${contexto} tentou usar a loja ${lojaId}, que não foi criada por criarLojaDescartavel(). `
      + 'Suíte de integração escreve apenas em loja descartável.',
    );
  }
}

/**
 * Apaga a loja e tudo que pendurou nela.
 *
 * Roda no `afterAll`. Se falhar, o erro vai para o console e não derruba a
 * suíte: lixo em loja descartável é problema de faxina, e mascarar o
 * resultado do teste por causa dele seria pior.
 */
export async function apagarLojaDescartavel(db: SupabaseClient, lojaId: string): Promise<void> {
  if (!lojaId) return;
  const { error } = await db.from('lojas').delete().eq('id', lojaId);
  if (error) {
    console.warn(`Nao consegui apagar a loja descartavel ${lojaId}: ${error.message}`);
    return;
  }
  criadas.delete(lojaId);
}

/**
 * Faxina de sobras de execuções anteriores.
 *
 * Teste que quebra no meio não chega ao `afterAll`. Sem isto, a cada corrida
 * mal terminada fica uma loja órfã no banco para sempre.
 */
export async function limparSobras(db: SupabaseClient): Promise<number> {
  const { data, error } = await db
    .from('lojas')
    .delete()
    .like('slug', `${PREFIXO_DESCARTAVEL}%`)
    .select('id');
  if (error) {
    console.warn(`Nao consegui limpar sobras de loja descartavel: ${error.message}`);
    return 0;
  }
  return (data ?? []).length;
}
