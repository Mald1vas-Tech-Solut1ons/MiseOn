-- ============================================================================
-- NFS-e da assinatura SaaS (MiseOn cobrando o lojista)
--
-- Duas tabelas novas, distintas do módulo fiscal por loja (configuracoes_fiscais
-- / notas_fiscais, que são NFe/NFC-e de VENDA de cada loja para o cliente final):
--
--   1. configuracoes_fiscais_plataforma — dados da própria MiseOn (emissora),
--      linha única. CNAE fica fixo em 8219-9/99 (apoio administrativo) por
--      decisão do responsável — o item de serviço/LC116 é campo configurável,
--      não presumido.
--   2. faturas_assinatura — cada cobrança da assinatura (inicial ou recorrente)
--      e o status da nota fiscal emitida para aquela cobrança.
-- ============================================================================

-- 1. Dados fiscais da MiseOn (emissora) — linha única
CREATE TABLE IF NOT EXISTS public.configuracoes_fiscais_plataforma (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true), -- garante linha única
  cnpj TEXT NOT NULL DEFAULT '63310253000181',
  razao_social TEXT NOT NULL DEFAULT '63.310.253 RENANN HENRIQUE PAIVA DIAS DA SILVA',
  nome_fantasia TEXT DEFAULT 'MiseOn',
  inscricao_municipal TEXT,
  cnae_principal TEXT NOT NULL DEFAULT '8219999',
  codigo_servico TEXT,       -- código de serviço no município (Focus NFe)
  item_lista_servico TEXT,   -- item da lista de serviços LC 116/2003
  aliquota_iss NUMERIC(5,2),
  regime_tributario TEXT DEFAULT 'MEI',
  logradouro TEXT DEFAULT 'Rua Benjamin Benchimol',
  numero TEXT DEFAULT '360',
  complemento TEXT DEFAULT 'Casa',
  bairro TEXT DEFAULT 'Aleixo',
  cidade TEXT DEFAULT 'Manaus',
  uf VARCHAR(2) DEFAULT 'AM',
  cep TEXT DEFAULT '69083040',
  codigo_ibge TEXT DEFAULT '1302603', -- Manaus/AM
  telefone TEXT,
  email TEXT,
  ambiente TEXT DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  habilita_nfse BOOLEAN DEFAULT false,
  certificado_nome TEXT,
  certificado_validade TIMESTAMPTZ,
  certificado_status TEXT DEFAULT 'pendente' CHECK (certificado_status IN ('pendente', 'valido', 'expirado', 'erro')),
  certificado_encrypted TEXT, -- Base64 do .pfx criptografado em AES-256-GCM
  senha_encrypted TEXT,       -- Senha do .pfx criptografada em AES-256-GCM
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.configuracoes_fiscais_plataforma (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.configuracoes_fiscais_plataforma ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin gerencia config fiscal da plataforma" ON public.configuracoes_fiscais_plataforma;
CREATE POLICY "Superadmin gerencia config fiscal da plataforma"
  ON public.configuracoes_fiscais_plataforma FOR ALL
  USING (public.fn_sou_superadmin())
  WITH CHECK (public.fn_sou_superadmin());

DROP TRIGGER IF EXISTS set_configuracoes_fiscais_plataforma_updated_at ON public.configuracoes_fiscais_plataforma;
CREATE TRIGGER set_configuracoes_fiscais_plataforma_updated_at
  BEFORE UPDATE ON public.configuracoes_fiscais_plataforma
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp_column();

-- 2. Cobranças da assinatura + status da nota fiscal emitida
CREATE TABLE IF NOT EXISTS public.faturas_assinatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  ciclo TEXT CHECK (ciclo IN ('mensal', 'anual')),
  parcelas INTEGER DEFAULT 1,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('cartao', 'pix')),
  valor_cobrado NUMERIC(10,2) NOT NULL, -- sempre o valor real aprovado pela Efí
  efi_subscription_id TEXT,
  efi_charge_id TEXT UNIQUE, -- idempotência: webhook repetido não duplica fatura
  status_cobranca TEXT DEFAULT 'pendente' CHECK (status_cobranca IN ('pendente', 'pago', 'recusado')),
  data_pagamento TIMESTAMPTZ,

  -- Snapshot do tomador no momento da cobrança (histórico não muda se o
  -- cadastro for atualizado depois)
  tomador_cpf_cnpj TEXT,
  tomador_razao_social TEXT,
  tomador_logradouro TEXT,
  tomador_numero TEXT,
  tomador_complemento TEXT,
  tomador_bairro TEXT,
  tomador_cidade TEXT,
  tomador_uf VARCHAR(2),
  tomador_cep TEXT,
  tomador_email TEXT,

  -- Status da NFS-e
  nfse_status TEXT DEFAULT 'pendente_configuracao' CHECK (nfse_status IN (
    'pendente_configuracao', 'processando', 'emitida', 'erro', 'cancelada'
  )),
  nfse_numero TEXT,
  nfse_codigo_verificacao TEXT,
  nfse_pdf_url TEXT,
  nfse_xml_url TEXT,
  nfse_erro TEXT,
  nfse_emitida_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faturas_assinatura_loja_created
  ON public.faturas_assinatura (loja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faturas_assinatura_nfse_status
  ON public.faturas_assinatura (nfse_status);

ALTER TABLE public.faturas_assinatura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin da loja ve suas faturas de assinatura" ON public.faturas_assinatura;
CREATE POLICY "Admin da loja ve suas faturas de assinatura"
  ON public.faturas_assinatura FOR SELECT
  USING (public.fn_sou_admin(loja_id));

DROP POLICY IF EXISTS "Superadmin gerencia todas as faturas de assinatura" ON public.faturas_assinatura;
CREATE POLICY "Superadmin gerencia todas as faturas de assinatura"
  ON public.faturas_assinatura FOR ALL
  USING (public.fn_sou_superadmin())
  WITH CHECK (public.fn_sou_superadmin());

DROP TRIGGER IF EXISTS set_faturas_assinatura_updated_at ON public.faturas_assinatura;
CREATE TRIGGER set_faturas_assinatura_updated_at
  BEFORE UPDATE ON public.faturas_assinatura
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp_column();
