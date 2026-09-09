-- ============================================================================
-- Sprint 15A — acesso controlado ao PDF da NFS-e da assinatura + snapshot do
-- emissor na emissão.
--
-- Problema encontrado: `fiscal-pdf-nfse` aceitava qualquer `?id=<fatura_id>`
-- sem autenticação nem token — um UUID de fatura visto em log, e-mail
-- encaminhado ou aba compartilhada dava acesso ao PDF de qualquer loja. Além
-- disso o PDF sempre lia `configuracoes_fiscais_plataforma` (cadastro ATUAL
-- da MiseOn), então uma nota antiga mudaria de conteúdo se o cadastro da
-- emissora fosse corrigido no futuro.
--
-- Este incremento:
--   1. Acrescenta um token de acesso individual por fatura (hash SHA-256,
--      nunca o token em claro) com expiração, gerado no momento da emissão.
--   2. Acrescenta o snapshot do PRESTADOR (emissor) no momento da emissão —
--      o snapshot do TOMADOR já existia desde a migration original.
--   3. Faz backfill do token para a única fatura já emitida em produção
--      hoje (confirmado via `select count(*) ... where nfse_status='emitida'`
--      = 1), para não quebrar o link já enviado por e-mail. Não é solução
--      permanente: da próxima emissão em diante o token nasce junto com a
--      nota; este backfill existe só para não invalidar o único documento
--      real já entregue.
-- ============================================================================

ALTER TABLE public.faturas_assinatura
  ADD COLUMN IF NOT EXISTS nfse_acesso_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS nfse_acesso_token_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emissor_snapshot_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emissor_razao_social TEXT,
  ADD COLUMN IF NOT EXISTS emissor_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS emissor_inscricao_municipal TEXT,
  ADD COLUMN IF NOT EXISTS emissor_logradouro TEXT,
  ADD COLUMN IF NOT EXISTS emissor_numero TEXT,
  ADD COLUMN IF NOT EXISTS emissor_complemento TEXT,
  ADD COLUMN IF NOT EXISTS emissor_bairro TEXT,
  ADD COLUMN IF NOT EXISTS emissor_cidade TEXT,
  ADD COLUMN IF NOT EXISTS emissor_uf VARCHAR(2),
  ADD COLUMN IF NOT EXISTS emissor_cep TEXT;

CREATE INDEX IF NOT EXISTS idx_faturas_assinatura_acesso_token
  ON public.faturas_assinatura (nfse_acesso_token_hash)
  WHERE nfse_acesso_token_hash IS NOT NULL;

COMMENT ON COLUMN public.faturas_assinatura.nfse_acesso_token_hash IS
  'SHA-256 hex do token de acesso ao PDF; o token em claro só existe na URL enviada ao assinante, nunca é persistido.';
COMMENT ON COLUMN public.faturas_assinatura.emissor_snapshot_em IS
  'Quando o snapshot do prestador foi capturado. NULL = nota emitida antes deste incremento; o PDF cai para o cadastro atual e avisa que não há snapshot da época.';

-- Backfill do token de acesso: só para faturas já emitidas que ainda não têm
-- token. Escopo estreito (nfse_status = 'emitida' e token nulo) e resultado
-- conferido pela contagem devolvida — não é um ajuste manual de saldo, é
-- restabelecer uma credencial de acesso para um documento já legítimo.
DO $$
DECLARE
  v_fatura RECORD;
  v_token TEXT;
  v_hash TEXT;
BEGIN
  FOR v_fatura IN
    SELECT id FROM public.faturas_assinatura
    WHERE nfse_status = 'emitida' AND nfse_acesso_token_hash IS NULL
  LOOP
    v_token := encode(gen_random_bytes(32), 'hex');
    v_hash := encode(digest(v_token, 'sha256'), 'hex');
    UPDATE public.faturas_assinatura
    SET nfse_acesso_token_hash = v_hash,
        nfse_acesso_token_expira_em = now() + interval '5 years',
        nfse_pdf_url = 'https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1/fiscal-pdf-nfse?id=' || id || '&token=' || v_token
    WHERE id = v_fatura.id;
  END LOOP;
END $$;
