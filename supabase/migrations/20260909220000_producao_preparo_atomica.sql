-- A ordem de producao e uma unidade de negocio: ingredientes, custo PEPS,
-- entrada do resultado e lote produzido devem confirmar juntos ou falhar juntos.
--
-- A versao anterior em producao inseria direto em movimentacoes_estoque e
-- ajustava insumos.quantidade_atual na mao. Nessa rota o custo volta nulo, o
-- PEPS nao consome lote nenhum e o preparo entra valendo zero. Aqui a OS passa
-- a ser executada exclusivamente por fn_movimentar_estoque, que e a unica fonte
-- de saldo, lote e custo do dominio.

-- 1) Rendimento fracionario. rendimento_porcoes era integer: "meio quilo de
-- molho por lote" virava 0 ou 1 silenciosamente. Tres views encadeadas
-- dependem da coluna, entao sao recriadas identicas (inclusive
-- security_invoker, que preserva a RLS de insumos).
drop view if exists public.vw_itens_ficha_tecnica;
drop view if exists public.vw_itens_almoxarifado;
drop view if exists public.itens;

-- A trigger de cache nutricional lista rendimento_porcoes no UPDATE OF, o que
-- tambem trava o ALTER TYPE. Sai e volta identica.
drop trigger if exists trg_cache_nutricao_insumo_unidade on public.insumos;

alter table public.insumos
  alter column rendimento_porcoes type numeric(12,4)
  using rendimento_porcoes::numeric;

create trigger trg_cache_nutricao_insumo_unidade
  after update of unidade_medida, is_preparo, rendimento_padrao_kg, rendimento_porcoes
  on public.insumos
  for each row
  when (old.unidade_medida is distinct from new.unidade_medida
     or old.is_preparo is distinct from new.is_preparo
     or old.rendimento_padrao_kg is distinct from new.rendimento_padrao_kg
     or old.rendimento_porcoes is distinct from new.rendimento_porcoes)
  execute function public.fn_trg_cache_nutricao_insumo_unidade();

-- Roteiro do Modo de Preparo: [{"texto": "...", "minutos": 5|null}].
-- Lista vazia e o estado normal de quem so faz mise en place; o sistema nao
-- inventa etapa, quem escreve o roteiro e a operacao (ou a IA, como rascunho).
alter table public.insumos
  add column if not exists modo_preparo jsonb not null default '[]'::jsonb;

alter table public.insumos
  drop constraint if exists insumos_modo_preparo_e_lista;
alter table public.insumos
  add constraint insumos_modo_preparo_e_lista
  check (jsonb_typeof(modo_preparo) = 'array');

create view public.itens with (security_invoker = true) as
  select i.id, i.loja_id, i.nome, i.unidade_medida, i.quantidade_atual,
         i.estoque_minimo, i.preco_embalagem, i.qtd_embalagem, i.ativo,
         i.criado_em, i.detalhes_rendimento, i.is_preparo, i.rendimento_porcoes,
         i.pessoas_servidas, i.categoria_insumo, i.validade_horas, i.setor,
         i.rendimento_padrao_kg, i.fornecedor_padrao_id, i.tipo_item, i.gtin, i.ncm,
         i.modo_preparo,
         t.rotulo as tipo_rotulo, t.natureza as tipo_natureza,
         t.entra_ficha_tecnica as tipo_entra_ficha, t.conta_estoque as tipo_conta_estoque,
         t.conta_consumo as tipo_conta_consumo, t.controla_validade as tipo_controla_validade,
         t.icone as tipo_icone
    from public.insumos i
    join public.tipos_item t on t.codigo = i.tipo_item;

create view public.vw_itens_almoxarifado with (security_invoker = true) as
  select id, loja_id, nome, unidade_medida, quantidade_atual, estoque_minimo,
         preco_embalagem, qtd_embalagem, ativo, criado_em, detalhes_rendimento,
         is_preparo, rendimento_porcoes, pessoas_servidas, categoria_insumo,
         validade_horas, setor, rendimento_padrao_kg, fornecedor_padrao_id,
         tipo_item, gtin, ncm, modo_preparo, tipo_rotulo, tipo_natureza,
         tipo_entra_ficha, tipo_conta_estoque, tipo_conta_consumo,
         tipo_controla_validade, tipo_icone
    from public.itens i
   where tipo_natureza = 'ALMOXARIFADO' and ativo;

create view public.vw_itens_ficha_tecnica with (security_invoker = true) as
  select id, loja_id, nome, unidade_medida, quantidade_atual, estoque_minimo,
         preco_embalagem, qtd_embalagem, ativo, criado_em, detalhes_rendimento,
         is_preparo, rendimento_porcoes, pessoas_servidas, categoria_insumo,
         validade_horas, setor, rendimento_padrao_kg, fornecedor_padrao_id,
         tipo_item, gtin, ncm, modo_preparo, tipo_rotulo, tipo_natureza,
         tipo_entra_ficha, tipo_conta_estoque, tipo_conta_consumo,
         tipo_controla_validade, tipo_icone
    from public.itens i
   where tipo_entra_ficha and ativo;

grant select, insert, update, delete on public.itens to anon, authenticated, service_role;
grant select, insert, update, delete on public.vw_itens_almoxarifado to anon, authenticated, service_role;
grant select, insert, update, delete on public.vw_itens_ficha_tecnica to anon, authenticated, service_role;

-- 2) A OS atomica. A assinatura repete a que ja existe em producao
-- (uuid, numeric) de proposito: criar uma sobrecarga (uuid, integer) deixaria
-- a chamada do PostgREST ambigua.
drop function if exists public.fn_produzir_preparo(uuid, integer);

