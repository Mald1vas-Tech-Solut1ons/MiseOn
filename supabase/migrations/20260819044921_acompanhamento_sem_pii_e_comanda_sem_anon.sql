-- ═══════════════════════════════════════════════════════════════════════════
-- 1. fn_acompanhar_pedido devolvia to_jsonb(pedidos) — a LINHA INTEIRA, para
--    anon. Ia junto telefone, CEP, logradouro, lat/lng, cliente_id,
--    cliente_user_id, dados de iFood e campos internos de KDS/fiscal. O UUID do
--    pedido funciona como senha (é o padrão de rastreio), mas o link é
--    compartilhável e não expira: quanto menos dado pessoal ele carregar,
--    melhor. Passa a devolver só o que a tela /pedido/:id realmente usa.
--
--    Campos conferidos um a um em src/pages/Pedido.tsx: numero, status,
--    tipo_pedido, identificador_cliente, endereco_entrega, bairro,
--    complemento, numero_endereco, subtotal, taxa_entrega, desconto,
--    valor_total, rota_id, agendado_para, mesa_numero, loja_id, id, itens e
--    pagamentos. O mapa do entregador NÃO vem daqui (vem de
--    localizacao_entregador), então lat/lng saem sem prejuízo.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function fn_acompanhar_pedido(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'id',                     p.id,
    'loja_id',                p.loja_id,
    'numero',                 p.numero,
    'status',                 p.status,
    'tipo_pedido',            p.tipo_pedido,
    'identificador_cliente',  p.identificador_cliente,
    'endereco_entrega',       p.endereco_entrega,
    'bairro',                 p.bairro,
    'complemento',            p.complemento,
    'numero_endereco',        p.numero_endereco,
    'subtotal',               p.subtotal,
    'taxa_entrega',           p.taxa_entrega,
    'desconto',               p.desconto,
    'cashback_usado',         p.cashback_usado,
    'valor_total',            p.valor_total,
    'observacao',             p.observacao,
    'motivo_cancelamento',    p.motivo_cancelamento,
    'agendado_para',          p.agendado_para,
    'mesa_numero',            p.mesa_numero,
    'rota_id',                p.rota_id,
    'criado_em',              p.criado_em,
    'itens_pedido', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',             ip.id,
        'nome_produto',   ip.nome_produto,
        'quantidade',     ip.quantidade,
        'preco_unitario', ip.preco_unitario,
        'observacao',     ip.observacao,
        'itens_pedido_opcoes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'nome_opcao',      ipo.nome_opcao,
            'preco_adicional', ipo.preco_adicional
          ))
          from itens_pedido_opcoes ipo where ipo.item_id = ip.id
        ), '[]'::jsonb)
      ))
      from itens_pedido ip where ip.pedido_id = p.id
    ), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object('metodo', pg.metodo, 'status', pg.status, 'valor_pago', pg.valor_pago))
      from pagamentos pg where pg.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from pedidos p where p.id = p_id;
$fn$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. fn_comanda_aberta_mesa: com loja_id público (lojas_publicas) e mesa_id,
--    qualquer anônimo abria comanda em mesa livre — o salão passava a ver mesa
--    ocupada sem ninguém sentado.
--
--    Quem precisa dela de fato:
--      · o PDV/garçom (src/lib/comandas.ts, chamado só de PDV.tsx) — logado;
--      · fn_pedido_mesa_criar, que a chama POR DENTRO. Como aquela função é
--        SECURITY DEFINER, a checagem de privilégio da chamada interna usa o
--        dono da função, não o anônimo que fez o request — então o pedido por
--        QR continua funcionando normalmente sem o GRANT para anon.
-- ═══════════════════════════════════════════════════════════════════════════

revoke execute on function fn_comanda_aberta_mesa(uuid, uuid) from anon;
