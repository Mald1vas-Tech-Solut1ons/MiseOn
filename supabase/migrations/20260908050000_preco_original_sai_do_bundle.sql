-- ============================================================================
-- SPRINT 6: O "DE: R$ X" VIRA DADO DA LOJA, NÃO LINHA DE CÓDIGO
--
-- `Produto.preco_original` existia no tipo TypeScript e a vitrine inteira já
-- sabia desenhá-lo (preço riscado, "Economia de R$ Y", selo de % OFF) — mas a
-- COLUNA NUNCA EXISTIU no banco. A única origem daquele valor eram duas
-- linhas no src/pages/Cardapio.tsx:
--
--     if (nomeU.includes('COMBO X-BACON'))        preco_original = 54.00;
--     if (nomeU.includes('SMASH FIT DE PATINHO')) preco_original = 39.90;
--
-- Isso é preço de loja compilado no bundle de TODAS as lojas: qualquer cliente
-- que cadastrasse um produto chamado "COMBO X-BACON" herdava, sem pedir, um
-- "De: R$ 54,00" que não é dele. E o lojista dono da promoção real não tinha
-- como editá-la nem removê-la — dependia de deploy.
--
-- Aqui a coluna passa a existir e o backfill reproduz EXATAMENTE o que o
-- bundle fazia (mesmo critério de nome, mesmos valores), para que nenhuma
-- vitrine mude de aparência no deploy. Depois disso o campo é do lojista, na
-- tela do Cardápio.
-- ============================================================================

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS preco_original NUMERIC;

ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS produtos_preco_original_check;

-- Promoção é "de MAIOR por MENOR": valor não positivo é erro de digitação.
-- A comparação com `preco` fica na tela (o lojista pode estar editando os
-- dois campos), mas número negativo nunca é promoção.
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_preco_original_check
  CHECK (preco_original IS NULL OR preco_original > 0);

-- Backfill: mesmo critério do bundle (substring do nome, maiúsculas), e só
-- onde o "de" é de fato maior que o preço atual — que era a condição que a
-- vitrine já exigia para riscar o preço (`preco_original > preco`).
UPDATE public.produtos
   SET preco_original = 54.00
 WHERE preco_original IS NULL
   AND upper(nome) LIKE '%COMBO X-BACON%'
   AND preco < 54.00;

UPDATE public.produtos
   SET preco_original = 39.90
 WHERE preco_original IS NULL
   AND upper(nome) LIKE '%SMASH FIT DE PATINHO%'
   AND preco < 39.90;

COMMENT ON COLUMN public.produtos.preco_original IS
  'Preço "De:" da promoção riscada na vitrine. NULL = sem promoção. Era '
  'hardcoded por nome de produto no bundle do cardápio até 20260908 — o '
  'valor é da loja, e só ela edita.';
