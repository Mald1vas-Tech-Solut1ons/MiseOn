-- Achado 13: fn_painel_tv_senhas é pública só pelo slug, e o slug é público.
-- Qualquer pessoa na internet lista o primeiro nome de até 100 pedidos do dia
-- de qualquer loja. É pouco dado, mas é dado de cliente exposto sem controle,
-- e o slug não é segredo nenhum.
--
-- Solução: um token por loja, que vai na URL da TV. A TV do balcão continua
-- sem login (é o requisito), mas quem não tem a URL não enumera nada.
-- Compatibilidade: enquanto a loja não tiver token gerado, a função continua
-- respondendo sem ele — assim nenhuma TV já instalada apaga no meio do
-- expediente. Ao gerar o token pelo painel, o slug sozinho deixa de servir.

alter table lojas add column if not exists painel_tv_token uuid;

comment on column lojas.painel_tv_token is
  'Token da URL do Painel de TV (/painel/:slug?token=...). Nulo = painel aberto por slug (compatibilidade). Preenchido = exige o token.';

create or replace function fn_painel_tv_senhas(p_slug text, p_token uuid default null)
returns table (numero integer, status text, primeiro_nome text, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare v_loja uuid; v_token uuid;
begin
  select l.id, l.painel_tv_token into v_loja, v_token
  from lojas l where l.slug = p_slug and l.ativo;

  if v_loja is null then
    return;
  end if;

  -- Token configurado passa a ser obrigatório. Sem token configurado, mantém
  -- o comportamento antigo para não derrubar TV já em operação.
  if v_token is not null and (p_token is null or p_token <> v_token) then
    raise exception 'Painel de TV desta loja exige token na URL.';
  end if;

  return query
  select p.numero,
         p.status::text,
         nullif(split_part(btrim(coalesce(p.identificador_cliente, '')), ' ', 1), '') as primeiro_nome,
         p.criado_em
  from pedidos p
  where p.loja_id = v_loja
    and p.criado_em >= date_trunc('day', now())
    and p.status in ('NOVO','ACEITO','PREPARANDO','PRONTO','EM_ROTA')
  order by p.criado_em desc
  limit 100;
end;
$fn$;

revoke all on function fn_painel_tv_senhas(text, uuid) from public;
grant execute on function fn_painel_tv_senhas(text, uuid) to anon, authenticated;

-- Assinatura antiga (só slug) sai de circulação: quem chamar sem o parâmetro
-- cai na nova, que tem default. Evita duas versões convivendo.
drop function if exists fn_painel_tv_senhas(text);
