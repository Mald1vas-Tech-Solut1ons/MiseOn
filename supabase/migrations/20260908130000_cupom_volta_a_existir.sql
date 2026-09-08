-- ============================================================================
-- SPRINT 9: O CUPOM NUNCA FUNCIONOU — E DIZIA A COISA ERRADA AO CLIENTE
--
-- ─── O BUG ────────────────────────────────────────────────────────────────
-- fn_validar_cupom declara RETURNS TABLE(id, codigo, descricao, tipo, valor,
-- pedido_minimo, desconto). Esses nomes viram VARIÁVEIS dentro da função, e o
-- corpo fazia:
--
--     select * into c from cupons
--      where upper(btrim(codigo)) = upper(btrim(p_codigo))
--
-- `codigo` aí é ambíguo — coluna da tabela ou parâmetro de saída? O Postgres
-- recusa: 42702 "column reference codigo is ambiguous". TODA chamada estourava.
-- Nenhum cupom jamais foi aplicado neste sistema; o cliente via "Cupom
-- inválido ou expirado" para cupom perfeitamente válido.
--
-- ─── O SEGUNDO PROBLEMA: A MENSAGEM ───────────────────────────────────────
-- Mesmo consertando a ambiguidade, todas as recusas caíam numa frase só
-- ("inválido ou expirado"), porque a elegibilidade inteira estava num único
-- WHERE. Cupom vencido, cupom de PIX usado no cartão, cupom que estourou o
-- limite e cupom que não existe são situações DIFERENTES, e o cliente que
-- digitou certo merece saber qual delas é a dele — senão ele tenta de novo,
-- desiste, e o lojista perde a venda achando que o cupom "não pega".
--
-- Aqui a busca é separada da elegibilidade: acha pelo código, depois explica.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_validar_cupom(
  p_loja_id uuid,
  p_codigo text,
  p_subtotal numeric DEFAULT 0,
  p_metodo text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, codigo text, descricao text, tipo text, valor numeric,
              pedido_minimo numeric, desconto numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  c         record;
  v_cliente uuid;
begin
  -- Alias obrigatório: sem `cu.` o Postgres não sabe se `codigo` é a coluna
  -- ou o parâmetro de saída homônimo. Era exatamente esse o 42702.
  select cu.* into c
    from cupons cu
   where cu.loja_id = p_loja_id
     and upper(btrim(cu.codigo)) = upper(btrim(coalesce(p_codigo, '')));

  if not found then
    raise exception 'Não encontramos esse cupom nesta loja. Confira o código.';
  end if;

  if not c.ativo then
    raise exception 'Este cupom não está mais disponível.';
  end if;

  if c.validade is not null and c.validade < current_date then
    raise exception 'Este cupom venceu em %.', to_char(c.validade, 'DD/MM/YYYY');
  end if;

  if c.limite_usos is not null and coalesce(c.usos, 0) >= c.limite_usos then
    raise exception 'Este cupom já atingiu o limite de usos.';
  end if;

  -- Cupom amarrado a forma de pagamento é promoção de custo (Pix não tem taxa
  -- de adquirente). Dizer QUAL forma resolve, em vez de recusar seco.
  if c.metodo_exigido is not null and p_metodo is not null
     and c.metodo_exigido::text <> p_metodo then
    raise exception 'Este cupom vale só no pagamento por %.',
      case c.metodo_exigido::text
        when 'PIX' then 'Pix'
        when 'CREDITO' then 'cartão de crédito'
        when 'DEBITO' then 'cartão de débito'
        when 'DINHEIRO' then 'dinheiro'
        else c.metodo_exigido::text
      end;
  end if;

  if coalesce(p_subtotal, 0) < coalesce(c.pedido_minimo, 0) then
    raise exception 'Este cupom vale a partir de R$ %.',
      to_char(c.pedido_minimo, 'FM999G999D00');
  end if;

  if c.apenas_primeiro_pedido then
    select cl.id into v_cliente
      from clientes cl
     where cl.user_id = auth.uid() and cl.loja_id = p_loja_id;

    if v_cliente is not null and exists (
      select 1 from pedidos ant
       where ant.cliente_id = v_cliente
         and ant.loja_id = p_loja_id
         and ant.status = 'FINALIZADO'
    ) then
      raise exception 'Este cupom é só para a primeira compra.';
    end if;
  end if;

  return query select
    c.id, c.codigo, c.descricao, c.tipo::text, c.valor, c.pedido_minimo,
    case when c.tipo = 'FIXO'
      then least(c.valor, coalesce(p_subtotal, 0))
      else round(coalesce(p_subtotal, 0) * c.valor / 100, 2) end;
end;
$function$;

COMMENT ON FUNCTION public.fn_validar_cupom(uuid, text, numeric, text) IS
  'Valida cupom e devolve o desconto. Cada recusa tem motivo próprio (não '
  'existe / inativo / vencido / limite / forma de pagamento / mínimo / '
  'primeira compra) — antes tudo virava "inválido ou expirado", e na prática '
  'nem chegava lá: a função estourava 42702 por ambiguidade em `codigo`.';
