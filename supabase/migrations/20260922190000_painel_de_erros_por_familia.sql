-- ═══════════════════════════════════════════════════════════════════════════
-- PAINEL DE ERROS POR FAMÍLIA (22/09/2026)
--
-- Medido antes: 36 linhas abertas, nenhuma resolvida, a mais velha de 04/09.
-- A tabela guarda uma linha por impressão × hora, e a impressão inclui a URL
-- do arquivo: "Failed to fetch dynamically imported module" virou 8 linhas
-- só porque cada deploy troca o hash do chunk. Resultado: erro velho com cara
-- de atual, o mesmo defeito espalhado em várias linhas, e ruído de terceiro
-- (iOS autofill, rastreador da Microsoft) misturado com defeito nosso.
--
-- Agora:
--   - FAMÍLIA: mensagem sem URL, sem hash de arquivo e sem número;
--   - CATEGORIA: nosso | deploy (aba aberta durante publicação) | terceiro;
--   - ESTADO: pico (≥5 na última hora ou ≥3 pessoas) | ativo (24h) |
--     dormente | resolvido | voltou (apareceu DEPOIS de marcado resolvido);
--   - resolução automática: família sem aparecer há 7 dias sai da lista
--     aberta sozinha, marcada como 'auto' — e se voltar, volta gritando.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.erros_aplicacao add column if not exists resolvido_em timestamptz;
alter table public.erros_aplicacao add column if not exists resolvido_por text;

-- Padrões conhecidos de código que não é nosso. Tabela, não código: quando
-- aparecer outro, entra uma linha, sem deploy.
create table if not exists public.erros_ruido (
  padrao text primary key,
  motivo text not null
);
alter table public.erros_ruido enable row level security;
revoke all on public.erros_ruido from public, anon, authenticated;
insert into public.erros_ruido (padrao, motivo) values
  ('_AutofillCallbackHandler', 'Injetado pelo WebView do iOS (Instagram/Facebook) ao preencher formulário'),
  ('Object Not Found Matching Id', 'Rastreador da Microsoft (Clarity/Bing) em WebView'),
  ('ResizeObserver loop', 'Aviso benigno do navegador, sem efeito para o usuário')
on conflict (padrao) do nothing;

/**
 * Mesma família = mesmo defeito, venha de qual deploy, pedido ou TELA vier.
 * A rota (contexto) fica de fora de propósito: medido, o mesmo erro de
 * deploy em 8 telas virava 8 famílias. Ela aparece como "telas afetadas".
 */
create or replace function public.fn_erro_familia(p_origem text, p_contexto text, p_mensagem text)
returns text language sql immutable
set search_path to 'public', 'pg_temp'
as $$
  select md5(coalesce(p_origem,'') || '|' ||
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(p_mensagem,'')), 'https?://[^[:space:]"'')]+', '<url>', 'g'),
        '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<id>', 'g'),
      '[0-9]+', '#', 'g'))
$$;

create or replace function public.fn_erro_categoria(p_mensagem text)
returns text language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select case
    when exists (select 1 from erros_ruido r where p_mensagem ilike '%' || r.padrao || '%') then 'terceiro'
    when p_mensagem ilike '%dynamically imported module%'
      or p_mensagem ilike '%Importing a module script failed%'
      or p_mensagem ilike '%Loading chunk%' then 'deploy'
    else 'nosso'
  end
$$;

