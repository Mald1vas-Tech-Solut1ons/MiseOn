-- Embedded Signup: guardar o nome verificado do número e o PIN de registro
-- (o Cloud API exige registrar o número com um PIN de 6 dígitos antes de enviar).
alter table public.whatsapp_conexoes
  add column if not exists verified_name text,
  add column if not exists pin_registro text;

comment on column public.whatsapp_conexoes.verified_name is 'Nome verificado do número na Meta (display name aprovado).';
comment on column public.whatsapp_conexoes.pin_registro is 'PIN de 6 dígitos usado no POST /{phone_number_id}/register (two-step verification do Cloud API).';
