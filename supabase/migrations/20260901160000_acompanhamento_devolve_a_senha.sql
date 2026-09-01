-- O cliente que pede pelo celular e espera no balcao nao via a propria senha.
--
-- `fn_acompanhar_pedido` devolvia so `numero`, entao a tela de acompanhamento
-- mostrava "Pedido #9279" enquanto a TV do balcao chamava "12". O cliente fica
-- olhando o celular esperando o 9279 aparecer no painel, nao aparece nunca, e
-- ele vai perguntar no balcao — que e exatamente a fila que o painel existe
-- para eliminar.
--
-- Passa a devolver `senha` junto. NULL em delivery, onde ninguem e chamado.

create or replace function public.fn_acompanhar_pedido(p_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id',                     p.id,
    'loja_id',                p.loja_id,
    'numero',                 p.numero,
    'senha',                  p.senha,
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
$function$;
