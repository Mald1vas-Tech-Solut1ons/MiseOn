-- O onboarding self-service ("Torne-se um lojista") não coleta WhatsApp no
-- primeiro passo — ele já é opcional em outras entradas de contato (telefone,
-- chat IA) e resolverContato() no worker de e-mail já trata ausência dele.
ALTER TABLE public.lojas ALTER COLUMN whatsapp DROP NOT NULL;
