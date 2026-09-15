-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Pedido de mesa deixa de aceitar qualquer visitante da internet.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ACHADO (15/09/2026, medido em produção, não deduzido)
--
-- `fn_pedido_mesa_criar` é SECURITY DEFINER, tem EXECUTE para `anon` e não
-- verifica NADA sobre quem chamou. Ela valida mesa, produto, opção e preço
-- (isso está certo), mas não valida a pessoa.
--
-- A cadeia inteira é alcançável só com a chave pública do cardápio:
--
--   1. GET /rest/v1/lojas_publicas?slug=eq.<slug>   → devolve o loja_id
--   2. RPC fn_mesa_publica(<slug>, <numero>)         → devolve o mesa_id
--   3. RPC fn_pedido_mesa_criar(loja_id, mesa_id, …) → pedido na cozinha
--
-- Os passos 1 e 2 foram executados de verdade contra a produção, como
-- visitante anônimo, e devolveram o par (loja, mesa) do Lanche do Paulista. O
-- passo 3 NÃO foi executado: o privilégio e a ausência de checagem já bastam
-- para concluir. O número da mesa é 1..N — enumerável em segundos. O comentário
-- em `Cardapio.tsx` que dizia "não enumerável" estava errado e foi corrigido.
--
-- CONSEQUÊNCIA: qualquer pessoa, de qualquer lugar, cria pedidos ilimitados no
-- KDS de qualquer restaurante que use o MiseOn. Numa sexta à noite isso não é
-- uma falha de segurança abstrata: é a cozinha parada.
--
-- CORREÇÃO
--
-- O QR da mesa passa a carregar um segredo. Quem tem o segredo esteve na mesa;
-- quem só chutou o número, não. Dois caminhos de autorização:
--
--   • Equipe da loja (admin/operador/garçom) — entra pelo vínculo, sem token.
--     É o PDV e o app do garçom, que já se autenticam.
--   • Cliente na mesa — precisa do token do QR, a loja precisa estar ABERTA, e
--     há um teto de pedidos por mesa na janela de tempo.
--
-- A loja aberta e o teto não são só contenção de abuso: são regra de negócio
-- que faltava. Ninguém pede na mesa de um restaurante fechado.
--
-- COMPATIBILIDADE: QR já impresso, sem o `t=` na URL, para de fechar pedido e
-- mostra um aviso pedindo para chamar o garçom. Hoje são 2 lojas com 1 mesa
-- cada; reimprimir o QR resolve. Ver a aba Mesas → QR Code.

-- ── 1. O segredo da mesa ────────────────────────────────────────────────────
alter table public.mesas
  add column if not exists token uuid not null default gen_random_uuid();

comment on column public.mesas.token is
  'Segredo impresso no QR da mesa. fn_pedido_mesa_criar exige este valor de '
  'quem não é da equipe da loja. Trocar o valor invalida o QR impresso.';

-- `fn_mesa_publica` continua resolvendo a mesa pelo número para ABRIR o
-- cardápio — só não devolve o token. Ver o RETURNS TABLE: o token não entra.

-- ── 2. Resolver a mesa a partir do QR, conferindo o segredo ─────────────────
create or replace function public.fn_mesa_do_qr(p_slug text, p_token uuid)
returns table(id uuid, loja_id uuid, numero integer, nome text,
              capacidade integer, ativo boolean, criado_em timestamptz)
language sql stable security definer set search_path to 'public'
as $$
  select m.id, m.loja_id, m.numero, m.nome, m.capacidade, m.ativo, m.criado_em
  from mesas m join lojas l on l.id = m.loja_id
  where l.slug = p_slug and l.ativo and m.ativo and m.token = p_token
  limit 1;
$$;

revoke execute on function public.fn_mesa_do_qr(text, uuid) from public;
grant execute on function public.fn_mesa_do_qr(text, uuid) to anon, authenticated;

-- ── 3. O pedido de mesa passa a exigir autorização ──────────────────────────
create or replace function public.fn_pedido_mesa_criar(
  p_loja_id uuid,
  p_mesa_id uuid,
  p_identificador text default null,
  p_observacao text default null,
  p_itens jsonb default '[]'::jsonb,
  p_token uuid default null
)
returns table(pedido_id uuid, numero integer)
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_mesa_numero int;
  v_comanda     uuid;
  v_pedido      uuid;
  v_numero      int;
  v_item        jsonb;
  v_opcao       jsonb;
  v_prod        record;
  v_op          record;
  v_qtd         int;
  v_preco_item  numeric;
  v_subtotal    numeric := 0;
  v_item_id     uuid;
  v_tem_cozinha boolean := false;
  v_estacao     text;
  v_prod_nome   text;
  v_da_equipe   boolean;
  v_token_ok    boolean;
  v_recentes    int;
