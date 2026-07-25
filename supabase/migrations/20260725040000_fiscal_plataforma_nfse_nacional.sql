-- Manaus tornou obrigatória a NFS-e Padrão Nacional a partir de 01/01/2026
-- (LC 214/2025, art. 62) — inclusive para MEI. A Focus NFe atende isso pelo
-- endpoint /v2/nfsen (DPS Nacional), que usa "código de tributação nacional"
-- em vez do item da lista LC116 direto. Pesquisado e confirmado:
--   - Código de tributação nacional 170202 = "Expediente, secretaria em
--     geral, apoio e infra-estrutura administrativa e congêneres" — bate com
--     o CNAE 8219-9/99 (equivalente ao antigo item LC116 17.02).
--   - Alíquota ISS Manaus para este item: 5%.
--   - codigo_opcao_simples_nacional: 2 = MEI (padrão nacional NFS-e).
ALTER TABLE public.configuracoes_fiscais_plataforma
  ADD COLUMN IF NOT EXISTS codigo_tributacao_nacional TEXT DEFAULT '170202',
  ADD COLUMN IF NOT EXISTS codigo_opcao_simples_nacional INTEGER DEFAULT 2;

UPDATE public.configuracoes_fiscais_plataforma
SET
  item_lista_servico = COALESCE(item_lista_servico, '17.02'),
  codigo_tributacao_nacional = COALESCE(codigo_tributacao_nacional, '170202'),
  aliquota_iss = COALESCE(aliquota_iss, 5.00),
  codigo_opcao_simples_nacional = COALESCE(codigo_opcao_simples_nacional, 2)
WHERE id = true;
