-- ============================================================================
-- SPRINT 9: CARTÃO QUE NÃO PODE PROCESSAR NÃO PODE SER OFERECIDO
--
-- Medido em 08/09, com a resposta crua da Efí em mãos:
--
--   host_efi: https://cobrancas.api.efipay.com.br   (produção, correto)
--   usar_split: false                                (sem repasse, correto)
--   valor_centavos: 500                              (R$ 5,00, correto)
--   efi: { code: 4600037, error_description:
--          "O valor da emissão é superior ao limite operacional da conta..." }
--
-- Ou seja: a requisição está certa e a recusa é da CONTA — o produto de
-- Cobranças (cartão) daquela conta Efí tem limite operacional que rejeita
-- qualquer valor. Isso se resolve com a Efí, não com código.
--
-- O que É problema nosso: enquanto a conta não estiver liberada, o checkout
-- continuava oferecendo cartão e o cliente batia na parede no último passo,
-- depois de digitar número, CPF e validade. Carrinho perdido, e o lojista
-- sem saber que perdeu.
--
-- Aqui a loja passa a registrar o bloqueio quando o provedor recusa por
-- motivo de CONTA (não confundir com cartão recusado pelo emissor, que é
-- normal e não bloqueia nada). Com o bloqueio marcado, o checkout deixa de
-- oferecer cartão e o lojista vê o motivo — em vez de descobrir pelo cliente
-- que desistiu.
-- ============================================================================

ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS cartao_online_bloqueado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cartao_online_bloqueio_motivo TEXT;

COMMENT ON COLUMN public.lojas.cartao_online_bloqueado_em IS
  'Quando o provedor recusou por motivo de CONTA (limite operacional, conta '
  'não habilitada). Enquanto preenchido, o checkout não oferece cartão. '
  'Limpar depois de resolver com o provedor.';
COMMENT ON COLUMN public.lojas.cartao_online_bloqueio_motivo IS
  'Texto técnico do provedor que causou o bloqueio — é o que o lojista leva '
  'para o suporte do provedor.';

-- Marca o bloqueio. Chamada pela edge function do cartão (service role) —
-- nunca pelo navegador: bloquear meio de pagamento não é decisão de cliente.
CREATE OR REPLACE FUNCTION public.fn_bloquear_cartao_online(
  p_loja_id UUID,
  p_motivo  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.lojas
     SET cartao_online_bloqueado_em = COALESCE(cartao_online_bloqueado_em, now()),
         cartao_online_bloqueio_motivo = LEFT(COALESCE(p_motivo, ''), 500)
   WHERE id = p_loja_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_bloquear_cartao_online(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- O lojista libera de volta pela tela, depois de resolver com o provedor.
CREATE OR REPLACE FUNCTION public.fn_liberar_cartao_online(p_loja_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.fn_tem_papel(p_loja_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Só um admin da loja pode reativar o cartão online.';
  END IF;

  UPDATE public.lojas
     SET cartao_online_bloqueado_em = NULL,
         cartao_online_bloqueio_motivo = NULL
   WHERE id = p_loja_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_liberar_cartao_online(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_liberar_cartao_online(UUID) TO authenticated;

COMMENT ON FUNCTION public.fn_liberar_cartao_online(UUID) IS
  'Reativa o cartão online depois que o lojista resolveu a pendência com o '
  'provedor. Só admin da loja.';
