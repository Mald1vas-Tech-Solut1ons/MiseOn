-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Seed de vitrine — Lanche do Paulista, o tenant que demonstra o sistema.  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- PARA QUE SERVE
--
-- O Lanche do Paulista é a loja que vai à frente da câmera e à frente do
-- cliente. Ela precisa mostrar o MiseOn inteiro funcionando com número certo —
-- não uma tela bonita com custo vazio.
--
-- Antes desta seed, 7 itens usados em ficha técnica não tinham custo nenhum:
-- os blends de hambúrguer, os molhos da casa, o arroz integral e os legumes
-- grelhados. Eram cadastrados como insumo comprado, com preço zero. Isso
-- deixava a margem de metade do cardápio sem resposta.
--
-- O QUE ESTA SEED FAZ
--
-- Transforma esses 7 em PREPAROS de verdade, com ficha própria, para o custo
-- subir da matéria-prima até o prato:
--
--   Patinho moído (R$ 42,90/kg) → Smash Fit 80 g → BURGER FIT → margem
--
-- E é de propósito que ela usa preparos que exercitam o motor de rendimento,
-- porque é exatamente a física que o dono de restaurante reconhece:
--
--   • Arroz Integral Cozido — COZINHAR, ganha peso (o grão incha)
--   • Legumes Grelhados     — GRELHAR, perde água na chapa
--   • Blends de hambúrguer  — porcionamento puro, sem perda
--
-- IDEMPOTENTE: pode rodar quantas vezes quiser. Não duplica ficha, não
-- sobrescreve preço que o lojista tenha corrigido (a cascata de origem cuida
-- disso), e não inventa tamanho de embalagem.
--
-- Rodar: SQL Editor do Supabase ou Management API.

do $seed$
declare
  v_loja uuid;
  v_prep uuid;
  v_ins  uuid;

