-- Entregador enxergava a loja inteira.
--
-- Medido em 03/09/2026 no tenant de provas, com a sessao de um entregador real:
-- 44 pedidos visiveis (36 deles nem eram delivery), 41 sem entregador atribuido,
-- 37 telefones de cliente e os 44 pagamentos da loja. A causa: a policy
-- `adm_pedidos` chamava `fn_meu_acesso(loja_id)`, que so pergunta "voce pertence
-- a esta loja?" — sem olhar o papel. Motoboy terceirizado ficava com a carteira
-- de clientes na mao (dado pessoal, LGPD).
--
-- Regra de negocio: entregador ve pedido de DELIVERY que esteja na fila (sem
-- entregador atribuido) ou que seja dele. Nada de salao, nada de balcao, nada
-- de pagamento. Admin, operador e garcom seguem exatamente como antes.

ALTER POLICY adm_pedidos ON public.pedidos
USING (
  fn_meu_acesso(loja_id)
  AND (
    COALESCE(fn_meu_papel(loja_id), '') <> 'entregador'
    OR (
      tipo_pedido = 'DELIVERY'::tipo_pedido
      AND (
        entregador_id IS NULL
        OR entregador_id IN (SELECT id FROM public.entregadores WHERE user_id = auth.uid())
      )
    )
  )
);

ALTER POLICY adm_pgto ON public.pagamentos
USING (
  fn_meu_acesso((SELECT p.loja_id FROM public.pedidos p WHERE p.id = pagamentos.pedido_id))
  AND COALESCE(
        fn_meu_papel((SELECT p.loja_id FROM public.pedidos p WHERE p.id = pagamentos.pedido_id)),
        ''
      ) <> 'entregador'
);
