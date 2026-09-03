-- A TV do balcao e uma tela de venda, mas so mostrava produto.
-- Banner e cupom cadastrados no Marketing nao chegavam nela: quem esta na fila
-- via o cardapio e nao ficava sabendo do cashback nem do cupom da casa.
--
-- `cupons` nao pode ser lido por anon (codigo de cupom exposto na internet vira
-- abuso), entao a TV recebe as promocoes por RPC, com a MESMA regra de token do
-- painel de senhas: quem tem o link da TV ve; o resto, nao.
--
-- Devolve so o que se mostra numa tela: codigo, o que vale e o minimo. Nada de
-- limite de usos, contagem ou id.

create or replace function public.fn_painel_tv_promocoes(
  p_slug  text,
  p_token uuid default null
)
returns table (
  tipo_item     text,      -- 'BANNER' | 'CUPOM' | 'CASHBACK'
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
begin
  select l.id, l.painel_tv_token, l.cashback_pct
    into v_loja, v_token, v_cashback
  from lojas l
  where l.slug = p_slug and l.ativo;

  if v_loja is null then
    return;
  end if;

  if v_token is not null and (p_token is null or p_token <> v_token) then
    raise exception 'Painel de TV desta loja exige token na URL.';
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
    -- Cupom de primeira compra nao faz sentido numa TV de balcao: quem esta na
    -- fila ja e cliente. Mostrar so gera pergunta no caixa.
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

comment on function public.fn_painel_tv_promocoes(text, uuid) is
  'Promocoes para a TV do balcao (banner, cupom publico e cashback). Mesma regra de token do fn_painel_tv_senhas.';
