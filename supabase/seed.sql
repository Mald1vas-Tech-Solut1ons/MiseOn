-- ============================================================
-- Seed mínimo do banco local (supabase db reset).
--
-- Uma única loja "miseon-testes" para:
--   · suíte de integração (__tests__/integration) — todos os arquivos
--     exigem "pelo menos uma loja" no beforeAll e abortam sem ela;
--   · desenvolvimento local — não é tenant de demonstração: quem quer
--     dados realistas roda seed_lanchepaulista.sql / seed_completa.sql.
--
-- Idempotente: db reset recria o banco do zero, mas o NOT EXISTS
-- protege contra rodar duas vezes no mesmo banco.
-- ============================================================

INSERT INTO lojas (slug, nome, descricao, whatsapp, telefone, endereco, cnpj, razao_social,
                   pedido_minimo, cor_primaria, cor_secundaria)
SELECT 'miseon-testes', 'Loja de Testes MiseOn',
       'Tenant mínimo para suíte de integração e desenvolvimento local.',
       '5511900000000', '(11) 0000-0000', 'Rua de Testes, 0 - Centro, São Paulo/SP',
       '00.000.000/0001-00', 'Loja de Testes MiseOn Ltda', 0.00, '#1e40af', '#f59e0b'
WHERE NOT EXISTS (SELECT 1 FROM lojas WHERE slug = 'miseon-testes');

INSERT INTO horarios_funcionamento (loja_id, dia_semana, abre, fecha)
SELECT id, d, '08:00', '22:00' FROM lojas, generate_series(0, 6) AS d
WHERE slug = 'miseon-testes'
  AND NOT EXISTS (
    SELECT 1 FROM horarios_funcionamento h
    WHERE h.loja_id = lojas.id AND h.dia_semana = d
  );