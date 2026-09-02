-- Salvar CPF/CNPJ + conta Efí em `lojas` é escrita no Postgres: dá certo com
-- dado certo e com dado errado igualmente. Até aqui a tela dizia "salvo com
-- sucesso" nos dois casos e o lojista só descobria o erro quando o dinheiro de
-- uma venda real não chegava. Estas colunas guardam o veredito de quem tem
-- autoridade sobre isso — o próprio Efí — em vez do otimismo da aplicação.

ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS efi_repasse_status TEXT,
  ADD COLUMN IF NOT EXISTS efi_repasse_detalhe TEXT,
  ADD COLUMN IF NOT EXISTS efi_repasse_verificado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.lojas.efi_repasse_status IS
  'Veredito do Efi sobre os dados de repasse: aceito | recusado | nao_configurado | indisponivel. Escrito pela function efi-validar-repasse. "aceito" significa que o Efi aceitou o favorecido, nao que a conta foi comprovada — a verdade final e o split_status de uma cobranca real.';

-- Verdade final: o que aconteceu com o repasse numa cobranca de verdade.
-- A pix-criar-cobranca ja calcula esse status (vinculado | vinculo_falhou |
-- sem_dados_repasse | config_sem_id | erro_split) e hoje o descarta.
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS split_status TEXT;

COMMENT ON COLUMN public.pagamentos.split_status IS
  'Resultado do split Pix nesta cobranca. vinculado = repasse configurado; qualquer outro valor significa que o dinheiro fica na conta da plataforma e precisa de repasse manual.';