drop function if exists public.fn_superadmin_erros(integer);
create or replace function public.fn_superadmin_erros(p_dias integer default 30)
 returns table(
   familia text, categoria text, estado text, origem text, telas text, qtd_telas bigint,
   mensagem text, stack text, url text, user_agent text,
   ocorrencias bigint, ocorrencias_24h bigint, ocorrencias_1h bigint,
   pessoas bigint, pessoas_1h bigint, lojas bigint, lojas_nomes text,
   primeiro_visto timestamptz, ultimo_visto timestamptz,
   resolvido_em timestamptz, resolvido_por text, motivo_ruido text)
 language plpgsql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  return query
  with base as (
    select e.*, fn_erro_familia(e.origem, e.contexto, e.mensagem) fam
    from erros_aplicacao e
    where e.visto_em > now() - make_interval(days => greatest(1, least(p_dias, 365)))
  ),
  g as (
    select b.fam,
      min(b.origem) origem,
      string_agg(distinct b.contexto, ', ') telas, count(distinct b.contexto) qtd_telas,
      (array_agg(b.mensagem order by b.visto_em desc))[1] mensagem,
      (array_agg(b.stack order by b.visto_em desc) filter (where b.stack is not null))[1] stack,
      (array_agg(b.url order by b.visto_em desc) filter (where b.url is not null))[1] url,
      (array_agg(b.user_agent order by b.visto_em desc) filter (where b.user_agent is not null))[1] ua,
      sum(b.ocorrencias) oc,
      coalesce(sum(b.ocorrencias) filter (where b.visto_em > now() - interval '24 hours'), 0) oc24,
      coalesce(sum(b.ocorrencias) filter (where b.hora_bucket >= date_trunc('hour', now()) - interval '1 hour'), 0) oc1,
      count(distinct b.user_id) pessoas,
      count(distinct b.user_id) filter (where b.hora_bucket >= date_trunc('hour', now()) - interval '1 hour') pessoas1,
      count(distinct b.loja_id) lojas,
      string_agg(distinct l.nome, ', ') lojas_nomes,
      min(b.criado_em) primeiro, max(b.visto_em) ultimo,
      bool_and(b.resolvido) tudo_resolvido,
      max(b.resolvido_em) resolvido_em,
      (array_agg(b.resolvido_por order by b.resolvido_em desc nulls last))[1] resolvido_por,
      max(b.criado_em) filter (where not b.resolvido) aberto_mais_novo
    from base b left join lojas l on l.id = b.loja_id
    group by b.fam
  )
  select g.fam, fn_erro_categoria(g.mensagem),
    case
      when g.tudo_resolvido then 'resolvido'
      when g.resolvido_em is not null and g.aberto_mais_novo > g.resolvido_em then 'voltou'
      when g.oc1 >= 5 or g.pessoas1 >= 3 then 'pico'
      when g.ultimo > now() - interval '24 hours' then 'ativo'
      else 'dormente'
    end,
    g.origem, g.telas, g.qtd_telas, g.mensagem, g.stack, g.url, g.ua,
    g.oc, g.oc24, g.oc1, g.pessoas, g.pessoas1, g.lojas, g.lojas_nomes,
    g.primeiro, g.ultimo, g.resolvido_em, g.resolvido_por,
    (select r.motivo from erros_ruido r where g.mensagem ilike '%' || r.padrao || '%' limit 1)
  from g
  order by g.ultimo desc;
end; $function$;

create or replace function public.fn_superadmin_resolver_erro(p_familia text)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_n int;
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  update erros_aplicacao set resolvido = true, resolvido_em = now(), resolvido_por = 'manual'
   where not resolvido and fn_erro_familia(origem, contexto, mensagem) = p_familia;
  get diagnostics v_n = row_count;
  return v_n;
end; $function$;

/** Família que não aparece há 7 dias sai da lista aberta — e fica registrado que foi o robô. */
create or replace function public.fn_erros_resolver_dormentes()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_n int;
begin
  with fam as (
    select fn_erro_familia(origem, contexto, mensagem) f, max(visto_em) ult
    from erros_aplicacao group by 1
  )
  update erros_aplicacao e set resolvido = true, resolvido_em = now(), resolvido_por = 'auto'
    from fam
   where not e.resolvido
     and fam.f = fn_erro_familia(e.origem, e.contexto, e.mensagem)
     and fam.ult < now() - interval '7 days';
  get diagnostics v_n = row_count;
  return v_n;
end; $function$;

revoke all on function public.fn_erro_familia(text, text, text) from public, anon, authenticated;
revoke all on function public.fn_erro_categoria(text) from public, anon, authenticated;
revoke all on function public.fn_superadmin_erros(integer) from public, anon, authenticated;
revoke all on function public.fn_superadmin_resolver_erro(text) from public, anon, authenticated;
revoke all on function public.fn_erros_resolver_dormentes() from public, anon, authenticated;
grant execute on function public.fn_superadmin_erros(integer) to authenticated;
grant execute on function public.fn_superadmin_resolver_erro(text) to authenticated;
grant execute on function public.fn_erros_resolver_dormentes() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'erros-resolver-dormentes';
select cron.schedule('erros-resolver-dormentes', '17 * * * *', 'select public.fn_erros_resolver_dormentes()');
