-- ============================================================================
-- SPRINT 14: O KDS RECEBE O ITEM QUANDO ELE ENTRA, NÃO SÓ QUANDO O STATUS MUDA
--
-- Medido em produção (pedido #284, origem garcom_mobile):
--   status = PREPARANDO, estacao_atual = COZINHA, requer_cozinha = true
--   kds_tickets = 0
-- O pedido estava "na cozinha" para o sistema e invisível para a cozinha.
--
-- POR QUÊ: trg_despachar_kds_ao_aceitar é AFTER INSERT OR UPDATE OF status.
-- Vários canais criam o pedido JÁ em ACEITO e só depois inserem os itens:
--   • garçom mobile (PainelGarcomMobile.lancarItemFracionado)
--   • balança/buffet (fn_registrar_pesagem_comanda)
--   • item avulso na comanda (fn_lancar_item_avulso_comanda)
-- No instante do INSERT do pedido não existe item nenhum, então o despacho
-- roda em cima de lista vazia e cria zero ticket. Depois, inserir item não
-- mexe no status — nada redispara. E o clique manual "Enviar para a cozinha"
-- (ACEITO → PREPARANDO) esbarra na guarda anti-duplicação do próprio trigger
-- (OLD.status NOT IN ('ACEITO','PREPARANDO','PRONTO')), que existe para não
-- despachar duas vezes o mesmo pedido.
--
-- CORREÇÃO: despachar também quando o ITEM entra num pedido que já está na
-- operação. fn_despachar_kds_tickets já é idempotente por
-- ON CONFLICT (pedido_id, estacao_id) DO NOTHING, então rodar de novo não
-- duplica ticket — só preenche o que faltava.
--
-- LIMITE CONHECIDO (registrado, não corrigido aqui): o ON CONFLICT protege
-- contra ticket duplicado por estação, mas um item inserido DEPOIS de o ticket
-- daquela estação já existir não é adicionado ao ticket existente. Isso vale
-- para rodada nova na mesma comanda. Ver backlog "ticket incremental por
-- rodada" em docs/ENGENHARIA-ESTOQUE-E-NOTA.md.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_trg_despachar_kds_ao_inserir_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.pedidos WHERE id = NEW.pedido_id;

  -- Só desperta para pedido que já está na operação. Carrinho aguardando
  -- pagamento (AGUARDANDO_PAGAMENTO) e pedido novo ainda não aceito não podem
  -- chegar na cozinha — é a mesma regra do fluxo de pagamento.
  IF v_status IN ('ACEITO', 'PREPARANDO') THEN
    PERFORM public.fn_despachar_kds_tickets(NEW.pedido_id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_despachar_kds_ao_inserir_item ON public.itens_pedido;

CREATE TRIGGER trg_despachar_kds_ao_inserir_item
  AFTER INSERT ON public.itens_pedido
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_despachar_kds_ao_inserir_item();

REVOKE ALL ON FUNCTION public.fn_trg_despachar_kds_ao_inserir_item()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.fn_trg_despachar_kds_ao_inserir_item() IS
  'Despacha o KDS quando o item entra num pedido que já está em ACEITO/PREPARANDO. Cobre os canais que criam o pedido antes dos itens (garçom, balança, item avulso na comanda), onde o despacho por mudança de status roda em lista vazia.';
