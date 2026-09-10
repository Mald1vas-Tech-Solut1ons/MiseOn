-- Pareamento gratuito para TVs sem teclado confortavel.
--
-- A TV abre /tv, recebe um codigo curto e guarda um segredo de alta entropia
-- somente naquele navegador. O codigo sozinho nao permite consultar nem tomar
-- uma sessao. Um admin da loja autoriza o codigo e escolhe o conteudo. A TV
-- recebe apenas uma credencial de display temporaria, nunca o JWT do admin nem
-- o painel_tv_token permanente da loja.

create table public.tv_pareamentos (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique,
  segredo_hash          bytea not null,
  status                text not null default 'PENDENTE'
                        check (status in ('PENDENTE', 'AUTORIZADO', 'REVOGADO')),
  loja_id               uuid references public.lojas(id) on delete cascade,
  modo                   text check (modo in ('AUTO', 'CARDAPIO', 'SENHAS')),
  sessao_token           uuid unique,
  pareamento_expira_em   timestamptz not null default (now() + interval '10 minutes'),
  sessao_expira_em       timestamptz,
  autorizado_por         uuid references auth.users(id) on delete set null,
  autorizado_em          timestamptz,
  revogado_em            timestamptz,
  ultimo_acesso_em       timestamptz,
  criado_em              timestamptz not null default now(),

  constraint tv_pareamento_autorizado_com_loja check (
    status <> 'AUTORIZADO'
    or (loja_id is not null and modo is not null and sessao_token is not null
        and sessao_expira_em is not null and autorizado_em is not null)
  )
);

create index tv_pareamentos_sessao_idx
  on public.tv_pareamentos(sessao_token)
  where sessao_token is not null;

create index tv_pareamentos_loja_ativas_idx
  on public.tv_pareamentos(loja_id, sessao_expira_em)
  where status = 'AUTORIZADO';

alter table public.tv_pareamentos enable row level security;

-- Defesa em profundidade: nao existe policy. A tabela nao e API; somente as
-- RPCs abaixo podem revelar o estado estritamente necessario.
revoke all on table public.tv_pareamentos from public, anon, authenticated;

comment on table public.tv_pareamentos is
  'Pareamento temporario e sessoes revogaveis de display. Sem acesso direto pela Data API.';

create or replace function public.fn_tv_pareamento_criar()
returns table(codigo text, segredo text, expira_em timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_codigo text;
  v_segredo text;
  v_tentativa integer;
begin
  -- Limpeza conservadora; preserva sessoes recentes para auditoria.
  delete from public.tv_pareamentos
  where criado_em < now() - interval '30 days';

  v_segredo := encode(extensions.gen_random_bytes(24), 'hex');

  for v_tentativa in 1..8 loop
    v_codigo := '';
    for i in 1..6 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::integer, 1);
    end loop;

    begin
      insert into public.tv_pareamentos(codigo, segredo_hash)
      values (v_codigo, extensions.digest(v_segredo, 'sha256'));

      return query
      select v_codigo, v_segredo, now() + interval '10 minutes';
      return;
    exception when unique_violation then
      -- Colisao extremamente improvavel; gera outro codigo sem expor detalhe.
    end;
  end loop;

  raise exception 'Nao foi possivel gerar o codigo da TV agora. Tente novamente.';
end;
$function$;

revoke all on function public.fn_tv_pareamento_criar() from public;
grant execute on function public.fn_tv_pareamento_criar() to anon, authenticated;

