-- Cancelamento de pedido: motivo, origem e carimbo de sincronizacao com o iFood
--
-- CONTEXTO
-- O Painel de Pedidos cancelava com um `confirm()` do navegador e um UPDATE de
-- status. Tres consequencias:
--
--   1. O motivo NUNCA era gravado. `motivo_cancelamento` so era preenchido
--      quando o cancelamento vinha do iFood. Cancelamento da loja ficava sem
--      historia: ninguem sabia por que o pedido caiu.
--
--   2. O aviso ao iFood saia por gatilho + pg_net, sem retorno. Se o iFood
--      recusasse (ele exige um codigo da lista DELE, que muda conforme o
--      estagio do pedido), o MiseOn dizia "cancelado" e o cliente continuava
--      com o pedido ativo no app. Divergencia silenciosa entre dois sistemas.
--
--   3. Sem registro de QUEM cancelou, a protecao contra eco dependia de um
--      prefixo "[iFood]" no texto do motivo — regra escondida numa string.
--
-- O QUE MUDA AQUI
-- Tres colunas de proveniencia e uma RPC que grava status e motivo juntos.
-- O carimbo `ifood_cancelamento_em` passa a ser a autoridade sobre "isto ja
-- foi acertado com o iFood", no lugar do prefixo no texto.

alter table public.pedidos
  add column if not exists ifood_cancelamento_em     timestamptz,
  add column if not exists ifood_cancelamento_codigo text,
  add column if not exists ifood_cancelamento_origem text;

comment on column public.pedidos.ifood_cancelamento_em is
  'Quando o cancelamento foi acertado com o iFood. Preenchido, impede o gatilho de mandar um segundo requestCancellation.';
comment on column public.pedidos.ifood_cancelamento_codigo is
  'cancelCodeId escolhido na lista que o iFood devolveu para este pedido.';
comment on column public.pedidos.ifood_cancelamento_origem is
  'LOJA = partiu do lojista. IFOOD = chegou pelo evento CAN.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pedidos_ifood_cancelamento_origem_check'
  ) then
    alter table public.pedidos
      add constraint pedidos_ifood_cancelamento_origem_check
      check (ifood_cancelamento_origem is null or ifood_cancelamento_origem in ('LOJA','IFOOD'));
  end if;
end $$;

-- ── Correcao necessaria antes do backfill ───────────────────────────────────
-- fn_trg_status_pedido roda em BEGIN UPDATE de QUALQUER coluna, e os ramos de
-- cancelamento so olhavam para `NEW.status = 'CANCELADO'` — sem perguntar se o
-- status MUDOU nesta operacao. Resultado: qualquer UPDATE posterior num pedido
-- ja cancelado (o backfill abaixo, o carimbo que a Edge Function grava, uma
-- correcao manual) reexecutava o estorno de estoque e o estorno financeiro.
-- Estoque subia de novo, ledger levava outro lancamento.
--
-- Nunca apareceu porque, ate agora, ninguem escrevia num pedido depois de
-- cancelado. A partir deste commit a Edge Function escreve — entao a guarda
-- deixa de ser higiene e vira requisito.
create or replace function public.fn_trg_status_pedido()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  NEW.atualizado_em = now();

  -- Sem mudanca de status nao ha nada a compensar: sair antes dos estornos.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- ACEITO: baixa o estoque
  IF NEW.status = 'ACEITO' AND OLD.status = 'NOVO' THEN
    PERFORM fn_baixar_estoque(NEW.id);
    NEW.estoque_baixado = true;
  END IF;

  -- CANCELADO: estorna estoque
  IF NEW.status = 'CANCELADO' AND OLD.estoque_baixado THEN
    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    SELECT m.loja_id, m.insumo_id, 'AJUSTE', -m.quantidade, 'Estorno por cancelamento', m.pedido_id
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA';

    UPDATE insumos i SET quantidade_atual = i.quantidade_atual - m.quantidade
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA' AND i.id = m.insumo_id;
  END IF;

  -- CANCELADO: estorno financeiro (marca receita_lancada=false no NEW, nunca
  -- com UPDATE aninhado — isso derruba a transação com erro 27000)
  IF NEW.status = 'CANCELADO' AND OLD.receita_lancada THEN
    NEW.receita_lancada := NOT fn_lancar_estorno_pedido(NEW.id);
  END IF;

  -- FINALIZADO: credita cashback e lança receita no ledger
  IF NEW.status = 'FINALIZADO' AND OLD.status IS DISTINCT FROM 'FINALIZADO' THEN
    PERFORM fn_creditar_cashback(NEW.id);
    NEW.receita_lancada := fn_lancar_receita_pedido(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: os cancelamentos que ja existem carregam a origem no prefixo do
-- texto. Move a informacao para a coluna e devolve o motivo limpo para a tela.
update public.pedidos
   set ifood_cancelamento_origem = 'IFOOD',
       ifood_cancelamento_em     = coalesce(ifood_cancelamento_em, atualizado_em),
       motivo_cancelamento       = nullif(btrim(replace(motivo_cancelamento, '[iFood]', '')), '')
 where status = 'CANCELADO'
   and motivo_cancelamento like '[iFood]%';

-- ── RPC: cancelar gravando o motivo ─────────────────────────────────────────
-- Existe separada de fn_avancar_status_pedido porque cancelamento carrega um
-- dado que as outras transicoes nao tem (o motivo), e porque juntar os dois
-- numa RPC generica convidaria a passar motivo em transicao que nao e
-- cancelamento. As regras de quem pode cancelar continuam onde sempre
-- estiveram: no gatilho fn_valida_transicao_pedido.
create or replace function public.fn_cancelar_pedido(
  p_pedido_id uuid,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_loja_id uuid;
begin
  select loja_id into v_loja_id from pedidos where id = p_pedido_id;
  if v_loja_id is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if not exists (
    select 1 from usuarios_loja where user_id = auth.uid() and loja_id = v_loja_id
  ) then
    raise exception 'Acesso negado.';
  end if;

  update pedidos
     set status              = 'CANCELADO',
         motivo_cancelamento = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = p_pedido_id;
end;
$function$;

revoke all on function public.fn_cancelar_pedido(uuid, text) from public, anon;
grant execute on function public.fn_cancelar_pedido(uuid, text) to authenticated;
