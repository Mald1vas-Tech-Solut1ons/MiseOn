-- ============================================================================
-- GRUPO OBRIGATÓRIO PASSA A SER OBRIGATÓRIO DE VERDADE
--
-- O FURO MEDIDO (10/09/2026, lendo a função vigente em produção com
-- pg_get_functiondef): `fn_validar_opcao_item_pedido` — a trigger que guarda
-- os modificadores do item — valida quatro coisas e esquece a quinta:
--   ✓ a opção pertence ao produto do item
--   ✓ a opção está disponível
--   ✓ a opção não está duplicada no item
--   ✓ o grupo não passou de `max_escolhas`
--   ✗ NADA valida `min_escolhas`
--
-- E não dá para validar mínimo naquela trigger, por natureza: ela dispara por
-- LINHA de opção inserida. A ausência de linha não dispara trigger nenhuma.
-- O item entrava no pedido sem o ponto da carne e ninguém barrava — em
-- qualquer canal: PDV, garçom, QR do cliente.
--
-- Ou seja: `min_escolhas = 1` era decoração de cadastro. O plano de execução
-- diz o contrário, com todas as letras: "obrigatório ausente destaca o grupo;
-- validação TAMBÉM OCORRE NO SERVIDOR" (docs/SPRINTS-E-UX-LANCAMENTO-MISEON.md,
-- seção "Atendimento e montagem por item").
--
-- ONDE VALIDAR, E POR QUÊ AQUI:
-- Não na criação do item (as opções chegam depois dele, numa segunda escrita)
-- e não a cada opção (a que falta nunca chega). O momento certo é o ENVIO —
-- quando a rodada sai para a praça de preparo. É o mesmo instante para todos
-- os canais, então a regra fica em UM lugar só e vale para o balcão, para o
-- garçom e para o cliente no QR, em vez de três validações de tela que
-- divergem com o tempo.
--
-- QUEM FICA DE FORA, DE PROPÓSITO:
--  • item sem `produto_id` — item avulso ou de canal externo sem de-para; o
--    nosso catálogo não governa o que não é nosso;
--  • pedido do iFood (`ifood_order_id` preenchido) — o marketplace não conhece
--    os nossos grupos e manda o pedido pronto. Barrar aqui recusaria pedido
--    pago do iFood, que é perda de dinheiro e de reputação. A conferência do
--    iFood é outro problema, com outro dono.
--
-- INVARIANTE PRESERVADA: nenhum pedido existente muda de estado por causa
-- desta migration. Ela só passa a RECUSAR o envio de um item incompleto, com
-- mensagem que nomeia o item e o grupo que falta — "erro recuperável: informar
-- item afetado e correção", como o plano exige.
-- ============================================================================

-- ── Consulta: o que falta neste item? ───────────────────────────────────────
-- Devolve o nome do primeiro grupo obrigatório não atendido, ou null quando o
-- item está completo. A tela usa isto para DESTACAR o grupo antes do envio,
-- em vez de deixar o operador descobrir no erro.
create or replace function public.fn_item_falta_obrigatorio(p_item_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select g.nome
    from itens_pedido ip
    join grupos_opcoes g on g.produto_id = ip.produto_id
   where ip.id = p_item_id
     and ip.produto_id is not null
     and coalesce(g.min_escolhas, 0) > 0
     and (
       select count(*)
         from itens_pedido_opcoes ipo
         join opcoes o on o.id = ipo.opcao_id
        where ipo.item_id = ip.id
          and o.grupo_id = g.id
     ) < g.min_escolhas
   order by g.ordem, g.nome
   limit 1;
$function$;

comment on function public.fn_item_falta_obrigatorio(uuid) is
  'Nome do primeiro grupo obrigatorio ainda nao respondido no item, ou null se completo. Serve para a tela destacar o grupo antes do envio.';

-- ── Consulta: o que falta no pedido inteiro? ────────────────────────────────
-- Uma linha por pendência, com o nome do produto junto: é o que a revisão da
-- rodada mostra ao garçom sem obrigá-lo a abrir item por item.
create or replace function public.fn_pedido_faltas_obrigatorias(p_pedido_id uuid)
returns table (item_id uuid, produto text, grupo text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select ip.id, ip.nome_produto, fn_item_falta_obrigatorio(ip.id)
    from itens_pedido ip
   where ip.pedido_id = p_pedido_id
     and ip.produto_id is not null
     and fn_item_falta_obrigatorio(ip.id) is not null;
$function$;

comment on function public.fn_pedido_faltas_obrigatorias(uuid) is
  'Pendencias de modificador obrigatorio do pedido inteiro, para a revisao da rodada.';

revoke execute on function public.fn_item_falta_obrigatorio(uuid) from public, anon;
revoke execute on function public.fn_pedido_faltas_obrigatorias(uuid) from public, anon;
grant execute on function public.fn_item_falta_obrigatorio(uuid) to authenticated;
grant execute on function public.fn_pedido_faltas_obrigatorias(uuid) to authenticated;

-- ── A trava no envio ────────────────────────────────────────────────────────
-- Base: definição vigente em produção lida com pg_get_functiondef em
-- 10/09/2026. O corpo original está preservado; a única adição é o bloco de
-- verificação ANTES de despachar os tickets — não adianta recusar depois que
-- a cozinha já viu o item.
create or replace function public.fn_trg_despachar_kds_ao_aceitar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_despachou boolean;
  v_falta     record;
BEGIN
  -- Despacha quando o pedido passa para ACEITO ou PREPARANDO
  -- (garante que iFood e outros canais também geram tickets)
  IF NEW.status IN ('ACEITO', 'PREPARANDO')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('ACEITO', 'PREPARANDO', 'PRONTO'))
  THEN
    -- TRAVA DE MONTAGEM (10/09/2026): item do nosso catálogo não vai para a
    -- praça sem os modificadores obrigatórios respondidos. Pedido do iFood
    -- está isento: o marketplace manda o pedido pronto e já pago, e recusá-lo
    -- aqui seria perder venda por regra nossa.
    IF NEW.ifood_order_id IS NULL THEN
      SELECT * INTO v_falta
        FROM public.fn_pedido_faltas_obrigatorias(NEW.id)
       LIMIT 1;

      IF v_falta.item_id IS NOT NULL THEN
        RAISE EXCEPTION 'Falta escolher "%" em "%". Complete o item antes de enviar para a cozinha.',
          v_falta.grupo, v_falta.produto
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    v_despachou := public.fn_despachar_kds_tickets(NEW.id);

    -- No modelo por tickets a cozinha já vê o pedido na hora (não existe mais
    -- o clique manual de "mandar pra cozinha"); adiantamos aqui as MESMAS
    -- transições que esse clique faria (fn_valida_estacao_pedido /
    -- fn_valida_transicao_pedido), senão fn_verificar_pedido_completo_kds
    -- tentaria pular direto de ACEITO pra PRONTO com item de cozinha
    -- pendente e o validador rejeitaria.
    IF v_despachou AND NEW.status = 'ACEITO' AND NEW.requer_cozinha THEN
      IF NEW.estacao_atual = 'BALCAO' THEN
        UPDATE public.pedidos SET estacao_atual = 'COZINHA' WHERE id = NEW.id;
      END IF;
      UPDATE public.pedidos SET status = 'PREPARANDO' WHERE id = NEW.id AND status = 'ACEITO';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
