-- A faixa de promocoes na TV nasceu ligada na marra. Quem decide o que aparece
-- na tela do proprio balcao e o lojista, nao o codigo: tem loja que quer a TV
-- so com cardapio, e cupom exposto na parede nem sempre e o que se quer.
alter table public.lojas
  add column if not exists painel_tv_promocoes boolean not null default true;

comment on column public.lojas.painel_tv_promocoes is
  'Mostrar banner, cupom publico e cashback na TV do balcao. Desligado, a TV fica so com o cardapio.';

-- Recria a RPC respeitando a chave.
create or replace function public.fn_painel_tv_promocoes(
  p_slug  text,
  p_token uuid default null
)
returns table (
  tipo_item     text,
  titulo        text,
  imagem_url    text,
  codigo        text,
  desconto_tipo text,
  desconto_valor numeric,
  pedido_minimo numeric,
  validade      timestamptz,
  ordem         integer
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_loja     uuid;
  v_token    uuid;
  v_cashback numeric;
  v_ligado   boolean;
begin
  select l.id, l.painel_tv_token, l.cashback_pct, l.painel_tv_promocoes
    into v_loja, v_token, v_cashback, v_ligado
  from lojas l
  where l.slug = p_slug and l.ativo;

  if v_loja is null then
    return;
  end if;

  if v_token is not null and (p_token is null or p_token <> v_token) then
    raise exception 'Painel de TV desta loja exige token na URL.';
  end if;

  if not coalesce(v_ligado, true) then
    return;
  end if;

  return query
  select 'BANNER'::text, b.titulo, b.imagem_url, null::text, null::text,
         null::numeric, null::numeric, null::timestamptz, coalesce(b.ordem_exibicao, 0)
  from banners_destaque b
  where b.loja_id = v_loja and b.is_ativo
  union all
  select 'CUPOM'::text, c.descricao, null::text, c.codigo, c.tipo::text,
         c.valor, c.pedido_minimo, c.validade, 100
  from cupons c
  where c.loja_id = v_loja
    and c.ativo
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

revoke all on function public.fn_painel_tv_promocoes(text, uuid) from public;
grant execute on function public.fn_painel_tv_promocoes(text, uuid) to anon, authenticated;
