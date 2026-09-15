-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Inventário de abertura — reconcilia lotes com o saldo (Lanche do Paulista)║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- PROBLEMA
--
-- 51 insumos com `quantidade_atual` preenchido e NENHUM lote por trás. O saldo
-- foi semeado direto, sem passar pelas RPCs que criam lote — e é o lote que
-- carrega o custo PEPS. Resultado: a tela de estoque mostra quantidade, a de
-- custo não tem de onde tirar preço, e as duas discordam.
--
-- DECISÃO: o saldo do cadastro é a verdade
--
-- É o número que o lojista vê e que ele confere contando a prateleira. Os
-- lotes se ajustam a ele, nunca o contrário.
--
--   saldo > soma dos lotes  → entra um LOTE DE ABERTURA com a diferença,
--                             ao custo do cadastro (preço ÷ embalagem)
--   saldo < soma dos lotes  → os lotes mais ANTIGOS cedem primeiro (PEPS),
--                             até a soma bater
--
-- As compras reais já lançadas (óleo, cebola, iogurte, vindos de NFC-e) NÃO
-- são apagadas: elas carregam o custo que a casa pagou de verdade. O lote de
-- abertura só cobre o que faltava.
--
-- Escopo: SÓ o Lanche do Paulista, que é o tenant de provas. Não toca em
-- nenhuma outra loja.
--
-- Idempotente: rodar de novo não cria abertura em cima de abertura.

do $inv$
declare
  v_loja uuid := '34004cf0-6b5a-485b-9bf4-079aaad9aa47';
  r        record;
  v_lotes  numeric;
  v_falta  numeric;
  v_custo  numeric;
  v_sobra  numeric;
  l        record;
  v_tira   numeric;
  v_abriu  int := 0;
  v_cortou int := 0;
begin
  for r in
    select i.id, i.nome, i.quantidade_atual, i.unidade_medida,
           i.preco_embalagem, i.qtd_embalagem
    from public.insumos i
    where i.loja_id = v_loja and i.ativo and coalesce(i.is_preparo,false) = false
  loop
    select coalesce(sum(lo.quantidade_restante),0) into v_lotes
    from public.lotes_estoque lo
    where lo.insumo_id = r.id and lo.quantidade_restante > 0;

    v_falta := coalesce(r.quantidade_atual,0) - v_lotes;
    if abs(v_falta) <= 0.01 then continue; end if;

    if v_falta > 0 then
      -- Falta lote: abre um pelo custo do cadastro. Sem custo cadastrado o
      -- lote nasceria valendo zero e contaminaria a margem — melhor pular e
      -- deixar o insumo aparecer na lista do que corrigir.
      v_custo := r.preco_embalagem / nullif(r.qtd_embalagem, 0);
      if v_custo is null or v_custo <= 0 then continue; end if;

      insert into public.lotes_estoque
        (loja_id, insumo_id, quantidade_inicial, quantidade_restante,
         custo_unitario, lote_fornecedor, ocorrido_em)
      values (v_loja, r.id, v_falta, v_falta, v_custo, 'ABERTURA', now());
      v_abriu := v_abriu + 1;

    else
      -- Sobra lote: os mais antigos cedem primeiro, que é a ordem do PEPS.
      v_sobra := -v_falta;
      for l in
        select lo.id, lo.quantidade_restante
        from public.lotes_estoque lo
        where lo.insumo_id = r.id and lo.quantidade_restante > 0
        order by lo.criado_em, lo.id
      loop
        exit when v_sobra <= 0.01;
        v_tira := least(l.quantidade_restante, v_sobra);
        update public.lotes_estoque
           set quantidade_restante = quantidade_restante - v_tira
         where id = l.id;
        v_sobra := v_sobra - v_tira;
      end loop;
      v_cortou := v_cortou + 1;
    end if;
  end loop;

  raise notice 'lotes de abertura criados: % · insumos com lote reduzido: %', v_abriu, v_cortou;
end
$inv$;