create or replace function public.fn_produzir_preparo(
  p_preparo_id uuid,
  p_multiplicador numeric default 1
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_preparo public.insumos%rowtype;
  v_linha record;
  v_mov jsonb;
  v_rendimento numeric;
  v_quantidade numeric;
  v_custo_total numeric := 0;
  v_custo_linha numeric;
  v_vence_em timestamptz;
  v_producao_id uuid;
  v_ingredientes jsonb := '[]'::jsonb;
begin
  if coalesce(p_multiplicador, 0) <= 0 then
    raise exception 'A quantidade de lotes deve ser maior que zero.';
  end if;
  -- producoes_preparo.lotes e integer: aceitar 1,5 aqui gravaria um lote que
  -- nao foi o produzido. Meio lote se cadastra como ficha propria.
  if p_multiplicador <> trunc(p_multiplicador) then
    raise exception 'A quantidade de lotes deve ser um numero inteiro.';
  end if;

  select * into v_preparo
  from public.insumos
  where id = p_preparo_id
  for update;

  if v_preparo.id is null or not coalesce(v_preparo.is_preparo, false) then
    raise exception 'Ficha de producao nao encontrada.';
  end if;
  if not public.fn_pode_operar_loja(v_preparo.loja_id) then
    raise exception 'Sem permissao para produzir nesta loja.';
  end if;

  v_rendimento := public.fn_rendimento_na_unidade_do_preparo(
    v_preparo.unidade_medida, v_preparo.rendimento_padrao_kg, v_preparo.rendimento_porcoes
  );
  if coalesce(v_rendimento, 0) <= 0 then
    raise exception 'Defina o rendimento de um lote antes de produzir.';
  end if;

  if not exists (
    select 1 from public.fichas_preparos fp where fp.preparo_id = v_preparo.id
  ) then
    raise exception 'A ficha precisa de pelo menos uma materia-prima.';
  end if;

  for v_linha in
    select fp.insumo_id, fp.quantidade, i.nome, i.unidade_medida
    from public.fichas_preparos fp
    join public.insumos i on i.id = fp.insumo_id
    where fp.preparo_id = v_preparo.id
      and i.loja_id = v_preparo.loja_id
      and coalesce(fp.loja_id, v_preparo.loja_id) = v_preparo.loja_id
    order by fp.created_at, fp.id
  loop
    if coalesce(v_linha.quantidade, 0) <= 0 then
      raise exception 'A quantidade de % deve ser maior que zero.', v_linha.nome;
    end if;

    -- Negativo de proposito: a convencao do schema e "positivo entra, negativo
    -- sai", e so o sinal negativo dispara o custeio PEPS e consome os lotes.
    v_mov := public.fn_movimentar_estoque(
      v_linha.insumo_id,
      'SAIDA',
      -(v_linha.quantidade * p_multiplicador),
      null,
      format('OS de producao - %s (%s lote(s))', v_preparo.nome, p_multiplicador)
    );
    v_custo_linha := coalesce((v_mov->>'custo_total')::numeric, 0);
    v_custo_total := v_custo_total + v_custo_linha;
    v_ingredientes := v_ingredientes || jsonb_build_array(jsonb_build_object(
      'insumo', v_linha.nome,
      'quantidade', v_linha.quantidade * p_multiplicador,
      'unidade', v_linha.unidade_medida,
      'custo', round(v_custo_linha, 4)
    ));
  end loop;

  if jsonb_array_length(v_ingredientes) = 0 then
    raise exception 'A ficha contem itens invalidos ou de outra loja.';
  end if;

  v_quantidade := v_rendimento * p_multiplicador;
  if coalesce(v_preparo.validade_horas, 0) > 0 then
    v_vence_em := now() + make_interval(secs => (v_preparo.validade_horas * 3600)::double precision);
  end if;

  -- O preparo vale o que custou produzir: o custo apurado no PEPS das
  -- materias-primas vira o custo do lote que entra, e se conserva ate a venda.
  perform public.fn_movimentar_estoque(
    v_preparo.id,
    'ENTRADA',
    v_quantidade,
    nullif(v_custo_total, 0),
    format('OS de producao concluida - %s lote(s)', p_multiplicador),
    null,
    null,
    v_vence_em::date
  );

  insert into public.producoes_preparo (
    loja_id, preparo_id, lotes, quantidade_produzida, vence_em, status
  ) values (
    v_preparo.loja_id, v_preparo.id, p_multiplicador::int, v_quantidade, v_vence_em, 'ATIVO'
  ) returning id into v_producao_id;

  return jsonb_build_object(
    'producao_id', v_producao_id,
    'preparo', v_preparo.nome,
    'quantidade', v_quantidade,
    'unidade', v_preparo.unidade_medida,
    'custo_total', round(v_custo_total, 4),
    'custo_unitario', case when v_quantidade > 0 then round(v_custo_total / v_quantidade, 6) else 0 end,
    'vence_em', v_vence_em,
    'ingredientes', v_ingredientes
  );
end;
$function$;

revoke all on function public.fn_produzir_preparo(uuid, numeric) from public, anon;
grant execute on function public.fn_produzir_preparo(uuid, numeric) to authenticated, service_role;

comment on function public.fn_produzir_preparo(uuid, numeric) is
  'Executa uma OS atomica: consome materias-primas por PEPS via fn_movimentar_estoque, transfere o custo ao resultado e registra lote e validade.';
