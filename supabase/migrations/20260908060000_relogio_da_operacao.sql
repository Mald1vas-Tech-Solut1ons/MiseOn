-- ============================================================================
-- SPRINT 6: O RELÓGIO DA OPERAÇÃO, EXPOSTO
--
-- Toda regra de horário do MiseOn (loja aberta, virada da senha, dia de
-- serviço) acontece no fuso da operação — America/Sao_Paulo — e não no fuso
-- de quem está olhando. Já houve bug medido por causa disso: o painel de
-- senhas apagava às 21h de Brasília porque a virada era calculada em UTC.
--
-- Esta função existe para que esse relógio seja OBSERVÁVEL: dá para conferir
-- em produção "que horas o banco acha que são" sem depender do aparelho de
-- ninguém, e é o que permite testar fn_loja_aberta sem cravar um horário fixo
-- no teste (o teste calcula a expectativa a partir daqui; quem responde é a
-- função).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_agora_sao_paulo_hhmm()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
$$;

REVOKE ALL ON FUNCTION public.fn_agora_sao_paulo_hhmm() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_agora_sao_paulo_hhmm() TO anon, authenticated;

COMMENT ON FUNCTION public.fn_agora_sao_paulo_hhmm() IS
  'Hora atual (HH:MI) no fuso da operação. Não é enfeite: é a referência '
  'para conferir regras de horário sem depender do relógio do cliente.';
