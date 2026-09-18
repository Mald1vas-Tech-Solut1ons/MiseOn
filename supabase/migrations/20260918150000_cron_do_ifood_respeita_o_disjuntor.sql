-- O cron do iFood passa a consultar o disjuntor ANTES de gastar a requisição.
--
-- Medido em 18/09/2026, nas 24h de log: `ifood-polling` foi chamado 1.440
-- vezes — de minuto em minuto, exatamente como o cron manda. Nenhuma podia dar
-- certo: `integracao_ifood_saude` está em SEM_PERMISSAO (HTTP 403, "No
-- permissions granted to client c44831bc…") com 64 falhas seguidas, e a única
-- loja com `ifood_merchant_id` é o `lanchepaulista`, que é o tenant de provas.
--
-- O freio de 30 minutos já existia — só que DENTRO da edge function
-- (`supabase/functions/ifood-polling/index.ts`). Ou seja: o cron pagava a
-- requisição para a função responder "estou em espera". A regra não muda e a
-- autoridade sobre o ESTADO continua sendo a função; o que muda é o cron
-- perguntar antes de gastar.
--
-- Isso importa porque a cota de egress do plano free estourou em 16/09 e
-- derrubou a produção inteira: 1.440 chamadas/dia para uma integração que só
-- volta por ação humana no portal do iFood é consumo que não compra nada.
--
-- Efeito esperado enquanto o estado for de configuração: ~48 chamadas/dia em
-- vez de 1.440. Quando o lojista liberar o app no portal, a função responde
-- OK, o estado zera e a cadência volta sozinha para 1 minuto.

-- A função precisa registrar a própria tentativa: quando o gateway está fora
-- (402, como agora), a edge function nunca responde e portanto nunca atualiza
-- `proxima_tentativa_em`. Sem uma marca escrita aqui, o freio ficaria preso no
-- passado e o cron voltaria a martelar de minuto em minuto.
ALTER TABLE public.integracao_ifood_saude
  ADD COLUMN IF NOT EXISTS ultima_tentativa_em TIMESTAMPTZ;

COMMENT ON COLUMN public.integracao_ifood_saude.ultima_tentativa_em IS
  'Quando o cron despachou a última chamada ao ifood-polling. Escrito pelo cron, não pela função: serve de freio mesmo quando a função não responde.';

CREATE OR REPLACE FUNCTION public.fn_ifood_coletar_eventos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- Mesmo search_path da versão em produção (conferido em pg_proc.proconfig):
-- mexer nisto é mudar o que a função enxerga, e não é o assunto desta migration.
SET search_path = public, extensions, vault
AS $$
-- Variáveis escalares de propósito: `record := NULL` deixa a variável não
-- atribuída e a leitura seguinte levanta "record is not assigned yet".
DECLARE
  v_token    TEXT;
  v_estado   TEXT;
  v_proxima  TIMESTAMPTZ;
  v_ultima   TIMESTAMPTZ;
  v_espera   INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lojas WHERE ifood_merchant_id IS NOT NULL) THEN
    RETURN;
  END IF;

  SELECT estado, proxima_tentativa_em, ultima_tentativa_em
    INTO v_estado, v_proxima, v_ultima
    FROM public.integracao_ifood_saude
   WHERE id = true;

  -- Espera declarada pela própria função na última resposta dela.
  IF v_proxima IS NOT NULL AND v_proxima > now() THEN
    RETURN;
  END IF;

  -- Estado de configuração só muda por ação humana no portal do iFood. Os
  -- 30 minutos são a mesma cadência que a edge function já aplica quando
  -- consegue responder — aqui ela vale mesmo quando ela não responde.
  v_espera := CASE
                WHEN COALESCE(v_estado, 'OK') IN ('SEM_PERMISSAO', 'CREDENCIAL') THEN 30
                ELSE 0
              END;

  IF v_espera > 0
     AND v_ultima IS NOT NULL
     AND v_ultima > now() - make_interval(mins => v_espera) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_token
    FROM vault.decrypted_secrets WHERE name = 'ifood_polling_token';

  IF v_token IS NULL THEN
    RAISE WARNING 'ifood_polling_token ausente no Vault - polling do iFood nao executado';
    RETURN;
  END IF;

  -- Marca a tentativa ANTES do disparo: se a chamada morrer no gateway, o
  -- freio já está gravado e o minuto seguinte não repete.
  UPDATE public.integracao_ifood_saude
     SET ultima_tentativa_em = now()
   WHERE id = true;

  PERFORM net.http_post(
    url := 'https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1/ifood-polling',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_token),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000);
END;
$$;
