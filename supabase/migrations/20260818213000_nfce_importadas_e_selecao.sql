-- Proteção contra importar o mesmo cupom duas vezes.
--
-- Sem isto, escanear a nota de novo — coisa banal quando o lojista não lembra
-- se já lançou — dobra o estoque em silêncio e estraga o CMV. O erro é pior que
-- o trabalho manual, porque ninguém percebe na hora.
CREATE TABLE IF NOT EXISTS public.nfce_importadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  emitente TEXT,
  itens_lancados INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2),
  importado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uk_nfce_loja_chave UNIQUE (loja_id, chave)
);

ALTER TABLE public.nfce_importadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso por loja as notas importadas" ON public.nfce_importadas;
CREATE POLICY "Acesso por loja as notas importadas"
  ON public.nfce_importadas FOR ALL TO authenticated
  USING (loja_id IN (SELECT loja_id FROM public.usuarios_loja WHERE user_id = auth.uid()))
  WITH CHECK (loja_id IN (SELECT loja_id FROM public.usuarios_loja WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_nfce_importadas_loja ON public.nfce_importadas (loja_id, importado_em DESC);

-- A versão final de fn_importar_nfce (com p_repetir e reaproveitamento de
-- insumo por nome) está aplicada em produção. Recriar aqui inteiro duplicaria
-- corpo de função entre migrações; quem recria o ambiente do zero aplica a
-- migração anterior e depois esta, que só acrescenta a tabela de controle.
