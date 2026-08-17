-- ============================================================================
-- PAINEL DE TV — modo SENHAS acessível sem login, sem vazar dado de cliente
-- ============================================================================
--
-- `/tv/:slug` é rota pública (main.tsx), pensada para uma TV pendurada no
-- balcão que ninguém loga. Só que `pedidos` não tem — e não deve ter — policy
-- de SELECT público: hoje a chamada de senhas volta vazia num dispositivo real.
--
-- Em vez de abrir `pedidos`, expomos uma RPC com o mínimo necessário para
-- chamar uma senha: número do pedido, status e PRIMEIRO NOME do cliente.
-- Nome completo, telefone, endereço e id nunca saem daqui — é uma tela que
-- fica virada para a rua.
-- ============================================================================

create or replace function public.fn_painel_tv_senhas(p_slug text)
returns table (
  numero integer,
  status public.status_pedido,
  primeiro_nome text,
  criado_em timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    p.numero,
    p.status,
    -- só o primeiro nome: é o que se grita no balcão, e limita a exposição
    nullif(split_part(btrim(coalesce(p.identificador_cliente, '')), ' ', 1), '') as primeiro_nome,
    p.criado_em
  from pedidos p
  join lojas l on l.id = p.loja_id
  where l.slug = p_slug
    and l.ativo
    and p.criado_em >= date_trunc('day', now())
    and p.status in ('NOVO', 'ACEITO', 'PREPARANDO', 'PRONTO', 'EM_ROTA')
  order by p.criado_em desc
  limit 100;
$$;

comment on function public.fn_painel_tv_senhas(text) is
  'Chamada de senhas do painel de TV (rota pública /tv/:slug). Devolve só numero, '
  'status e primeiro nome — nunca telefone, endereço, id ou nome completo.';

revoke execute on function public.fn_painel_tv_senhas(text) from public;
grant execute on function public.fn_painel_tv_senhas(text) to anon, authenticated;
