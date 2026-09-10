-- ============================================================================
-- MODIFICADORES QUE A OPERAÇÃO REAL EXIGE — por segmento
--
-- O PROBLEMA MEDIDO (10/09/2026, produção): das 8 lojas cadastradas, apenas
-- UMA tem grupo de opções. As sete lojas de demonstração — pizzaria,
-- hamburgueria, bar, açaiteria, por quilo, à la carte, dark kitchen — não têm
-- nenhum. E "Ponto da carne" não existe em lugar nenhum do banco, nem na loja
-- de hamburgueria.
--
-- POR QUE ISSO É UM DEFEITO, E NÃO UMA FALTA DE CADASTRO: numa hamburgueria o
-- ponto da carne não é opcional — é o item mais devolvido do setor quando
-- ninguém pergunta. Num bar, "com gelo e limão" define o preparo do drink. A
-- forma de eliminar esse erro não é treinar o atendente a lembrar: é o sistema
-- NÃO DEIXAR fechar o item sem a escolha. É para isso que serve
-- `min_escolhas = 1` — o grupo vira obrigatório e o item não entra no carrinho
-- sem resposta, seja pelo PDV, pelo garçom ou pelo cliente no QR.
--
-- E o modificador não morre no carrinho: ele viaja com o item até a praça de
-- preparo (Sprint 18, `kds_ticket_itens` com opções validadas pelo catálogo).
-- O cozinheiro lê "Ao ponto" na comanda, não numa observação em texto livre
-- que alguém pode ter escrito como "ao pto" ou esquecido de digitar.
--
-- O QUE ESTA MIGRATION FAZ:
--  1. cria `fn_semear_opcoes_segmento(loja)`, idempotente, que aplica os
--     grupos que cada nicho realmente usa;
--  2. liga essa função ao seed de segmento já existente (`fn_semear_loja`),
--     para toda loja nova nascer com eles;
--  3. aplica nas lojas de demonstração que já existem — é o que o prospecto
--     abre para decidir se compra.
--
-- INVARIANTE PRESERVADA: preço. Toda opção nasce com `preco_adicional = 0`
-- exceto onde o adicional é um item de venda de verdade (bacon extra, borda
-- recheada). Chutar preço de adicional contamina ticket médio e margem sem
-- aviso — mesma regra que o seed já aplica para custo de insumo.
-- ============================================================================

