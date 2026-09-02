-- ============================================================================
-- NUTRIÇÃO — AJUSTES QUE SÓ APARECERAM COM O CARDÁPIO CHEIO
-- ============================================================================
-- Aplicados em produção em 2026-09-02, depois de montar o cardápio completo do
-- Lanche do Paulista (16 produtos). Cada um nasceu de um número errado visto na
-- tela, não de revisão teórica. Ver docs/PLANO-NUTRICIONAL-VITRINE.md §5.
--
--  1. Teto de plausibilidade da porção: 1200 g → 900 g. O X-SALADA de 1,1 kg
--     atravessava o crivo, e ele é justamente o caso que originou a verificação.
--  2. Selo de atributo só em prato publicável. Com 1,1 kg de massa fantasma
--     diluindo o valor por 100 g, o X-SALADA ganhava "baixo em calorias".
--  3. Base do critério de atributo: 'g' para sólido, 'ml' para líquido. Estava
--     fixa em 'g', e refrigerante com 39 kcal/100 ml recebia "baixo em calorias"
--     porque o limite de sólidos (40) é o dobro do de líquidos (20).
--  4. Duas regras editoriais de honestidade: "baixo em gordura saturada" exige
--     que o produto tenha alguma gordura, e produto com açúcar adicionado
--     relevante (≥ 5 g/100) não recebe selo de virtude. Um guaraná anunciado
--     como "baixo em sódio" é verdade literal com leitura enganosa.
--  5. Gorduras trans perde o VDR: a IN 75/2020 não estabelece valor diário para
--     ela. Com vdr = 2 g a tabela publicava "0,0 g — 1% VD", número inventado.
--  6. lojas_publicas passa a expor a configuração de exibição nutricional.
--  7. Funções de gatilho deixam de ser chamáveis por /rest/v1/rpc (get_advisors).
-- ============================================================================

-- ── 1 a 4: atributos ────────────────────────────────────────────────────────

