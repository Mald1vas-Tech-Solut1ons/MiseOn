-- ============================================================================
-- E5: ATRIBUIÇÃO DE PEDIDO AO CHAT DO WHATSAPP (CICLO FECHADO)
-- ============================================================================

-- 1. Coluna de token temporário de atribuição na conversa do WhatsApp
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS atribuicao_token TEXT UNIQUE;

-- 2. Coluna no pedido vinculando à conversa de origem
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS chat_conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL;

-- Index para buscas rápidas no painel e relatórios
CREATE INDEX IF NOT EXISTS idx_pedidos_chat_conversation ON public.pedidos(chat_conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_atribuicao_token ON public.chat_conversations(atribuicao_token);

-- 3. RPC para vincular o pedido à conversa via token ?wa=
CREATE OR REPLACE FUNCTION public.fn_atribuir_conversa_ao_pedido(
  p_pedido_id UUID,
  p_wa_token  TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id  UUID;
  v_loja_id  UUID;
  v_p_loja   UUID;
BEGIN
  IF p_wa_token IS NULL OR trim(p_wa_token) = '' THEN
    RETURN FALSE;
  END IF;

  -- Busca o pedido
  SELECT loja_id INTO v_p_loja FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Busca a conversa correspondente pelo token
  SELECT id, loja_id INTO v_conv_id, v_loja_id
  FROM public.chat_conversations
  WHERE atribuicao_token = p_wa_token;

  -- Validação estrita de segurança: a conversa deve pertencer à MESMA loja do pedido
  IF FOUND AND v_conv_id IS NOT NULL AND v_loja_id = v_p_loja THEN
    UPDATE public.pedidos
    SET
      chat_conversation_id = v_conv_id,
      origem = 'whatsapp'
    WHERE id = p_pedido_id;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.fn_atribuir_conversa_ao_pedido(UUID, TEXT) IS
  'E5: Associa o pedido criado no checkout à conversa de WhatsApp de onde o cliente veio via link ?wa=...';

GRANT EXECUTE ON FUNCTION public.fn_atribuir_conversa_ao_pedido(UUID, TEXT) TO anon, authenticated, service_role;
