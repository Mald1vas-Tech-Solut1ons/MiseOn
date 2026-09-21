-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Salvar insumo dá "permission denied for table insumos" — falta UPDATE     ║
-- ║ por coluna em modo_preparo.                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- SINTOMA (21/09/2026, medido em produção)
--
-- O lojista edita uma ficha de manipulação (Fichas & Manipulações → Editar) e
-- ao salvar recebe: "Não foi possível salvar: permission denied for table
-- insumos".
--
-- CAUSA
--
-- `insumos` NÃO tem grant de UPDATE de tabela para `authenticated` — de
-- propósito. O que existe é UPDATE **por coluna** (attacl), cobrindo o cadastro
-- e deixando `quantidade_atual` de fora, para que saldo só se mova por RPC.
-- Isso está certo e é o desenho documentado no próprio código
-- (src/pages/admin/Estoque.tsx: "quantidade_atual NÃO entra aqui: ... O UPDATE
-- desta coluna é revogado no banco").
--
-- O problema: a coluna `modo_preparo` (roteiro "passo a passo" da ficha,
-- criada depois, em 20260909220000) ficou FORA do grant por coluna. A tela
-- grava essa coluna direto:
--
--   src/pages/admin/EstoquePreparos.tsx  →  payload.modo_preparo = passosValidos
--
-- Prova, rodada no banco de produção como `authenticated`:
--
--   update insumos set ..., modo_preparo = modo_preparo where id = null
--     → ERROR 42501: permission denied for table insumos
--   update insumos set ...  (sem modo_preparo) where id = null
--     → OK
--
-- Ou seja: só a coluna `modo_preparo` derruba o UPDATE inteiro. Editar um
-- insumo comum passa; editar (ou criar) uma ficha que tenha roteiro, não.
--
-- O grupo de colunas hoje sem UPDATE por coluna, e o veredito de cada uma:
--
--   quantidade_atual        — CORRETO bloquear (saldo só por RPC)
--   classificacao_origem    — CORRETO bloquear (escrita por fn_definir_classificacao_insumo)
--   classificacao_confianca — CORRETO bloquear (idem)
--   classificacao_revisada  — CORRETO bloquear (idem)
--   qtd_embalagem_origem    — CORRETO bloquear (escrita por fn_definir_embalagem_insumo)
--   modo_preparo            — ERRADO bloquear: é cadastro, a tela escreve direto
--
-- Por isso o conserto é UMA coluna, não "grant update on insumos": devolver o
-- UPDATE da tabela inteira reabriria a escrita solta de saldo que o revoke
-- original fechou de propósito (a fábrica de divergência entre cadastro e
-- lotes que a Sprint 1 eliminou).

grant update (modo_preparo) on public.insumos to authenticated;

comment on column public.insumos.modo_preparo is
  'Roteiro passo a passo da ficha de manipulação (jsonb, lista de {texto, '
  'minutos, fogo}). Escrito pela tela de Fichas & Manipulações: tem UPDATE por '
  'coluna para authenticated — sem ele, salvar a ficha dava permission denied.';

-- CAUSA-RAIZ ESTRUTURAL
--
-- O grant por coluna foi montado em 20260908080000 lendo a lista de colunas
-- naquele instante. `modo_preparo` nasceu depois, em 20260909220000, e coluna
-- nova em `insumos` não herda UPDATE: o buraco se reabre a cada ALTER TABLE na
-- tabela. Toda coluna de cadastro acrescentada a `insumos` no futuro precisa
-- repetir este grant — por isso a verificação abaixo, e não um patch silencioso.

-- Verificação: aborta se o conserto não pegou.
-- Em produção o grant já tinha sido feito à mão, então isto passa; num ambiente
-- novo, esta migration é a única coisa que abre a porta. Se `modo_preparo`
-- continuar sem UPDATE, falha em voz alta em vez de deixar o lojista descobrir
-- no "permission denied".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.column_privileges
     WHERE table_schema = 'public'
       AND table_name   = 'insumos'
       AND column_name  = 'modo_preparo'
       AND privilege_type = 'UPDATE'
       AND grantee = 'authenticated'
  ) THEN
    RAISE EXCEPTION 'insumos.modo_preparo continua sem UPDATE para authenticated';
  END IF;

  -- Abrir modo_preparo não pode ter reaberto o saldo.
  IF EXISTS (
    SELECT 1 FROM information_schema.column_privileges
     WHERE table_schema = 'public'
       AND table_name   = 'insumos'
       AND column_name  = 'quantidade_atual'
       AND privilege_type = 'UPDATE'
       AND grantee IN ('anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION 'insumos.quantidade_atual voltou a ser escrivel - o grant vazou';
  END IF;
END $$;
