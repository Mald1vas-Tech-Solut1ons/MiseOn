-- O UUID do pedido identifica o registro; ele não é uma credencial.
--
-- A versão anterior aceitava qualquer chamada anônima que conhecesse o UUID e
-- devolvia nome, endereço, itens e pagamento. Esta versão mantém a resposta
-- mínima usada pela tela, mas só para o cliente dono ou para a equipe da loja.
-- Compartilhamento público exigirá um token separado e revogável; até ele
-- existir, é mais seguro negar o link fora da sessão autenticada.

create or replace function public.fn_acompanhar_pedido(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
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
          from public.itens_pedido_opcoes ipo
          where ipo.item_id = ip.id
        ), '[]'::jsonb)
      ))
      from public.itens_pedido ip
      where ip.pedido_id = p.id
    ), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'metodo', pg.metodo,
        'status', pg.status,
        'valor_pago', pg.valor_pago
      ))
      from public.pagamentos pg
      where pg.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from public.pedidos p
  where p.id = p_id
    and auth.uid() is not null
    and (
      p.cliente_user_id = auth.uid()
      or public.fn_meu_acesso(p.loja_id)
    );
$function$;

revoke execute on function public.fn_acompanhar_pedido(uuid) from public, anon;
grant execute on function public.fn_acompanhar_pedido(uuid) to authenticated;

comment on function public.fn_acompanhar_pedido(uuid) is
  'Acompanhamento privado: somente o cliente dono ou a equipe da loja. O UUID do pedido não concede acesso.';
