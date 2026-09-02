-- Espelho da migration aplicada em producao em 02/09/2026.
--
-- A configuracao fiscal da plataforma ainda carregava a classificacao de
-- servico do MEI do irmao: item LC 116 **17.02** (datilografia, digitacao,
-- expedicao, apoio e infraestrutura administrativa), par do antigo CNAE
-- 8219-9/99. Nao tem relacao com o que a Maldivas Tech vende.
--
-- Para software os itens da LC 116/2003 sao outros:
--   1.01 analise e desenvolvimento de sistemas
--   1.04 elaboracao de programas de computador
--   1.05 licenciamento ou cessao de direito de uso de programas  <- assinatura SaaS
--   1.07 suporte tecnico em informatica
-- A escolha e da contabilidade. O campo fica NULO em vez de trocado por outro
-- palpite: nota emitida com servico errado e problema fiscal, nao detalhe de
-- cadastro. A aliquota de ISS tambem era presumida (5,00 vinha do default do
-- codigo) e fica nula pelo mesmo motivo.
UPDATE public.configuracoes_fiscais_plataforma
   SET item_lista_servico = NULL,
       aliquota_iss = NULL,
       habilita_nfse = false
 WHERE id = true;

-- Trava no banco, independente de qualquer caminho de codigo.
ALTER TABLE public.configuracoes_fiscais_plataforma
  DROP CONSTRAINT IF EXISTS nfse_exige_configuracao_completa;

ALTER TABLE public.configuracoes_fiscais_plataforma
  ADD CONSTRAINT nfse_exige_configuracao_completa CHECK (
    habilita_nfse = false
    OR (
      inscricao_municipal IS NOT NULL
      AND item_lista_servico IS NOT NULL
      AND aliquota_iss IS NOT NULL
    )
  );

-- Inscricao Municipal (CCM) 4823036 — extraida do Certificado de Licenciamento
-- Integrado da Prefeitura de Sao Paulo (protocolo SPP2631312342, emitido em
-- 02/09/2026, valido ate 02/09/2031). Era um dos tres campos que faltavam para
-- poder habilitar NFS-e.
UPDATE public.configuracoes_fiscais_plataforma
   SET inscricao_municipal = '4823036'
 WHERE id = true;