create or replace function public.fn_atributos_nutricionais(p_por_100g jsonb, p_base text default 'g')
returns text[]
language sql immutable
set search_path = public
as $$
  select case
    -- Água mineral colecionava selos ("baixo em sódio", "sem açúcar
    -- adicionado"): verdades vazias. Sem energia e sem proteína, sem selo.
    when coalesce((p_por_100g->>'ENERGIA_KCAL')::numeric, 0) < 5
     and coalesce((p_por_100g->>'PROTEINAS')::numeric, 0) = 0
    then '{}'::text[]
    -- Quem tem açúcar adicionado não se anuncia pelo que não tem.
    when coalesce((p_por_100g->>'ACUCARES_ADICIONADOS')::numeric, 0) >= 5
    then array_remove(array[
      case when (p_por_100g->>'PROTEINAS')::numeric >= case when p_base = 'ml' then 6 else 12 end
           then 'ALTO_PROTEINA' end,
      case when (p_por_100g->>'FIBRAS_ALIMENTARES')::numeric >= 6 then 'ALTO_FIBRAS' end
    ], null)
    else array_remove(array[
      case when (p_por_100g->>'PROTEINAS')::numeric >= case when p_base = 'ml' then 6 else 12 end
           then 'ALTO_PROTEINA' end,
      case when (p_por_100g->>'PROTEINAS')::numeric >= case when p_base = 'ml' then 3 else 6 end
            and (p_por_100g->>'PROTEINAS')::numeric <  case when p_base = 'ml' then 6 else 12 end
           then 'FONTE_PROTEINA' end,
      case when (p_por_100g->>'FIBRAS_ALIMENTARES')::numeric >= 6 then 'ALTO_FIBRAS'
           when (p_por_100g->>'FIBRAS_ALIMENTARES')::numeric >= 3 then 'FONTE_FIBRAS' end,
      case when (p_por_100g->>'SODIO')::numeric <= 120 then 'BAIXO_SODIO' end,
      case when (p_por_100g->>'GORDURAS_SATURADAS')::numeric <= 1.5
            and coalesce((p_por_100g->>'GORDURAS_TOTAIS')::numeric, 0) > 0
           then 'BAIXO_GORDURA_SATURADA' end,
      case when (p_por_100g->>'ENERGIA_KCAL')::numeric <= case when p_base = 'ml' then 20 else 40 end
           then 'BAIXO_CALORIAS' end,
      case when p_por_100g ? 'ACUCARES_ADICIONADOS'
            and (p_por_100g->>'ACUCARES_ADICIONADOS')::numeric = 0 then 'SEM_ACUCAR_ADICIONADO' end
    ], null)
  end;
$$;

revoke execute on function public.fn_atributos_nutricionais(jsonb, text) from public;
grant  execute on function public.fn_atributos_nutricionais(jsonb, text) to anon, authenticated;

create or replace function public.fn_recalcular_nutricao_produto(p_produto_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_prod    record;
  v_cfg     record;
  v_linhas  jsonb;
  v_base    jsonb;
  v_massa   numeric;
  v_servida numeric;
  v_porcoes numeric;
  v_peso    numeric;
  v_100g    jsonb;
  v_porcao  jsonb;
  v_alertas jsonb;
  v_publicavel boolean;
  v_base_grandeza text;
begin
  select p.id, p.loja_id, p.nome, p.tipo_venda into v_prod
  from public.produtos p where p.id = p_produto_id;
  if not found then
    raise exception 'Produto % nao encontrado.', p_produto_id;
  end if;

  select * into v_cfg from public.produtos_nutricao_config where produto_id = p_produto_id;

  select coalesce(jsonb_agg(jsonb_build_object('insumo_id', ft.insumo_id, 'quantidade', ft.quantidade_consumida)), '[]'::jsonb)
    into v_linhas
  from public.fichas_tecnicas ft
  where ft.produto_id = p_produto_id;

  -- Revenda: sem ficha, o produto É o insumo apontado na config.
  if v_linhas = '[]'::jsonb and v_cfg.insumo_id is not null then
    v_linhas := jsonb_build_array(jsonb_build_object(
      'insumo_id', v_cfg.insumo_id,
      'quantidade', coalesce(v_cfg.quantidade_insumo, 1)
    ));
  end if;

  -- Bebida: o critério de atributo é o de líquidos (RDC 54/2012).
  v_base_grandeza := coalesce(
    (select n.base_unidade from public.insumos_nutricao n where n.insumo_id = v_cfg.insumo_id), 'g');

  v_base := public.fn_calcular_nutricao_receita(v_linhas, v_prod.loja_id, false);

  v_massa   := coalesce((v_base->>'massa_g')::numeric, 0);
  v_servida := round(v_massa * coalesce(v_cfg.fator_coccao, 1), 2);
  v_porcoes := coalesce(v_cfg.porcoes, 1);
  v_peso    := coalesce(v_cfg.peso_porcao_g, case when v_servida > 0 then round(v_servida / v_porcoes, 2) end);
  v_alertas := coalesce(v_base->'alertas', '[]'::jsonb);

  if v_servida > 0 then
    select coalesce(jsonb_object_agg(k, round(v::numeric * 100 / v_servida, 4)), '{}'::jsonb)
      into v_100g
    from jsonb_each_text(coalesce(v_base->'nutrientes', '{}'::jsonb)) as e(k, v);

    select coalesce(jsonb_object_agg(k, round(v::numeric * coalesce(v_peso, v_servida) / v_servida, 4)), '{}'::jsonb)
      into v_porcao
    from jsonb_each_text(coalesce(v_base->'nutrientes', '{}'::jsonb)) as e(k, v);
  else
    v_100g   := '{}'::jsonb;
    v_porcao := '{}'::jsonb;
  end if;

  if v_prod.tipo_venda is distinct from 'POR_PESO' and v_peso is not null
     and (v_peso < 15 or v_peso > 900) then
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'codigo', 'MASSA_IMPLAUSIVEL',
      'detalhe', format('A porcao calculada e de %s g. Confira as quantidades da ficha e o peso medio dos itens lancados em unidade.', round(v_peso))
    ));
  end if;

  v_publicavel := (
    (v_base->>'status') = 'COMPLETO'
    and jsonb_array_length(v_alertas) = 0
    and coalesce(v_cfg.exibir, true)
    and v_100g <> '{}'::jsonb
  );

  return v_base || jsonb_build_object(
    'massa_servida_g', v_servida,
    'porcoes',         v_porcoes,
    'peso_porcao_g',   v_peso,
    'base_grandeza',   v_base_grandeza,
    'por_100g',        v_100g,
    'por_porcao',      v_porcao,
    'fator_coccao',    coalesce(v_cfg.fator_coccao, 1),
    'metodo_coccao',   v_cfg.metodo_coccao,
    'exibir',          coalesce(v_cfg.exibir, true),
    'alertas',         v_alertas,
    'atributos',       case when v_publicavel
                         then to_jsonb(public.fn_atributos_nutricionais(v_100g, v_base_grandeza))
                         else '[]'::jsonb end,
    'publicavel',      v_publicavel
  );
