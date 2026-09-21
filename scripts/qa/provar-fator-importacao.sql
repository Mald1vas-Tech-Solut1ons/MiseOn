-- Prova do conserto do fator inventado. Roda em transação com ROLLBACK:
-- não grava nada. Tenant de provas lanchepaulista. Nunca toca naturezaba.
begin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"9055defe-4e1f-4d90-9d20-be08682b955f","role":"authenticated"}';

do $$
declare
  v_loja   uuid := '34004cf0-6b5a-485b-9bf4-079aaad9aa47';
  v_insumo uuid;
  v_saldo_antes numeric;
  v_preco_antes numeric;
  v_saldo_depois numeric;
  v_preco_depois numeric;
  v_res    jsonb;
  v_lotes  integer;
begin
  -- Insumo temporário controlado em GRAMAS, como a cenoura do caso real.
  insert into public.insumos (loja_id, nome, unidade_medida, quantidade_atual,
                              estoque_minimo, preco_embalagem, qtd_embalagem, ativo)
  values (v_loja, 'ZZ QA CENOURA FATOR', 'g', 0, 0, 0, 1, true)
  returning id into v_insumo;

  select quantidade_atual, preco_embalagem into v_saldo_antes, v_preco_antes
  from public.insumos where id = v_insumo;

  -- CENÁRIO 1 — fator 0 (a tela disse "não sei"): a linha tem de ser RECUSADA.
  v_res := public.fn_importar_nfce(
    v_loja, '', 'FORNECEDOR QA',
    jsonb_build_array(jsonb_build_object(
      'insumo_id', v_insumo,
      'nome', 'CENOURA KG',
      'unidade', 'g',
      'qtd_nota', 1,
      'fator', 0,
      'custo_total', 5.48
    )),
    true, now(), 'SOMAR');

  select quantidade_atual, preco_embalagem into v_saldo_depois, v_preco_depois
  from public.insumos where id = v_insumo;
  select count(*) into v_lotes from public.lotes_estoque where insumo_id = v_insumo;

  raise notice 'CENARIO 1 (fator 0): recusados=% lancados=% saldo %->% preco %->% lotes=%',
    v_res->>'itens_recusados', v_res->>'itens_lancados',
    v_saldo_antes, v_saldo_depois, v_preco_antes, v_preco_depois, v_lotes;

  if (v_res->>'itens_recusados')::int <> 1 then
    raise exception 'FALHOU: fator 0 deveria recusar 1 linha, recusou %', v_res->>'itens_recusados';
  end if;
  if v_saldo_depois <> v_saldo_antes then
    raise exception 'FALHOU: saldo mudou com fator 0 (% -> %)', v_saldo_antes, v_saldo_depois;
  end if;
  if v_preco_depois is distinct from v_preco_antes then
    raise exception 'FALHOU: preco mudou com fator 0 (% -> %)', v_preco_antes, v_preco_depois;
  end if;
  if v_lotes <> 0 then
    raise exception 'FALHOU: lote criado com fator 0 (%)', v_lotes;
  end if;

  -- CENÁRIO 2 — fator 1000 (conversão correta kg -> g): tem de LANÇAR certo.
  v_res := public.fn_importar_nfce(
    v_loja, '', 'FORNECEDOR QA',
    jsonb_build_array(jsonb_build_object(
      'insumo_id', v_insumo,
      'nome', 'CENOURA KG',
      'unidade', 'g',
      'qtd_nota', 1,
      'fator', 1000,
      'custo_total', 5.48
    )),
    true, now(), 'SOMAR');

  select quantidade_atual, preco_embalagem into v_saldo_depois, v_preco_depois
  from public.insumos where id = v_insumo;

  raise notice 'CENARIO 2 (fator 1000): lancados=% saldo=% preco_emb=%',
    v_res->>'itens_lancados', v_saldo_depois, v_preco_depois;

  if (v_res->>'itens_lancados')::int <> 1 then
    raise exception 'FALHOU: fator 1000 deveria lancar 1 linha, lancou %', v_res->>'itens_lancados';
  end if;
  if v_saldo_depois <> 1000 then
    raise exception 'FALHOU: fator 1000 deveria entrar 1000 g, entrou %', v_saldo_depois;
  end if;
  -- preco_embalagem = custo/qtd_nota = 5.48; qtd_embalagem = 1000 => custo/g = 0.00548
  if abs(v_preco_depois - 5.48) > 0.001 then
    raise exception 'FALHOU: preco_embalagem deveria ser 5.48, foi %', v_preco_depois;
  end if;

  raise notice 'PROVA OK: fator 0 recusa; fator 1000 converte. O servidor nao inventa mais 1.';
end $$;

-- Devolve uma linha para a API mostrar (a transacao toda e desfeita no rollback).
select 'PROVA OK' as resultado;
rollback;