create or replace function public.fn_tv_pareamento_consultar(
  p_codigo text,
  p_segredo text
)
returns table(
  status text,
  slug text,
  modo text,
  sessao_token uuid,
  sessao_expira_em timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public.tv_pareamentos%rowtype;
begin
  select p.* into v
  from public.tv_pareamentos p
  where p.codigo = upper(btrim(p_codigo))
    and p.segredo_hash = extensions.digest(coalesce(p_segredo, ''), 'sha256')
  for update;

  if not found then
    raise exception 'Codigo de pareamento invalido.';
  end if;

  if v.status = 'REVOGADO' then
    return query select 'REVOGADO'::text, null::text, null::text, null::uuid, null::timestamptz;
    return;
  end if;

  if v.status = 'PENDENTE' and v.pareamento_expira_em <= now() then
    return query select 'EXPIRADO'::text, null::text, null::text, null::uuid, v.pareamento_expira_em;
    return;
  end if;

  if v.status = 'AUTORIZADO' and v.sessao_expira_em <= now() then
    return query select 'EXPIRADO'::text, null::text, v.modo, null::uuid, v.sessao_expira_em;
    return;
  end if;

  if v.status = 'PENDENTE' then
    return query select 'PENDENTE'::text, null::text, null::text, null::uuid, v.pareamento_expira_em;
    return;
  end if;

  update public.tv_pareamentos
  set ultimo_acesso_em = now()
  where id = v.id;

  return query
  select 'AUTORIZADO'::text, l.slug, v.modo, v.sessao_token, v.sessao_expira_em
  from public.lojas l
  where l.id = v.loja_id and l.ativo;
end;
$function$;

revoke all on function public.fn_tv_pareamento_consultar(text, text) from public;
grant execute on function public.fn_tv_pareamento_consultar(text, text) to anon, authenticated;

create or replace function public.fn_tv_pareamento_autorizar(
  p_loja_id uuid,
  p_codigo text,
  p_modo text
)
returns table(sessao_expira_em timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_expira timestamptz := now() + interval '7 days';
  v_modo text := upper(btrim(p_modo));
begin
  if auth.uid() is null
     or not public.fn_tem_papel(p_loja_id, array['admin']) then
    raise exception 'Somente o administrador da loja pode parear uma TV.';
  end if;

  if v_modo not in ('AUTO', 'CARDAPIO', 'SENHAS') then
    raise exception 'Escolha AUTO, CARDAPIO ou SENHAS.';
  end if;

  select p.id into v_id
  from public.tv_pareamentos p
  where p.codigo = upper(btrim(p_codigo))
    and p.status = 'PENDENTE'
    and p.pareamento_expira_em > now()
  for update;

  if not found then
    raise exception 'Codigo nao encontrado ou expirado. Gere um novo codigo na TV.';
  end if;

  update public.tv_pareamentos
  set loja_id = p_loja_id,
      modo = v_modo,
      status = 'AUTORIZADO',
      sessao_token = gen_random_uuid(),
      sessao_expira_em = v_expira,
      autorizado_por = auth.uid(),
      autorizado_em = now()
  where id = v_id;

  return query select v_expira;
end;
$function$;

revoke all on function public.fn_tv_pareamento_autorizar(uuid, text, text) from public, anon;
grant execute on function public.fn_tv_pareamento_autorizar(uuid, text, text) to authenticated;

create or replace function public.fn_tv_sessoes_revogar(p_loja_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_quantidade integer;
begin
  if auth.uid() is null
     or not public.fn_tem_papel(p_loja_id, array['admin']) then
    raise exception 'Somente o administrador da loja pode revogar TVs.';
  end if;

  update public.tv_pareamentos
  set status = 'REVOGADO', revogado_em = now(), sessao_token = null
  where loja_id = p_loja_id
    and status = 'AUTORIZADO'
    and sessao_expira_em > now();
  get diagnostics v_quantidade = row_count;
  return v_quantidade;
end;
$function$;

revoke all on function public.fn_tv_sessoes_revogar(uuid) from public, anon;
grant execute on function public.fn_tv_sessoes_revogar(uuid) to authenticated;

-- RPCs exclusivas das sessoes pareadas. Os endpoints antigos por painel_tv_token
-- continuam funcionando para instalacoes existentes e para o Cast em progresso.
create or replace function public.fn_painel_tv_senhas_sessao(
  p_slug text,
  p_sessao uuid
)
returns table(numero integer, status text, primeiro_nome text, criado_em timestamptz, tipo_pedido text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_loja uuid;
  v_modo text;
  v_tipos public.tipo_pedido[];
begin
  select p.loja_id, p.modo, l.painel_tv_tipos
    into v_loja, v_modo, v_tipos
  from public.tv_pareamentos p
  join public.lojas l on l.id = p.loja_id and l.slug = p_slug and l.ativo
  where p.sessao_token = p_sessao
    and p.status = 'AUTORIZADO'
    and p.sessao_expira_em > now();

  if v_loja is null then
    raise exception 'Sessao da TV invalida, expirada ou revogada.';
  end if;

  -- Uma sessao autorizada somente para cardapio nao pode ser promovida para
  -- painel de senhas alterando a query string no navegador da TV.
  if v_modo = 'CARDAPIO' then
    return;
  end if;

  return query
  select coalesce(p.senha, p.numero), p.status::text,
         nullif(split_part(btrim(coalesce(p.identificador_cliente, '')), ' ', 1), ''),
         p.criado_em, p.tipo_pedido::text
  from public.pedidos p
  where p.loja_id = v_loja
    and p.criado_em >= now() - interval '12 hours'
    and p.status in ('NOVO', 'ACEITO', 'PREPARANDO', 'PRONTO', 'EM_ROTA')
    and p.tipo_pedido = any(coalesce(v_tipos, array['RETIRADA_BALCAO', 'SALAO']::public.tipo_pedido[]))
  order by p.criado_em desc
  limit 100;
end;
$function$;

revoke all on function public.fn_painel_tv_senhas_sessao(text, uuid) from public;
grant execute on function public.fn_painel_tv_senhas_sessao(text, uuid) to anon, authenticated;

create or replace function public.fn_painel_tv_promocoes_sessao(
  p_slug text,
  p_sessao uuid
)
returns table(
  tipo_item text, titulo text, imagem_url text, codigo text,
  desconto_tipo text, desconto_valor numeric, pedido_minimo numeric,
  validade timestamptz, ordem integer
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_loja uuid;
  v_cashback numeric;
  v_ligado boolean;
begin
  select p.loja_id, l.cashback_pct, l.painel_tv_promocoes
    into v_loja, v_cashback, v_ligado
  from public.tv_pareamentos p
  join public.lojas l on l.id = p.loja_id and l.slug = p_slug and l.ativo
  where p.sessao_token = p_sessao
    and p.status = 'AUTORIZADO'
    and p.sessao_expira_em > now();

  if v_loja is null then
    raise exception 'Sessao da TV invalida, expirada ou revogada.';
  end if;
  if not coalesce(v_ligado, true) then return; end if;

  return query
  select 'BANNER'::text, b.titulo, b.imagem_url, null::text, null::text,
         null::numeric, null::numeric, null::timestamptz, coalesce(b.ordem_exibicao, 0)
  from public.banners_destaque b
  where b.loja_id = v_loja and b.is_ativo
  union all
  select 'CUPOM'::text, c.descricao, null::text, c.codigo, c.tipo::text,
         c.valor, c.pedido_minimo, c.validade, 100
  from public.cupons c
  where c.loja_id = v_loja and c.ativo
    and (c.validade is null or c.validade > now())
    and (c.limite_usos is null or coalesce(c.usos, 0) < c.limite_usos)
    and coalesce(c.apenas_primeiro_pedido, false) = false
  union all
  select 'CASHBACK'::text, null::text, null::text, null::text, null::text,
         v_cashback, null::numeric, null::timestamptz, 200
  where coalesce(v_cashback, 0) > 0
  order by 9, 2
  limit 12;
end;
$function$;

revoke all on function public.fn_painel_tv_promocoes_sessao(text, uuid) from public;
grant execute on function public.fn_painel_tv_promocoes_sessao(text, uuid) to anon, authenticated;
