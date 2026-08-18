-- Conexão do WhatsApp à prova do navegador.
--
-- Problema: o Embedded Signup só virava conexão se o callback do popup da Meta
-- voltasse ao painel. Se o popup fechasse, a aba navegasse ou o `code` expirasse,
-- a Meta ficava com a conta compartilhada e o MiseOn com NADA — a tela seguia
-- "DESCONECTADO" e não havia como concluir depois.
--
-- Solução: registrar a intenção do lojista ANTES de abrir o popup. Quando a Meta
-- avisa por webhook (account_update/PARTNER_ADDED) que a conta foi compartilhada,
-- o servidor casa o evento com essa intenção e conclui a conexão sozinho.

create table if not exists whatsapp_conexoes_pendentes (
  loja_id    uuid primary key references lojas(id) on delete cascade,
  user_id    uuid,
  criado_em  timestamptz not null default now()
);

comment on table whatsapp_conexoes_pendentes is
  'Intenção de conectar o WhatsApp: gravada no clique, consumida pelo webhook account_update.';

-- Só o service role (edge functions) toca nestas tabelas.
alter table whatsapp_conexoes_pendentes enable row level security;

-- Rastreia o que o webhook fez com cada evento de conta recebido da Meta.
alter table whatsapp_eventos_meta
  add column if not exists processado_em timestamptz,
  add column if not exists resultado     text;

create index if not exists idx_whatsapp_eventos_meta_waba
  on whatsapp_eventos_meta (waba_id, criado_em desc);
