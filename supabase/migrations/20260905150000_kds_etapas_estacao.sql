-- ============================================================================
-- KDS — NÍVEL 1 DE WORKFLOW POR ESTAÇÃO: ETAPA COM ESTAÇÃO OPCIONAL
--
-- lojas.kds_etapas é jsonb: cada etapa é {id, nome, cor, ordem}. Este sprint
-- (nível 1) estende o CONTRATO do objeto com um campo opcional:
--
--     estacao: null | 'COZINHA' | 'BAR'
--
--   • null (ou ausente) = etapa GLOBAL: aparece em toda visão do KDS
--     (TODAS, COZINHA e BAR). É o comportamento legado — toda loja
--     existente tem só etapas globais e NÃO MUDA NADA.
--   • 'COZINHA' = etapa exclusiva da visão Cozinha.
--   • 'BAR'     = etapa exclusiva da visão Bar.
--
-- Sem DDL: jsonb aceita o campo novo sem alteração de schema, e nenhum dado
-- existente é transformado — a migration só documenta o contrato na coluna
-- (rollback conceitual: o comentário anterior; os dados ficam intocados).
--
-- Por que não há CHECK no jsonb: o PostgreSQL não aceita subquery em
-- restrição CHECK, e uma validação elemento-a-elemento de array jsonb não é
-- expressável sem subquery (jsonb_array_elements). A validação do campo fica
-- na borda de escrita (src/lib/kdsEtapas.ts + KDS.tsx só oferecem
-- Global/Cozinha/Bar no seletor) — o único editor de kds_etapas do produto.
--
-- O PIPELINE CONTINUA ÚNICO: pedidos.etapa_kds_atual referencia a etapa no
-- array COMPLETO da loja, independente da estação. O filtro de estação do
-- KDS apenas decide quais COLUNAS cada visão mostra (global + da estação);
-- as regras de status (primeira coluna = fila, última etapa do array
-- completo = PRONTO) e o bastão BALCAO↔COZINHA não mudam. Nível 2
-- (pedido multiestação, estações arbitrárias) fica para outro sprint.
-- ============================================================================

comment on column lojas.kds_etapas is
  'Configuração das etapas do pipeline KDS Kanban. Cada etapa: '
  '{id, nome, cor, ordem, estacao?} — estacao opcional: '
  'null/ausente = GLOBAL (toda visão), ''COZINHA'' ou ''BAR'' = '
  'coluna exclusiva dessa visão. O pipeline do pedido é único '
  '(pedidos.etapa_kds_atual referencia o array completo); a estação '
  'só filtra quais colunas cada visão do KDS mostra.';