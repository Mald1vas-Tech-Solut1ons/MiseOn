-- ============================================================================
-- Dados de cadastro do tenant (fiscal + perfil de negócio)
--
-- Capturados no onboarding self-service ("Torne-se um lojista"), autenticado.
-- Servem dois propósitos: (1) dados fiscais alimentam o tomador da NFS-e da
-- assinatura SaaS; (2) perfil de negócio é só para o Rafael (superadmin) ver
-- e contatar o cliente pessoalmente — sem nenhuma automação a partir disso
-- por enquanto.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assinatura_dados_cadastro (
  loja_id UUID PRIMARY KEY REFERENCES public.lojas(id) ON DELETE CASCADE,

  -- Dados fiscais do tomador (nota da assinatura)
  tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('PF', 'PJ')),
  cpf_cnpj TEXT NOT NULL,
  razao_social_ou_nome TEXT NOT NULL,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf VARCHAR(2),
  cep TEXT,
  email_cobranca TEXT NOT NULL,

  -- Perfil de negócio (só visibilidade/CRM do superadmin por enquanto)
  segmento_negocio TEXT CHECK (segmento_negocio IN (
    'lanchonete', 'restaurante_a_la_carte', 'restaurante_por_kg',
    'pizzaria', 'hamburgueria', 'outro'
  )),
  qtd_funcionarios INTEGER,
  atende_salao_garcom BOOLEAN DEFAULT false,
  faz_entregas BOOLEAN DEFAULT false,
  modelo_entrega TEXT CHECK (modelo_entrega IN ('fixo', 'freelancer')),

  -- Confirmação explícita de que o tenant optou pelo trial de 30 dias sem cartão
  aceite_trial_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assinatura_dados_cadastro_segmento
  ON public.assinatura_dados_cadastro (segmento_negocio);

ALTER TABLE public.assinatura_dados_cadastro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin da loja gerencia seus dados de cadastro" ON public.assinatura_dados_cadastro;
CREATE POLICY "Admin da loja gerencia seus dados de cadastro"
  ON public.assinatura_dados_cadastro FOR ALL
  USING (public.fn_sou_admin(loja_id))
  WITH CHECK (public.fn_sou_admin(loja_id));

DROP POLICY IF EXISTS "Superadmin le todos os dados de cadastro" ON public.assinatura_dados_cadastro;
CREATE POLICY "Superadmin le todos os dados de cadastro"
  ON public.assinatura_dados_cadastro FOR SELECT
  USING (public.fn_sou_superadmin());

DROP TRIGGER IF EXISTS set_assinatura_dados_cadastro_updated_at ON public.assinatura_dados_cadastro;
CREATE TRIGGER set_assinatura_dados_cadastro_updated_at
  BEFORE UPDATE ON public.assinatura_dados_cadastro
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp_column();
