-- ═══════════════════════════════════════════════════════════════════════════
-- Sobras de `USING (true)` da migration 20260714205600_add_logistics.sql, cujo
-- próprio comentário dizia "simplificar para 'true' enquanto ajustamos RLS".
-- Nunca foram ajustadas. O que estava aberto:
--
--   localizacao_entregador  SELECT true                      -> GPS AO VIVO de
--     qualquer entregador da plataforma, legível sem login. Confirmado por
--     requisição anônima real: lat/lng + timestamp devolvidos.
--   localizacao_entregador  ALL auth.role()='authenticated'  -> QUALQUER
--     usuário logado apagava ou falsificava a posição de qualquer entregador.
--   entregas                SELECT true                      -> entregas de
--     todas as lojas (a tabela guarda lat/lng também).
--   mensagens_pedido        SELECT true / INSERT true        -> ler o chat de
--     qualquer pedido e escrever nele se passando pela loja.
--
-- Rastrear a moto de um entregador em tempo real não é só LGPD: é segurança
-- física de uma pessoa.
--
-- Quem precisa de verdade (levantado do código, não suposto):
--   · staff da loja  — admin/Entregas.tsx (mapa, chat, encerrar rota)
--   · entregador     — entregador/Rota.tsx (envia GPS, chat)
--   · cliente dono   — Pedido.tsx (mapa de acompanhamento)
--
-- Efeito colateral aceito: quem abrir o link de acompanhamento SEM estar
-- logado continua vendo status e etapas, mas não o mapa ao vivo. Coerente com
-- a regra de que só cliente logado faz pedido.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Quem participa de um pedido ──────────────────────────────────────────
create or replace function fn_participa_do_pedido(p_pedido_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from pedidos p
    where p.id = p_pedido_id
      and (
        p.cliente_user_id = auth.uid()          -- o cliente dono
        or fn_meu_acesso(p.loja_id)             -- staff da loja
        or exists (                             -- o entregador designado
          select 1 from entregadores e
          where e.id = p.entregador_id and e.user_id = auth.uid()
        )
      )
  );
$fn$;

revoke all on function fn_participa_do_pedido(uuid) from public;
grant execute on function fn_participa_do_pedido(uuid) to authenticated, service_role;

-- ── GPS do entregador ────────────────────────────────────────────────────
drop policy if exists ver_localizacao       on localizacao_entregador;
drop policy if exists gerenciar_localizacao on localizacao_entregador;

create policy loc_le_quem_participa on localizacao_entregador
  for select using (fn_participa_do_pedido(pedido_id));

-- Escrever a posição é privilégio de quem está com a moto (ou do staff, que
-- encerra a rota pelo painel). Cliente só lê.
create policy loc_escreve_entregador_ou_staff on localizacao_entregador
  for all
  using (
    exists (select 1 from pedidos p where p.id = localizacao_entregador.pedido_id
             and (fn_meu_acesso(p.loja_id)
                  or exists (select 1 from entregadores e
                              where e.id = p.entregador_id and e.user_id = auth.uid())))
  )
  with check (
    exists (select 1 from pedidos p where p.id = localizacao_entregador.pedido_id
             and (fn_meu_acesso(p.loja_id)
                  or exists (select 1 from entregadores e
                              where e.id = p.entregador_id and e.user_id = auth.uid())))
  );

-- ── Entregas ─────────────────────────────────────────────────────────────
drop policy if exists pub_le_entrega on entregas;

create policy entregas_le_quem_participa on entregas
  for select using (fn_participa_do_pedido(pedido_id));

-- ── Chat do pedido ───────────────────────────────────────────────────────
drop policy if exists "Leitura de mensagens do pedido"  on mensagens_pedido;
drop policy if exists "Inserção de mensagens do pedido" on mensagens_pedido;

create policy msg_le_quem_participa on mensagens_pedido
  for select using (fn_participa_do_pedido(pedido_id));

create policy msg_escreve_quem_participa on mensagens_pedido
  for insert with check (fn_participa_do_pedido(pedido_id));

-- Marcar como lida é o único update que o produto faz.
create policy msg_marca_lida on mensagens_pedido
  for update using (fn_participa_do_pedido(pedido_id))
          with check (fn_participa_do_pedido(pedido_id));
