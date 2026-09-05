-- ============================================================================
-- SHIM de drift (Sprint 0, 05/09/2026)
--
-- POR QUÊ EXISTE: a 20260818234500_produtos_nutricao_cache.sql é um arquivo
-- SÓ DE COMENTÁRIOS — admite textualmente que "a função completa está
-- aplicada em produção (ver histórico de migrações do projeto)": tabela
-- produtos_nutricao_cache, fn_atualizar_cache_nutricao, fn_trg_cache_
-- nutricao_ficha, fn_trg_cache_nutricao_insumo e a nova fn_nutricao_cardapio
-- foram criados DIRETO em produção e nunca versionados (o dump de 21/07 é
-- anterior e não os contém). Em banco limpo a cadeia morria no
-- `revoke execute on function fn_atualizar_cache_nutricao(uuid)` de
-- 20260819050126 ("function does not exist") e morreria de novo nos revokes
-- de fn_trg_cache_nutricao_ficha/insumo em 20260819154104/154613.
--
-- RECONSTRUÇÃO v1 (não há dump a copiar): colunas e forma derivadas dos
-- consumidores — fn_recalcular_nutricao_produto (20260729050000:292, motor
-- que devolve status/cobertura_pct/massa_g/insumos_faltantes/nutrientes) e
-- do INSERT v2 (20260901130000:257-261), que acrescenta colunas e usa
-- ON CONFLICT (produto_id) → a tabela tem PK em produto_id. A versão v2
-- (20260901130000) recria fn_atualizar_cache_nutricao e fn_trg_cache_
-- nutricao_insumo com CREATE OR REPLACE — este shim é fiel o suficiente
-- para a janela 18/08→01/09 e depois é substituído pela v2 canônica.
--
-- RLS conforme o comentário da própria 234500: leitura pública (vitrine
-- sem login), escrita apenas pelas SECURITY DEFINER.
-- Idempotente: no-op em produção, onde tudo já existe.
-- ============================================================================

create table if not exists public.produtos_nutricao_cache (
  produto_id          uuid primary key references public.produtos(id) on delete cascade,
  loja_id            uuid not null references public.lojas(id) on delete cascade,
  status             text not null default 'SEM_DADOS',
  cobertura_pct      numeric not null default 0,
  massa_g            numeric not null default 0,
  insumos_faltantes  integer not null default 0,
  nutrientes         jsonb not null default '{}'::jsonb,
  atualizado_em      timestamptz not null default now()
);

create index if not exists idx_produtos_nutricao_cache_loja
  on public.produtos_nutricao_cache (loja_id);

alter table public.produtos_nutricao_cache enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'produtos_nutricao_cache' AND policyname = 'vitrine_le_cache_nutricao'
  ) THEN
    CREATE POLICY vitrine_le_cache_nutricao ON public.produtos_nutricao_cache
      FOR SELECT USING (true);
  END IF;
END $$;

create or replace function public.fn_atualizar_cache_nutricao(p_produto_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_loja uuid;
  n      jsonb;
begin
  select loja_id into v_loja from public.produtos where id = p_produto_id;
  if not found then return; end if;

  n := public.fn_recalcular_nutricao_produto(p_produto_id);

  insert into public.produtos_nutricao_cache (
    produto_id, loja_id, status, cobertura_pct, massa_g,
    insumos_faltantes, nutrientes, atualizado_em
  )
  values (
    p_produto_id, v_loja,
    coalesce((n->>'status')::text, 'SEM_DADOS'),
    coalesce((n->>'cobertura_pct')::numeric, 0),
    coalesce((n->>'massa_g')::numeric, 0),
    coalesce(jsonb_array_length(n->'insumos_faltantes'), 0),
    coalesce(n->'nutrientes', '{}'::jsonb),
    now()
  )
  on conflict (produto_id) do update set
    loja_id = excluded.loja_id, status = excluded.status,
    cobertura_pct = excluded.cobertura_pct, massa_g = excluded.massa_g,
    insumos_faltantes = excluded.insumos_faltantes,
    nutrientes = excluded.nutrientes, atualizado_em = now();
end;
$$;

-- Gatilho da ficha técnica: mexeu no prato, recalcula aquele prato.
create or replace function public.fn_trg_cache_nutricao_ficha()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.fn_atualizar_cache_nutricao(coalesce(new.produto_id, old.produto_id));
  return null;
end;
$$;

drop trigger if exists trg_cache_nutricao_ficha on public.fichas_tecnicas;
create trigger trg_cache_nutricao_ficha
  after insert or update or delete on public.fichas_tecnicas
  for each row execute function public.fn_trg_cache_nutricao_ficha();

-- Gatilho do dado do insumo: recalcula quem o usa.
create or replace function public.fn_trg_cache_nutricao_insumo()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_produto uuid;
begin
  for v_produto in
    select ft.produto_id
    from public.fichas_tecnicas ft
    where ft.insumo_id = coalesce(new.insumo_id, old.insumo_id)
  loop
    perform public.fn_atualizar_cache_nutricao(v_produto);
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_cache_nutricao_insumo on public.insumos_nutricao;
create trigger trg_cache_nutricao_insumo
  after insert or update or delete on public.insumos_nutricao
  for each row execute function public.fn_trg_cache_nutricao_insumo();