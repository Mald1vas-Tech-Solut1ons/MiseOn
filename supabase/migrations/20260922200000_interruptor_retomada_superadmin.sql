-- O interruptor da retomada por e-mail fica na mão do dono, na tela do funil.
-- Nasce desligado (20260922180000); ligar é decisão dele depois de ver a prévia.

create or replace function public.fn_superadmin_flag(p_chave text)
 returns boolean
 language plpgsql stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  return coalesce((select ligado from plataforma_flags where chave = p_chave), false);
end; $function$;

create or replace function public.fn_superadmin_definir_flag(p_chave text, p_ligado boolean)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not fn_sou_superadmin() then raise exception 'Acesso restrito.'; end if;
  -- Só chaves que já existem: interruptor novo nasce por migração, não por clique.
  update plataforma_flags set ligado = p_ligado, atualizado_em = now() where chave = p_chave;
  if not found then raise exception 'Interruptor desconhecido: %', p_chave; end if;
  return p_ligado;
end; $function$;

revoke all on function public.fn_superadmin_flag(text) from public, anon, authenticated;
revoke all on function public.fn_superadmin_definir_flag(text, boolean) from public, anon, authenticated;
grant execute on function public.fn_superadmin_flag(text) to authenticated;
grant execute on function public.fn_superadmin_definir_flag(text, boolean) to authenticated;
