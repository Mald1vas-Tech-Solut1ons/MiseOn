-- Migração para Divisão Inteligente de Contas, Configurações de Balança e PWA Notificações Garçom
-- Arquivo: supabase/migrations/20260726000000_divisao_inteligente_e_balanca.sql

-- 1. Ampliar a tabela de comandas para suporte híbrido (Comanda de Mesa + Comanda Individual de Prato/Quilo)
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS tipo_comanda TEXT DEFAULT 'MESA' CHECK (tipo_comanda IN ('MESA', 'INDIVIDUAL')),
  ADD COLUMN IF NOT EXISTS numero_cartao TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nome_cliente TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comanda_mae_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comandas_comanda_mae ON public.comandas (comanda_mae_id);
CREATE INDEX IF NOT EXISTS idx_comandas_numero_cartao ON public.comandas (loja_id, numero_cartao);

-- 2. Suporte a fracionamento e divisão inteligente em itens_pedido
ALTER TABLE public.itens_pedido
  ADD COLUMN IF NOT EXISTS fracionado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS participantes_assentos INTEGER[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quantidade_original NUMERIC(12,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES public.itens_pedido(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_balanca BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tara_g NUMERIC(8,2) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_itens_pedido_parent ON public.itens_pedido (parent_item_id);

-- 3. Tabela de Configurações da Balança do Buffet por Loja
CREATE TABLE IF NOT EXISTS public.balanca_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE UNIQUE,
  protocolo TEXT NOT NULL DEFAULT 'TOLEDO_PRIX3' CHECK (protocolo IN ('TOLEDO_PRIX3', 'TOLEDO_PRIX4', 'FILIZOLA_CS15', 'URANO', 'CUSTOM_SERIAL', 'NETWORK_TCP', 'EMULADOR')),
  modo_conexao TEXT NOT NULL DEFAULT 'WEB_SERIAL' CHECK (modo_conexao IN ('WEB_SERIAL', 'NETWORK_WEBHOOK', 'EMULADOR')),
  baud_rate INTEGER DEFAULT 9600,
  data_bits INTEGER DEFAULT 8,
  stop_bits INTEGER DEFAULT 1,
  parity TEXT DEFAULT 'none',
  tara_padrao_g NUMERIC(8,2) DEFAULT 200.00,
  produto_buffet_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  ip_dispositivo TEXT DEFAULT NULL,
  porta_dispositivo INTEGER DEFAULT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Chamados do Garçom (Atendimento na Mesa / Fechamento)
CREATE TABLE IF NOT EXISTS public.chamados_garcom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES public.mesas(id) ON DELETE CASCADE,
  comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL,
  assento_numero INTEGER DEFAULT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ATENDIMENTO', 'FECHAMENTO', 'DUVIDA', 'OUTRO')),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO')),
  mensagem TEXT DEFAULT NULL,
  atendido_por UUID DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atendido_em TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_chamados_garcom_loja_status ON public.chamados_garcom (loja_id, status);

-- 5. Tabela de Subscrições Web Push para Garçons (PWA Mobile)
CREATE TABLE IF NOT EXISTS public.garcom_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  user_agent TEXT DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garcom_push_loja_user ON public.garcom_push_subscriptions (loja_id, user_id);

-- RLS (Row Level Security)
ALTER TABLE public.balanca_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_garcom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garcom_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS permissivas para operadores de loja autenticados
CREATE POLICY "Permitir leitura/escrita balanca_configuracoes por loja"
  ON public.balanca_configuracoes FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura/escrita chamados_garcom por loja"
  ON public.chamados_garcom FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura/escrita garcom_push_subscriptions por loja"
  ON public.garcom_push_subscriptions FOR ALL
  USING (true) WITH CHECK (true);

-- Habilitar Realtime para chamados_garcom
ALTER PUBLICATION supabase_realtime ADD TABLE public.chamados_garcom;
