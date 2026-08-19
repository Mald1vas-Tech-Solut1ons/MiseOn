-- O webhook de renovação da Efí adivinha nomes de campo (subscription_id /
-- subscription.id / identifiers.subscription_id) e, quando não reconhece,
-- faz `continue` — a notificação é DESCARTADA sem deixar rastro. O formato
-- nunca foi validado contra uma notificação real; o comentário no topo da
-- função admite isso.
--
-- Consequência real (medida, não suposta): a loja NÃO é bloqueada — o
-- avaliarAssinatura de src/lib/assinatura.ts falha em aberto para status
-- 'ativa'. O que se perde é a linha em `faturas_assinatura` e, com ela, a
-- NFS-e do assinante. Ou seja: o cliente paga o mês 2 e não recebe nota.
--
-- Enquanto não houver um ciclo real no sandbox da Efí para confirmar o
-- formato, esta tabela garante que NENHUMA notificação se perca: o payload
-- cru fica guardado e a fatura pode ser gerada depois, sem depender de a
-- adivinhação de campo ter acertado de primeira.

create table if not exists assinatura_eventos_efi (
  id                uuid primary key default gen_random_uuid(),
  recebido_em       timestamptz not null default now(),
  notification_token text,
  payload_bruto     jsonb not null,
  subscription_id   text,
  charge_id         text,
  status_lido       text,
  -- reconhecido: os campos esperados foram encontrados e a fatura foi criada
  -- nao_reconhecido: chegou, mas não deu para interpretar — exige olhar humano
  -- ignorado: interpretado, mas não é evento de pagamento (status != pago)
  situacao          text not null default 'nao_reconhecido'
                      check (situacao in ('reconhecido','nao_reconhecido','ignorado','duplicado')),
  fatura_id         uuid references faturas_assinatura(id) on delete set null,
  observacao        text
);

create index if not exists idx_assinatura_eventos_situacao
  on assinatura_eventos_efi (situacao, recebido_em desc);

alter table assinatura_eventos_efi enable row level security;

-- Só o superadmin enxerga; a escrita é sempre por service role (o webhook).
create policy superadmin_ve_eventos_assinatura on assinatura_eventos_efi
  for select using (fn_sou_superadmin());

comment on table assinatura_eventos_efi is
  'Registro cru de toda notificação recebida da Efí sobre assinatura. Existe porque o formato da notificação de renovação ainda não foi validado contra tráfego real — nada pode ser descartado em silêncio até lá.';
