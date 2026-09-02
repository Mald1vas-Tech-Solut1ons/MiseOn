-- Espelho das migrations aplicadas em producao em 02/09/2026.
-- O identificador da conta que PROCESSA o cartao vivia so em
-- VITE_MISEON_EFI_PAYEE_CODE, variavel de BUILD da Vercel: trocar de conta Efi
-- exigia redeploy, mexer no secret do Supabase nao surtia efeito, e sem a
-- variavel setada o checkout de cartao simplesmente dizia "indisponivel".
-- Agora mora no banco e o front le em tempo de execucao.

ALTER TABLE public.configuracoes_fiscais_plataforma
  ADD COLUMN IF NOT EXISTS efi_payee_code TEXT,
  ADD COLUMN IF NOT EXISTS efi_payee_code_antecipado TEXT,
  ADD COLUMN IF NOT EXISTS efi_sandbox BOOLEAN NOT NULL DEFAULT false;

-- Antecipacao falhava calada: a loja marcava "antecipado", o cartao rodava
-- como padrao e ninguem registrava a divergencia.
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS modalidade TEXT,
  ADD COLUMN IF NOT EXISTS aviso TEXT,
  ADD COLUMN IF NOT EXISTS split_status TEXT;

-- Veredito do Efi sobre os dados de repasse informados pelo lojista.
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS efi_repasse_status TEXT,
  ADD COLUMN IF NOT EXISTS efi_repasse_detalhe TEXT,
  ADD COLUMN IF NOT EXISTS efi_repasse_verificado_em TIMESTAMPTZ;

-- Projecao publica minima: so o que o navegador ja precisa ver para tokenizar
-- o cartao. Nada de CNPJ, inscricao municipal ou dados de certificado.
DROP VIEW IF EXISTS public.plataforma_pagamento_publico;
CREATE VIEW public.plataforma_pagamento_publico
  WITH (security_invoker = false) AS
SELECT
  efi_payee_code,
  efi_payee_code_antecipado,
  efi_sandbox AS sandbox
FROM public.configuracoes_fiscais_plataforma
WHERE id = true;

GRANT SELECT ON public.plataforma_pagamento_publico TO anon, authenticated;