begin
  select m.numero into v_mesa_numero
    from mesas m
   where m.id = p_mesa_id and m.loja_id = p_loja_id and m.ativo;
  if not found then
    raise exception 'Mesa inválida ou inativa para esta loja';
  end if;

  -- ── Quem está pedindo? ──────────────────────────────────────────────────
  v_da_equipe := public.fn_tem_papel(p_loja_id, array['admin','operador','garcom']);

  if not v_da_equipe then
    select exists (
      select 1 from mesas m where m.id = p_mesa_id and m.token = p_token
    ) into v_token_ok;

    if not v_token_ok then
      raise exception 'Este QR não vale mais para pedir. Chame o garçom.'
        using errcode = '42501';
    end if;

    if not public.fn_loja_aberta(p_loja_id) then
      raise exception 'A loja está fechada no momento.' using errcode = '42501';
    end if;

    -- Teto por mesa. Uma mesa grande pedindo em rodadas cabe folgado em 10
    -- pedidos por 10 minutos; um robô, não.
    select count(*) into v_recentes
      from pedidos p
     where p.mesa_numero = v_mesa_numero
       and p.loja_id = p_loja_id
       and p.criado_em > now() - interval '10 minutes';
    if v_recentes >= 10 then
      raise exception 'Muitos pedidos seguidos nesta mesa. Chame o garçom.'
        using errcode = '42501';
    end if;
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido sem itens';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    select pr.estacao_preparo, pr.nome into v_estacao, v_prod_nome
      from produtos pr
     where pr.id = (v_item->>'produto_id')::uuid;

    if (v_estacao is null or v_estacao = 'COZINHA') then
      if coalesce(v_prod_nome, '') not ilike '%coca%'
         and coalesce(v_prod_nome, '') not ilike '%guarana%'
         and coalesce(v_prod_nome, '') not ilike '%fanta%'
         and coalesce(v_prod_nome, '') not ilike '%sprite%'
         and coalesce(v_prod_nome, '') not ilike '%suco%'
         and coalesce(v_prod_nome, '') not ilike '%cerveja%'
         and coalesce(v_prod_nome, '') not ilike '%agua%'
         and coalesce(v_prod_nome, '') not ilike '%buffet%'
         and coalesce(v_prod_nome, '') not ilike '%quilo%' then
        v_tem_cozinha := true;
      end if;
    end if;
  end loop;

  v_comanda := public.fn_comanda_aberta_mesa(p_loja_id, p_mesa_id);

  insert into pedidos (loja_id, tipo_pedido, origem, comanda_id, mesa_numero,
                       identificador_cliente, subtotal, valor_total, observacao,
                       requer_cozinha, status, estacao_atual, etapa_kds_atual, enviado_cozinha_em)
  values (p_loja_id, 'SALAO', 'mesa', v_comanda, v_mesa_numero,
          coalesce(nullif(trim(coalesce(p_identificador, '')), ''), 'Mesa ' || v_mesa_numero), 0, 0,
          nullif(trim(coalesce(p_observacao, '')), ''),
          v_tem_cozinha, 'ACEITO', case when v_tem_cozinha then 'COZINHA' else 'BALCAO' end,
          case when v_tem_cozinha then 'etapa_fila' else null end,
          case when v_tem_cozinha then now() else null end)
  returning pedidos.id, pedidos.numero into v_pedido, v_numero;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    select pr.id, pr.nome, pr.preco into v_prod
      from produtos pr
     where pr.id = (v_item->>'produto_id')::uuid
       and pr.loja_id = p_loja_id
       and pr.disponivel;
    if not found then
      raise exception 'Produto inválido ou indisponível: %', v_item->>'produto_id';
    end if;

    v_qtd := greatest(1, coalesce((v_item->>'quantidade')::int, 1));
    v_preco_item := v_prod.preco;

    for v_opcao in select value from jsonb_array_elements(coalesce(v_item->'opcoes', '[]'::jsonb)) loop
      select o.id, o.nome, o.preco_adicional into v_op
        from opcoes o
        join grupos_opcoes g on g.id = o.grupo_id
       where o.id = (v_opcao->>'opcao_id')::uuid
         and g.produto_id = v_prod.id;
      if not found then
        raise exception 'Opção inválida para o produto %', v_prod.nome;
      end if;
      v_preco_item := v_preco_item + v_op.preco_adicional;
    end loop;

    insert into itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao)
    values (v_pedido, v_prod.id, v_prod.nome, v_preco_item, v_qtd,
            nullif(trim(coalesce(v_item->>'observacao', '')), ''))
    returning id into v_item_id;

    for v_opcao in select value from jsonb_array_elements(coalesce(v_item->'opcoes', '[]'::jsonb)) loop
      select o.id, o.nome, o.preco_adicional into v_op
        from opcoes o
        join grupos_opcoes g on g.id = o.grupo_id
       where o.id = (v_opcao->>'opcao_id')::uuid
         and g.produto_id = v_prod.id;
      insert into itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
      values (v_item_id, v_op.id, v_op.nome, v_op.preco_adicional);
    end loop;

    v_subtotal := v_subtotal + v_preco_item * v_qtd;
  end loop;

  update pedidos set subtotal = v_subtotal, valor_total = v_subtotal where id = v_pedido;

  return query select v_pedido, v_numero;
end;
$function$;

-- A assinatura mudou (ganhou p_token): a antiga continuaria existindo e
-- aceitando anônimo. Derrubar é parte da correção, não limpeza.
drop function if exists public.fn_pedido_mesa_criar(uuid, uuid, text, text, jsonb);

revoke execute on function public.fn_pedido_mesa_criar(uuid, uuid, text, text, jsonb, uuid) from public;
grant execute on function public.fn_pedido_mesa_criar(uuid, uuid, text, text, jsonb, uuid) to anon, authenticated;

-- ── 4. A senha do balcão não é mais queimável de fora ───────────────────────
-- `fn_proxima_senha` avança o contador de senha do dia. Com EXECUTE para anon,
-- qualquer um consegue estourar a numeração da loja. Ela só é chamada por
-- código do servidor e pelo balcão autenticado.
revoke execute on function public.fn_proxima_senha(uuid, smallint) from anon;

comment on function public.fn_pedido_mesa_criar(uuid, uuid, text, text, jsonb, uuid) is
  'Cria o pedido da mesa. Exige equipe da loja OU o token do QR daquela mesa, '
  'com a loja aberta e teto de 10 pedidos por mesa a cada 10 minutos.';
