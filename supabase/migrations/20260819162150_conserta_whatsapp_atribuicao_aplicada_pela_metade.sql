-- A migration 20260815180000_whatsapp_atribuicao.sql existe no repo mas entrou
-- pela metade em produção: as colunas (chat_conversations.atribuicao_token,
-- pedidos.chat_conversation_id) e o índice idx_pedidos_chat_conversation estão
-- lá, mas a FUNÇÃO e o índice do token nunca foram criados.
--
-- Efeito em produção: CheckoutDrawer.enviar() chamava
-- supabase.rpc('fn_atribuir_conversa_ao_pedido', ...) sem checar o retorno.
-- A chamada falhava com "function does not exist" e o erro era descartado — o
-- vínculo pedido <-> conversa de WhatsApp simplesmente nunca aconteceu, sem
-- nenhum sinal. Toda atribuição de pedido vindo do link ?wa= estava perdida.

create index if not exists idx_chat_conversations_atribuicao_token
  on public.chat_conversations(atribuicao_token);

create or replace function public.fn_atribuir_conversa_ao_pedido(
  p_pedido_id uuid,
  p_wa_token  text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_conv_id uuid;
  v_loja_id uuid;
  v_p_loja  uuid;
begin
  if p_wa_token is null or btrim(p_wa_token) = '' then
    return false;
  end if;

  select loja_id into v_p_loja from public.pedidos where id = p_pedido_id;
  if not found then
    return false;
  end if;

  select id, loja_id into v_conv_id, v_loja_id
  from public.chat_conversations
  where atribuicao_token = p_wa_token;

  -- A conversa tem que ser da MESMA loja do pedido.
  if found and v_conv_id is not null and v_loja_id = v_p_loja then
    update public.pedidos
       set chat_conversation_id = v_conv_id,
           origem = 'whatsapp'
     where id = p_pedido_id;
    return true;
  end if;

  return false;
end;
$fn$;

comment on function public.fn_atribuir_conversa_ao_pedido(uuid, text) is
  'Associa o pedido criado no checkout a conversa de WhatsApp de onde o cliente veio via link ?wa=. Reaplicada em 19/08: a migration original entrou sem a funcao.';

-- O arquivo original concedia a anon também. O checkout que chama isto é
-- autenticado, e a função não valida o dono do pedido — só a loja. Sem anon.
revoke all on function public.fn_atribuir_conversa_ao_pedido(uuid, text) from public, anon;
grant execute on function public.fn_atribuir_conversa_ao_pedido(uuid, text) to authenticated, service_role;
