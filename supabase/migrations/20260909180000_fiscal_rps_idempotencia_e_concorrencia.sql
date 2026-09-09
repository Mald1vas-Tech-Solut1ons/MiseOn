-- ============================================================================
-- Idempotência e concorrência na numeração do RPS da NFS-e da assinatura
-- (Sprint 15B → 15C, handoff docs/HANDOFF-SPRINT15B-CONTINUACAO.md item 3.2)
--
-- Falha: supabase/functions/fiscal-emitir-nfse numerava o RPS como
-- count(nfse_status='emitida') + 1, uma leitura sem trava nenhuma. Reproduzido
-- em produção nesta sessão: com o estado atual da tabela (2 faturas
-- 'emitida'), qualquer número de chamadas próximas no tempo calcularia o
-- mesmo numeroRps=3 — não é uma possibilidade teórica, é o comportamento
-- medido agora. Duas invocações para faturas diferentes colidiriam no
-- webservice da Prefeitura (mesma série+número já processado); duas
-- invocações para a MESMA fatura (ex.: webhook duplicado da Efí cruzando
-- com uma retentativa) emitiriam uma SEGUNDA nota fiscal real para a mesma
-- cobrança, porque a função também não verificava nfse_status antes de
-- seguir.
--
-- Correção: contador dedicado com UPDATE...RETURNING atômico por linha
-- (mesmo padrão de public.fn_numero_pedido, já validado em produção neste
-- projeto para numeração de pedido) + o número reservado é persistido na
-- própria fatura e reaproveitado em qualquer retentativa — nunca se queima
-- um número novo em cima de um RPS que não foi de fato aceito pela
-- Prefeitura. A trava de concorrência por fatura (não reprocessar uma
-- fatura já 'emitida' ou em 'processando') fica na Edge Function
-- (fiscal-emitir-nfse/index.ts), via UPDATE condicional atômico.
--
-- Backfill do contador: das duas faturas 'emitida' hoje, uma
-- (12392ae2-5b3a-4973-89be-9b8f4bd762ae) é o registro falso do extinto
-- gateway Focus NFe (nfse_numero='202609001' — já documentado em memória
-- como um falso positivo, não é uma emissão real desta série e não entra
-- nesta contagem). A outra (66a64ef1-a0cb-4ca3-bdbc-2cb24f96b881) é a
-- emissão real confirmada na consulta pública da Prefeitura; no momento em
-- que foi enviada, o código antigo calculou numeroRps = 1 (só o falso
-- 'emitida' existia então) + 1 = 2 — esse "2" é o número de RPS que a
-- Prefeitura de fato recebeu e aceitou para a série "MS". O contador novo
-- nasce em 2 para não colidir com ele; a próxima reserva será 3 (mesmo
-- valor que o código antigo calcularia agora, sem pular nem repetir nada).
-- ============================================================================

ALTER TABLE public.faturas_assinatura
  ADD COLUMN IF NOT EXISTS nfse_numero_rps INTEGER;

UPDATE public.faturas_assinatura
  SET nfse_numero_rps = 2
  WHERE id = '66a64ef1-a0cb-4ca3-bdbc-2cb24f96b881'
    AND nfse_numero_rps IS NULL;

CREATE TABLE IF NOT EXISTS public.fiscal_rps_sequencia (
  serie TEXT PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.fiscal_rps_sequencia (serie, ultimo_numero)
  VALUES ('MS', 2)
  ON CONFLICT (serie) DO NOTHING;

ALTER TABLE public.fiscal_rps_sequencia ENABLE ROW LEVEL SECURITY;
-- Sem policies: só é tocada por fn_fiscal_reservar_numero_rps (SECURITY
-- DEFINER), chamada pela Edge Function com a service role key. Nenhum
-- usuário, nem superadmin, precisa ler ou escrever aqui diretamente.

CREATE OR REPLACE FUNCTION public.fn_fiscal_reservar_numero_rps(
  p_fatura_id UUID,
  p_serie TEXT DEFAULT 'MS'
) RETURNS INTEGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  -- Trava a linha da fatura primeiro: se já existe um número reservado
  -- (inclusive de uma tentativa anterior que falhou no webservice depois de
  -- reservar), reaproveita o mesmo número. Se uma chamada concorrente para
  -- essa MESMA fatura estiver em andamento, esta espera aqui até a primeira
  -- liberar a linha (fim da transação) e então lê o número que ela reservou.
  SELECT nfse_numero_rps INTO v_numero
  FROM public.faturas_assinatura
  WHERE id = p_fatura_id
  FOR UPDATE;

  IF v_numero IS NOT NULL THEN
    RETURN v_numero;
  END IF;

  -- Contador global da série: UPDATE...RETURNING é atômico por linha no
  -- Postgres — duas faturas diferentes reservando ao mesmo tempo nunca
  -- recebem o mesmo número (mesmo padrão de public.fn_numero_pedido).
  UPDATE public.fiscal_rps_sequencia
    SET ultimo_numero = ultimo_numero + 1, updated_at = now()
    WHERE serie = p_serie
    RETURNING ultimo_numero INTO v_numero;

  IF NOT FOUND THEN
    INSERT INTO public.fiscal_rps_sequencia (serie, ultimo_numero)
      VALUES (p_serie, 1)
      RETURNING ultimo_numero INTO v_numero;
  END IF;

  UPDATE public.faturas_assinatura
    SET nfse_numero_rps = v_numero
    WHERE id = p_fatura_id;

  RETURN v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_fiscal_reservar_numero_rps(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fiscal_reservar_numero_rps(UUID, TEXT) TO service_role;
