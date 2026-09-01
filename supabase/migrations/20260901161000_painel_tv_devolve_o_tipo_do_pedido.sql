-- A TV nao sabia QUE TIPO de pedido estava chamando.
--
-- A loja ja podia ligar DELIVERY no painel (lojas.painel_tv_tipos), e faz
-- sentido: o motoboy do iFood tambem espera em pe no balcao. Mas a chamada
-- saia identica a de um cliente -- "por favor retirar no balcao" -- e a coluna
-- misturava quem espera o proprio lanche com quem veio coletar.
--
-- Devolvendo o tipo, a TV separa as duas chamadas. Continua sem PII: tipo de
-- pedido nao identifica ninguem.
--
-- DROP antes do CREATE porque muda a assinatura de retorno. Vai junto na mesma
-- transacao da migracao: a TV nunca ve a funcao ausente.
drop function if exists public.fn_painel_tv_senhas(text, uuid);

create function public.fn_painel_tv_senhas(p_slug text, p_token uuid default null)
returns table(numero integer, status text, primeiro_nome text, criado_em timestamptz, tipo_pedido text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_loja  uuid;
  v_token uuid;
  v_tipos public.tipo_pedido[];
begin
  select l.id, l.painel_tv_token, l.painel_tv_tipos
    into v_loja, v_token, v_tipos
  from lojas l
  where l.slug = p_slug and l.ativo;

  if v_loja is null then
    return;
  end if;

  if v_token is not null and (p_token is null or p_token <> v_token) then
    raise exception 'Painel de TV desta loja exige token na URL.';
  end if;

  return query
  select coalesce(p.senha, p.numero) as numero,
         p.status::text,
         nullif(split_part(btrim(coalesce(p.identificador_cliente, '')), ' ', 1), '') as primeiro_nome,
         p.criado_em,
         p.tipo_pedido::text
  from pedidos p
  where p.loja_id = v_loja
    and p.criado_em >= now() - interval '12 hours'
    and p.status in ('NOVO', 'ACEITO', 'PREPARANDO', 'PRONTO', 'EM_ROTA')
    and p.tipo_pedido = any(
          coalesce(v_tipos, array['RETIRADA_BALCAO', 'SALAO']::public.tipo_pedido[]))
  order by p.criado_em desc
  limit 100;
end;
$function$;

revoke all on function public.fn_painel_tv_senhas(text, uuid) from public;
grant execute on function public.fn_painel_tv_senhas(text, uuid) to anon, authenticated;
