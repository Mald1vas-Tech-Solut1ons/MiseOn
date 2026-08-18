-- Corrige políticas RLS de logística
-- Substitui a verificação incorreta (auth.uid() = loja_id) por fn_meu_acesso(loja_id)

-- 1. Políticas de Entregadores
DROP POLICY IF EXISTS "Lojas gerenciam seus entregadores" ON public.entregadores;
CREATE POLICY "Lojas gerenciam seus entregadores"
    ON public.entregadores FOR ALL
    USING (public.fn_meu_acesso(loja_id));

-- 2. Políticas de Rotas de Entrega
DROP POLICY IF EXISTS "Lojas gerenciam rotas" ON public.rotas_entrega;
CREATE POLICY "Lojas gerenciam rotas"
    ON public.rotas_entrega FOR ALL
    USING (public.fn_meu_acesso(loja_id));

-- Permite que entregadores autenticados vejam todas as rotas da loja onde trabalham (necessário para o pool de pedidos)
DROP POLICY IF EXISTS "Entregadores veem suas rotas" ON public.rotas_entrega;
CREATE POLICY "Entregadores veem suas rotas"
    ON public.rotas_entrega FOR SELECT
    USING (
        auth.uid() IN (SELECT user_id FROM public.entregadores WHERE id = entregador_id) OR
        loja_id IN (SELECT loja_id FROM public.entregadores WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Entregadores atualizam suas rotas" ON public.rotas_entrega;
CREATE POLICY "Entregadores atualizam suas rotas"
    ON public.rotas_entrega FOR UPDATE
    USING (auth.uid() IN (SELECT user_id FROM public.entregadores WHERE id = entregador_id));

-- 3. Adiciona permissão para clientes verem seus próprios pedidos (Live Tracking)
-- Garante que a coluna cliente_user_id exista antes de usá-la na policy
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cliente_user_id uuid;

-- O cliente_user_id precisa ser capaz de ler a rota_id
DROP POLICY IF EXISTS "Clientes leem rotas de seus pedidos" ON public.rotas_entrega;
CREATE POLICY "Clientes leem rotas de seus pedidos"
    ON public.rotas_entrega FOR SELECT
    USING (
        id IN (SELECT rota_id FROM public.pedidos WHERE cliente_user_id = auth.uid())
    );
