-- ============================================================================
-- Emissora da NFS-e da assinatura passa a ser o CNPJ próprio
--
-- Até 02/09/2026 a plataforma emitia (ou emitiria) sob o MEI 63.310.253/0001-81,
-- de terceiro, com CNAE 8219-9/99 (apoio administrativo) e sede em Manaus/AM.
-- Desde 02/09/2026 a operadora do MiseOn é pessoa jurídica própria:
--
--   RAFAEL PAIVA DIAS DA SILVA CONSULTORIA EM TECNOLOGIA DA INFORMACAO LTDA
--   nome fantasia MALDIVAS TECH · CNPJ 68.923.239/0001-77
--   Sociedade Empresária Limitada · porte ME · Simples Nacional
--   CNAE principal 62.01-5-01 (desenvolvimento de programas sob encomenda)
--   R. Pais Leme, 215, cj. 1713 — Pinheiros, São Paulo/SP, CEP 05424-150
--
-- Esta migration altera os DEFAULTs da linha única de configuração fiscal da
-- plataforma e reescreve a linha existente, se houver. Inscrição municipal (CCM
-- de São Paulo) e certificado digital A1 ficam NULL de propósito: entram por
-- UPDATE quando forem emitidos, e habilita_nfse só vai a true depois disso.
-- ============================================================================

ALTER TABLE public.configuracoes_fiscais_plataforma
  ALTER COLUMN cnpj              SET DEFAULT '68923239000177',
  ALTER COLUMN razao_social      SET DEFAULT 'RAFAEL PAIVA DIAS DA SILVA CONSULTORIA EM TECNOLOGIA DA INFORMACAO LTDA',
  ALTER COLUMN nome_fantasia     SET DEFAULT 'Maldivas Tech',
  ALTER COLUMN cnae_principal    SET DEFAULT '6201501',
  ALTER COLUMN regime_tributario SET DEFAULT 'Simples Nacional',
  ALTER COLUMN logradouro        SET DEFAULT 'Rua Pais Leme',
  ALTER COLUMN numero            SET DEFAULT '215',
  ALTER COLUMN complemento       SET DEFAULT 'Conj 1713',
  ALTER COLUMN bairro            SET DEFAULT 'Pinheiros',
  ALTER COLUMN cidade            SET DEFAULT 'São Paulo',
  ALTER COLUMN uf                SET DEFAULT 'SP',
  ALTER COLUMN cep               SET DEFAULT '05424150',
  ALTER COLUMN codigo_ibge       SET DEFAULT '3550308';

UPDATE public.configuracoes_fiscais_plataforma
   SET cnpj                 = '68923239000177',
       razao_social         = 'RAFAEL PAIVA DIAS DA SILVA CONSULTORIA EM TECNOLOGIA DA INFORMACAO LTDA',
       nome_fantasia        = 'Maldivas Tech',
       cnae_principal       = '6201501',
       regime_tributario    = 'Simples Nacional',
       inscricao_municipal  = NULL,
       logradouro           = 'Rua Pais Leme',
       numero               = '215',
       complemento          = 'Conj 1713',
       bairro               = 'Pinheiros',
       cidade               = 'São Paulo',
       uf                   = 'SP',
       cep                  = '05424150',
       codigo_ibge          = '3550308',
       habilita_nfse        = false,
       ambiente             = 'homologacao'
 WHERE id = true;
