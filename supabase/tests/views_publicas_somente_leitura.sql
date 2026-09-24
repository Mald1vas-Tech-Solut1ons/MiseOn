-- Prova: view de `public` é só leitura para anon e authenticated, inclusive
-- view criada depois. Roda em produção sem gravar nada (rollback interno).
do $$
declare
  v_gravaveis int;
  v_bloqueou boolean;
begin
  select count(*) into v_gravaveis
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('v','m')
    and (has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE') or has_table_privilege('authenticated', c.oid, 'INSERT')
      or has_table_privilege('authenticated', c.oid, 'UPDATE') or has_table_privilege('authenticated', c.oid, 'DELETE'));
  if v_gravaveis > 0 then
    raise exception 'FALHOU: % view(s) de public aceitam escrita de anon/authenticated', v_gravaveis;
  end if;

  -- O ataque de 23/09: UPDATE sem efeito como anon. Tem que ser recusado.
  begin
    set local role anon;
    update public.lojas_publicas set nome = nome where slug = 'lanchepaulista';
    v_bloqueou := false;
  exception when insufficient_privilege then
    v_bloqueou := true;
  end;
  reset role;
  if not v_bloqueou then raise exception 'FALHOU: anon ainda altera loja via lojas_publicas'; end if;

  begin
    set local role anon;
    update public.plataforma_pagamento_publico set efi_payee_code = efi_payee_code;
    v_bloqueou := false;
  exception when insufficient_privilege then
    v_bloqueou := true;
  end;
  reset role;
  if not v_bloqueou then raise exception 'FALHOU: anon ainda altera o payee da plataforma'; end if;

  -- View nova nasce só-leitura (gatilho de DDL), desfeita no fim.
  begin
    execute 'create view public._prova_view_nova as select id, nome from public.lojas';
    if has_table_privilege('anon', 'public._prova_view_nova', 'UPDATE')
       or has_table_privilege('authenticated', 'public._prova_view_nova', 'UPDATE') then
      raise exception 'FALHOU: view nova nasceu gravável';
    end if;
    raise exception using errcode = 'ZT001', message = 'reverter';
  exception when sqlstate 'ZT001' then null;
  end;

  raise notice 'PASS: nenhuma view gravável, ataque anon recusado nas duas views, view nova nasce só-leitura';
end $$;