begin
  select id into v_loja from public.lojas where slug = 'lanchepaulista';
  if v_loja is null then raise exception 'Loja lanchepaulista não encontrada'; end if;

  -- ── 1. Os 7 viram preparos ────────────────────────────────────────────────
  update public.insumos
     set is_preparo = true,
         categoria_insumo = coalesce(categoria_insumo, 'PREPARO')
   where loja_id = v_loja
     and nome in ('Smash Blend 90g','Smash Fit de Patinho 80g','Burger Fit de Frango 130g',
                  'Molho de Iogurte com Ervas','Molho Caesar Fit',
                  'Arroz Integral Cozido','Legumes Grelhados');

  -- ── 2. Ficha de cada preparo ──────────────────────────────────────────────
  -- Cada bloco: acha o preparo, limpa a ficha antiga (idempotência) e recria.

  -- Smash Blend 90 g — porcionamento de acém, sem perda.
  select id into v_prep from public.insumos where loja_id=v_loja and nome='Smash Blend 90g';
  if v_prep is not null then
    delete from public.fichas_preparos where preparo_id = v_prep;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Carne Acém Moído';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada, tecnica_codigo)
      values (v_loja, v_prep, v_ins, 90, 90, 'g', 'PORCIONAR');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Sal refinado';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 1, 1, 'g');
    end if;
    update public.insumos set rendimento_porcoes = 1 where id = v_prep;
  end if;

  -- Smash Fit de Patinho 80 g — o corte magro, mais caro por grama.
  select id into v_prep from public.insumos where loja_id=v_loja and nome='Smash Fit de Patinho 80g';
  if v_prep is not null then
    delete from public.fichas_preparos where preparo_id = v_prep;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Patinho moído';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada, tecnica_codigo)
      values (v_loja, v_prep, v_ins, 80, 80, 'g', 'PORCIONAR');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Sal refinado';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 1, 1, 'g');
    end if;
    update public.insumos set rendimento_porcoes = 1 where id = v_prep;
  end if;

  -- Burger Fit de Frango 130 g.
  select id into v_prep from public.insumos where loja_id=v_loja and nome='Burger Fit de Frango 130g';
  if v_prep is not null then
    delete from public.fichas_preparos where preparo_id = v_prep;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Peito de frango';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada, tecnica_codigo)
      values (v_loja, v_prep, v_ins, 130, 130, 'g', 'PORCIONAR');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Azeite de oliva';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 3, 3, 'ml');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Sal refinado';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 2, 2, 'g');
    end if;
    update public.insumos set rendimento_porcoes = 1 where id = v_prep;
  end if;

  -- Molho de Iogurte com Ervas — rende 500 ml por lote.
  select id into v_prep from public.insumos where loja_id=v_loja and nome='Molho de Iogurte com Ervas';
  if v_prep is not null then
    delete from public.fichas_preparos where preparo_id = v_prep;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Iogurte natural';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 400, 400, 'g');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Suco de limão';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 40, 40, 'ml');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Azeite de oliva';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 50, 50, 'ml');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Sal refinado';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 5, 5, 'g');
    end if;
    update public.insumos set rendimento_porcoes = 500 where id = v_prep;
  end if;

  -- Molho Caesar Fit — rende 500 ml.
  select id into v_prep from public.insumos where loja_id=v_loja and nome='Molho Caesar Fit';
  if v_prep is not null then
    delete from public.fichas_preparos where preparo_id = v_prep;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Iogurte natural';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 350, 350, 'g');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Queijo parmesão ralado';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 60, 60, 'g');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Mostarda';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 30, 30, 'g');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Suco de limão';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 40, 40, 'ml');
    end if;
    update public.insumos set rendimento_porcoes = 500 where id = v_prep;
  end if;

  -- Arroz Integral Cozido — COZINHAR. O grão INCHA: 400 g cru viram 1 kg.
  -- É o caso que prova que o motor entende ganho de peso, não só perda.
  select id into v_prep from public.insumos where loja_id=v_loja and nome='Arroz Integral Cozido';
  if v_prep is not null then
    delete from public.fichas_preparos where preparo_id = v_prep;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Arroz integral';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada,
                                          tecnica_codigo, rendimento_pct_aplicado, rendimento_origem)
      values (v_loja, v_prep, v_ins, 400, 400, 'g', 'COZINHAR', 2.5, 'REFERENCIA_INGREDIENTE');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Sal refinado';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 8, 8, 'g');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Azeite de oliva';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 15, 15, 'ml');
    end if;
    update public.insumos set rendimento_porcoes = 1000, rendimento_padrao_kg = 1.0 where id = v_prep;
  end if;

  -- Legumes Grelhados — GRELHAR. Perde água na chapa: 1 kg cru vira 700 g.
  select id into v_prep from public.insumos where loja_id=v_loja and nome='Legumes Grelhados';
  if v_prep is not null then
    delete from public.fichas_preparos where preparo_id = v_prep;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Abobrinha';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada,
                                          tecnica_codigo, rendimento_pct_aplicado, rendimento_origem)
      values (v_loja, v_prep, v_ins, 400, 400, 'g', 'GRELHAR', 0.70, 'REFERENCIA_CATEGORIA');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Brócolis';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada,
                                          tecnica_codigo, rendimento_pct_aplicado, rendimento_origem)
      values (v_loja, v_prep, v_ins, 300, 300, 'g', 'GRELHAR', 0.70, 'REFERENCIA_CATEGORIA');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Cogumelo Paris';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada,
                                          tecnica_codigo, rendimento_pct_aplicado, rendimento_origem)
      values (v_loja, v_prep, v_ins, 300, 300, 'g', 'GRELHAR', 0.70, 'REFERENCIA_CATEGORIA');
    end if;
    select id into v_ins from public.insumos where loja_id=v_loja and nome='Azeite de oliva';
    if v_ins is not null then
      insert into public.fichas_preparos (loja_id, preparo_id, insumo_id, quantidade,
                                          quantidade_informada, unidade_informada)
      values (v_loja, v_prep, v_ins, 30, 30, 'ml');
    end if;
    update public.insumos set rendimento_porcoes = 700, rendimento_padrao_kg = 0.7 where id = v_prep;
  end if;

  raise notice 'Seed de vitrine aplicada no Lanche do Paulista.';
end
$seed$;