create or replace function public.fn_semear_opcoes_segmento(p_loja uuid, p_segmento text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_seg    text;
  v_grupos int := 0;
  v_opcoes int := 0;
  r        record;
  v_grupo  uuid;
begin
  if p_loja is null then raise exception 'loja obrigatoria'; end if;

  -- Mesma porta de autorização do seed de produtos: só o admin da loja.
  -- `auth.uid() is null` é a execução administrativa (migration/backfill).
  if auth.uid() is not null and coalesce(fn_meu_papel(p_loja), '') <> 'admin' then
    raise exception 'Apenas o administrador da loja pode aplicar os modificadores do segmento.';
  end if;

  v_seg := upper(coalesce(nullif(btrim(p_segmento), ''),
                          (select segmento_negocio from lojas where id = p_loja), 'GERAL'));
  if v_seg = 'GERAL' then v_seg := 'HAMBURGUERIA'; end if;

  -- Catálogo de modificadores por nicho. `alvo` casa com o nome do produto:
  -- ponto da carne não vai em batata frita nem em refrigerante.
  for r in
    with regras(segmentos, alvo, grupo, min_e, max_e, ordem, opcoes) as (
      values
      -- ── Hambúrguer: o ponto é obrigatório e não tem preço ──────────────
      (array['HAMBURGUERIA','DARK_KITCHEN','RESTAURANTE_A_LA_CARTE'],
       '(burguer|burger|hamb|blend|smash|bovino|picanha|costela|carne|filé|file|mignon|bife|contrafilé|alcatra|maminha|fraldinha)',
       'Ponto da carne', 1, 1, 1,
       '[{"n":"Mal passado","p":0},{"n":"Ao ponto para menos","p":0},{"n":"Ao ponto","p":0},{"n":"Ao ponto para mais","p":0},{"n":"Bem passado","p":0}]'::jsonb),

      (array['HAMBURGUERIA','DARK_KITCHEN'],
       '(burguer|burger|hamb|blend|smash)',
       'Tirar ingrediente', 0, 5, 2,
       '[{"n":"Sem cebola","p":0},{"n":"Sem tomate","p":0},{"n":"Sem alface","p":0},{"n":"Sem molho","p":0},{"n":"Sem picles","p":0}]'::jsonb),

      (array['RESTAURANTE_A_LA_CARTE'],
       '(salmão|salmao|peixe|atum|tilápia|tilapia)',
       'Ponto do peixe', 1, 1, 1,
       '[{"n":"Ao ponto","p":0},{"n":"Bem passado","p":0},{"n":"Selado por fora","p":0}]'::jsonb),

      -- ── Bar: preparo do drink e da bebida ──────────────────────────────
      (array['BAR_PUB'],
       '(chopp|cerveja|refri|refrigerante|água|agua|suco|drink|caipirinha|gin|whisky|vodka|dose)',
       'Como servir', 1, 1, 1,
       '[{"n":"Com gelo e limão","p":0},{"n":"Com gelo, sem limão","p":0},{"n":"Sem gelo","p":0},{"n":"Bem gelado, sem gelo","p":0}]'::jsonb),

      (array['BAR_PUB','RESTAURANTE_A_LA_CARTE'],
       '(porção|porcao|petisco|frita|isca|calabresa|torresmo)',
       'Dividir para quantos', 0, 1, 2,
       '[{"n":"Prato único","p":0},{"n":"Dois pratos","p":0},{"n":"Três pratos","p":0},{"n":"Quatro pratos","p":0}]'::jsonb),

      -- ── Pizzaria: borda e ponto de forno ───────────────────────────────
      (array['PIZZARIA'],
       '^(pizza)',
       'Borda', 1, 1, 1,
       '[{"n":"Sem borda recheada","p":0},{"n":"Borda de catupiry","p":8},{"n":"Borda de cheddar","p":8}]'::jsonb),

      (array['PIZZARIA'],
       '^(pizza)',
       'Ponto da massa', 1, 1, 2,
       '[{"n":"Normal","p":0},{"n":"Bem assada","p":0},{"n":"Pouco assada","p":0}]'::jsonb),

      -- ── Açaiteria: complementos ────────────────────────────────────────
      (array['ACAITERIA'],
       '(açaí|acai|copo|tigela|barca)',
       'Complementos', 0, 5, 1,
       '[{"n":"Granola","p":0},{"n":"Leite em pó","p":0},{"n":"Banana","p":0},{"n":"Morango","p":3},{"n":"Paçoca","p":0},{"n":"Leite condensado","p":0}]'::jsonb),

      -- ── Por quilo: o prato quente montado no balcão ────────────────────
      (array['RESTAURANTE_POR_QUILO'],
       '(marmit|prato|quentinha|executivo)',
       'Ponto do arroz e feijão', 0, 2, 1,
       '[{"n":"Pouco arroz","p":0},{"n":"Sem feijão","p":0},{"n":"Caldo à parte","p":0}]'::jsonb)
    )
    select regras.alvo, regras.grupo, regras.min_e, regras.max_e, regras.ordem, regras.opcoes, p.id as produto_id
      from regras
      join produtos p on p.loja_id = p_loja and p.nome ~* regras.alvo
     where v_seg = any(regras.segmentos)
  loop
    -- Idempotente: se o dono já criou um grupo com esse nome no produto,
    -- respeita o que ele fez. Decisão do lojista nunca é sobrescrita.
    if exists (select 1 from grupos_opcoes g where g.produto_id = r.produto_id and lower(g.nome) = lower(r.grupo)) then
      continue;
    end if;

    insert into grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (r.produto_id, r.grupo, r.min_e, r.max_e, r.ordem)
    returning id into v_grupo;
    v_grupos := v_grupos + 1;

    insert into opcoes (grupo_id, nome, preco_adicional, ordem)
    select v_grupo, o->>'n', coalesce((o->>'p')::numeric, 0), (idx - 1)
      from jsonb_array_elements(r.opcoes) with ordinality as t(o, idx);
    v_opcoes := v_opcoes + (select jsonb_array_length(r.opcoes));
  end loop;

  return jsonb_build_object('segmento', v_seg, 'grupos', v_grupos, 'opcoes', v_opcoes);
end;
$function$;

comment on function public.fn_semear_opcoes_segmento(uuid, text) is
  'Cria os grupos de modificadores que cada segmento exige na prática (ponto da carne, gelo e limão, borda). Idempotente: nunca sobrescreve grupo já criado pelo lojista.';

revoke execute on function public.fn_semear_opcoes_segmento(uuid, text) from public, anon;
grant execute on function public.fn_semear_opcoes_segmento(uuid, text) to authenticated;

-- ── Liga ao seed de segmento: loja nova já nasce com os modificadores ───────
-- `fn_semear_loja` é a porta única de criação da base de um segmento. Em vez
-- de duplicar o catálogo aqui, ela passa a chamar esta função no fim, depois
-- de os produtos existirem (os grupos casam por nome de produto).
do $seed$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fn_semear_loja';

  if v_def is null then
    raise notice 'fn_semear_loja nao existe neste banco; pulando a ligacao.';
    return;
  end if;

  if v_def like '%fn_semear_opcoes_segmento%' then
    raise notice 'fn_semear_loja ja chama fn_semear_opcoes_segmento.';
    return;
  end if;

  -- A função monta um jsonb de retorno no fim. Inserimos a chamada logo antes
  -- do `return jsonb_build_object(` final, preservando todo o resto do corpo
  -- vigente em produção (que pode divergir da migration versionada).
  v_def := regexp_replace(
    v_def,
    '(\s+)return jsonb_build_object\(''semeado'',true',
    E'\\1perform fn_semear_opcoes_segmento(p_loja, v_seg);\\1return jsonb_build_object(''semeado'',true',
    ''
  );
  execute v_def;
end;
$seed$;

-- ── Backfill: as lojas de demonstração que o prospecto abre hoje ────────────
do $demo$
declare
  r record;
  v_res jsonb;
begin
  for r in select id, nome, segmento_negocio from lojas where slug like 'demo-%' or segmento_negocio is not null loop
    begin
      v_res := fn_semear_opcoes_segmento(r.id, r.segmento_negocio);
      raise notice '% (%): %', r.nome, r.segmento_negocio, v_res;
    exception when others then
      raise notice 'falhou em % : %', r.nome, sqlerrm;
    end;
  end loop;
end;
$demo$;
