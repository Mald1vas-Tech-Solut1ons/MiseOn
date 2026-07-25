-- Migração: Segmentos de Negócio, Módulos Operacionais Híbridos & Reposição de Cubas de Buffet
-- Data: 2026-07-26

-- 1. Colunas de Segmento e Módulos Ativos na tabela lojas
ALTER TABLE public.lojas 
  ADD COLUMN IF NOT EXISTS segmento_negocio text DEFAULT 'GERAL',
  ADD COLUMN IF NOT EXISTS modulos_ativos jsonb DEFAULT '{
    "balanca": true,
    "mesas_3d": true,
    "garcom_pwa": true,
    "pizzas": true,
    "kds": true,
    "entregas": true,
    "ifood": true,
    "fiscal": true
  }'::jsonb;

-- 2. Tabela de Reposições de Cubas de Buffet pela Cozinha
CREATE TABLE IF NOT EXISTS public.reposicoes_buffet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  nome_cuba text NOT NULL,
  peso_reposto_kg numeric(10,3) NOT NULL CHECK (peso_reposto_kg > 0),
  custo_estimado_total numeric(12,2) DEFAULT 0,
  preparado_por uuid DEFAULT NULL,
  observacao text,
  criado_em timestamptz DEFAULT now()
);

-- Habilitar RLS em reposicoes_buffet
ALTER TABLE public.reposicoes_buffet ENABLE ROW LEVEL SECURITY;

-- Políticas RLS permissivas para operadores de loja autenticados
CREATE POLICY "Permitir leitura/escrita reposicoes_buffet por loja"
  ON public.reposicoes_buffet FOR ALL
  USING (true) WITH CHECK (true);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_reposicoes_buffet_loja_criado ON public.reposicoes_buffet(loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_reposicoes_buffet_produto ON public.reposicoes_buffet(produto_id);