end;
$$;

revoke execute on function public.fn_recalcular_nutricao_produto(uuid) from public;
grant  execute on function public.fn_recalcular_nutricao_produto(uuid) to authenticated;

-- ── 5: gorduras trans não têm valor diário de referência ────────────────────
update public.nutrientes set vdr = null where codigo = 'GORDURAS_TRANS';

-- ── 6: a vitrine precisa saber como a loja quer publicar ────────────────────
create or replace view public.lojas_publicas as
 SELECT id, slug, nome, descricao, logo_url, banner_url,
    cor_primaria, cor_secundaria, cor_texto, cor_fundo_claro, cor_fundo_escuro,
    fonte, tema_cardapio, telefone, whatsapp, endereco, lat, lng,
    aberto_manual, ativo, pedido_minimo, aceita_agendamento, agendamento_antecedencia_min,
    aceita_online, aceita_entrega, antecipacao_cartao, taxa_servico_padrao_pct,
    cashback_pct, meta_preparo_min, chat_ia_ativo, segmento_negocio, modulos_ativos,
    entrega_modo, entrega_taxa_base, entrega_taxa_km, entrega_raio_km,
    entrega_taxa_padrao, frete_gratis_valor_minimo, meta_pixel_id, ga4_measurement_id,
    NULLIF(btrim(COALESCE(efi_payee_code, ''::text)), ''::text) IS NOT NULL AS efi_configurado,
    banner_pos_y,
    nutricao_ativo, nutricao_exibicao, nutricao_selos_atributo, nutricao_disclaimer
   FROM lojas l
  WHERE ativo;

-- ── 7: função de gatilho não é API ──────────────────────────────────────────
revoke all on function public.fn_trg_cache_nutricao_ficha()          from public, anon, authenticated;
revoke all on function public.fn_trg_cache_nutricao_insumo()         from public, anon, authenticated;
revoke all on function public.fn_trg_cache_nutricao_preparo()        from public, anon, authenticated;
revoke all on function public.fn_trg_cache_nutricao_insumo_unidade() from public, anon, authenticated;
revoke all on function public.fn_trg_cache_nutricao_produto()        from public, anon, authenticated;
revoke all on function public.fn_trg_cache_nutricao_produto_config() from public, anon, authenticated;

revoke all on function public.fn_atualizar_cache_nutricao(uuid) from public, anon;
grant execute on function public.fn_atualizar_cache_nutricao(uuid) to authenticated;

revoke all on function public.fn_produtos_que_usam_insumo(uuid) from public, anon;
grant execute on function public.fn_produtos_que_usam_insumo(uuid) to authenticated;
