-- ============================================================================
-- SPRINT 9: A MÁQUINA DE ESTADOS E A BAIXA DE ESTOQUE APRENDEM O ESTADO NOVO
--
-- Par da 20260908140000 (que criou AGUARDANDO_PAGAMENTO no enum). Aqui as duas
-- funções que precisam conhecê-lo:
--
-- 1. fn_valida_transicao_pedido — carrinho em pagamento não é operação: só
--    pode virar pedido de verdade (NOVO/ACEITO, quando o gateway confirma) ou
--    ser cancelado. Não passa por regra de bastão porque nunca esteve na mão
--    de ninguém.
--
-- 2. fn_trg_status_pedido — ARMADILHA: a baixa de estoque acontecia em
--    `NEW.status = 'ACEITO' AND OLD.status = 'NOVO'`. Com o pedido online
--    passando a sair de AGUARDANDO_PAGAMENTO, o estoque NÃO baixaria: saldo
--    alto e CMV baixo, em silêncio, exatamente o tipo de erro que só aparece
--    no inventário do mês seguinte.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_valida_transicao_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  eh_admin boolean;
begin
  if NEW.status = OLD.status then
    return NEW;
  end if;

  -- CARRINHO EM PAGAMENTO
  if OLD.status = 'AGUARDANDO_PAGAMENTO' then
    if NEW.status in ('NOVO', 'ACEITO', 'CANCELADO') then
      return NEW;
    end if;
    raise exception 'Pedido #% ainda aguarda a confirmação do pagamento.', OLD.numero;
  end if;

  -- CONCLUSAO VINDA DO IFOOD: aviso, nao pedido de permissao (ver histórico
  -- em 20260821213521 — o veto deixava MiseOn e iFood divergentes para sempre).
  if NEW.status = 'FINALIZADO'
     and OLD.origem = 'ifood'
     and auth.uid() is null
     and OLD.status not in ('FINALIZADO','CANCELADO') then
    NEW.conferido_em := coalesce(OLD.conferido_em, now());
    return NEW;
  end if;

  if OLD.status = 'NOVO' and NEW.status = 'ACEITO' then
    return NEW;
  end if;

  if OLD.status = 'ACEITO' and NEW.status = 'PREPARANDO' then
    if OLD.estacao_atual <> 'COZINHA' then
      raise exception 'Pedido #% ainda não foi enviado para a cozinha.', OLD.numero;
    end if;
    return NEW;
  end if;

  if OLD.status = 'ACEITO' and NEW.status = 'PRONTO' then
    if OLD.requer_cozinha then
      raise exception 'Pedido #% tem item de preparo — envie para a cozinha antes de marcar pronto.', OLD.numero;
    end if;
    return NEW;
  end if;

  if OLD.status = 'PREPARANDO' and NEW.status = 'PRONTO' then
    if OLD.estacao_atual <> 'COZINHA' then
      raise exception 'Pedido #% não está com a cozinha no momento.', OLD.numero;
    end if;
    NEW.estacao_atual := 'BALCAO';
    NEW.devolvido_balcao_em := now();
    return NEW;
  end if;

  if OLD.status = 'PRONTO' and NEW.status in ('EM_ROTA','FINALIZADO') then
    if OLD.estacao_atual <> 'BALCAO' then
      raise exception 'Pedido #% ainda está com a cozinha.', OLD.numero;
    end if;
    if NEW.status = 'EM_ROTA' and OLD.tipo_pedido <> 'DELIVERY' then
      raise exception 'Só pedidos de entrega saem para rota.';
    end if;
    if NEW.status = 'FINALIZADO' and OLD.tipo_pedido = 'DELIVERY' then
      raise exception 'Pedido de entrega precisa sair para rota antes de finalizar.';
    end if;
    NEW.conferido_em := coalesce(OLD.conferido_em, now());
    return NEW;
  end if;

  if OLD.status = 'EM_ROTA' and NEW.status = 'FINALIZADO' then
    return NEW;
  end if;

  if NEW.status = 'FINALIZADO' and OLD.tipo_pedido = 'SALAO' and OLD.status not in ('FINALIZADO','CANCELADO') then
    return NEW;
  end if;

  if NEW.status = 'CANCELADO' then
    if OLD.status in ('FINALIZADO','CANCELADO') then
      raise exception 'Pedido #% já foi encerrado.', OLD.numero;
    end if;
    if OLD.status in ('NOVO','ACEITO') and OLD.estacao_atual = 'BALCAO' then
      return NEW;
    end if;
    if auth.uid() is null then
      return NEW;
    end if;
    eh_admin := exists (
      select 1 from usuarios_loja
      where user_id = auth.uid() and loja_id = OLD.loja_id and papel = 'admin'
    );
    if not eh_admin then
      raise exception 'A cozinha já iniciou este pedido — só um admin pode cancelar agora.';
    end if;
    return NEW;
  end if;

  raise exception 'Transição de status inválida: % → % (pedido #%).', OLD.status, NEW.status, OLD.numero;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_trg_status_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.atualizado_em = now();

  -- Sem mudanca de status nao ha nada a compensar: sair antes dos estornos.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- ACEITO: baixa o estoque. Origem NOVO (dinheiro/balcão) ou
  -- AGUARDANDO_PAGAMENTO (online, quando o gateway confirmou).
  IF NEW.status = 'ACEITO' AND OLD.status IN ('NOVO', 'AGUARDANDO_PAGAMENTO') THEN
    PERFORM fn_baixar_estoque(NEW.id);
    NEW.estoque_baixado = true;
  END IF;

  -- CANCELADO: estorna estoque. ENTRADA (e não AJUSTE) de propósito: só
  -- ENTRADA abre lote PEPS, e o custo_total original viaja junto para o lote
  -- recriado voltar com o custo que tinha sido consumido (Sprint 1, S1-C).
  IF NEW.status = 'CANCELADO' AND OLD.estoque_baixado THEN
    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, custo_total, motivo, pedido_id)
    SELECT m.loja_id, m.insumo_id, 'ENTRADA', -m.quantidade, m.custo_total, 'Estorno por cancelamento', m.pedido_id
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA';

    UPDATE insumos i SET quantidade_atual = i.quantidade_atual - m.quantidade
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA' AND i.id = m.insumo_id;
  END IF;

  -- CANCELADO: estorno financeiro no NEW, nunca com UPDATE aninhado (erro 27000).
  IF NEW.status = 'CANCELADO' AND OLD.receita_lancada THEN
    NEW.receita_lancada := NOT fn_lancar_estorno_pedido(NEW.id);
  END IF;

  -- FINALIZADO: credita cashback e lança receita no ledger (fonte única).
  IF NEW.status = 'FINALIZADO' AND OLD.status IS DISTINCT FROM 'FINALIZADO' THEN
    PERFORM fn_creditar_cashback(NEW.id);
    NEW.receita_lancada = fn_lancar_receita_pedido(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.fn_valida_transicao_pedido() IS
  'Máquina de estados do pedido. Desde 20260908 conhece AGUARDANDO_PAGAMENTO: '
  'carrinho em pagamento online, que só vira pedido quando o gateway confirma '
  '(ou é cancelado).';
