-- search_path mutável em função SECURITY DEFINER é escalação de privilégio:
-- pg_temp é pesquisado ANTES por padrão, então basta o atacante criar uma
-- tabela/função temporária com o mesmo nome de um objeto usado no corpo para a
-- função executá-la com os privilégios do dono. Fixar o search_path com
-- pg_temp explicitamente no FIM elimina o vetor. Só metadado: corpo intocado.

alter function public.fn_acompanhar_pedido(uuid)                        set search_path = public, pg_temp;
alter function public.fn_chat_handoff()                                 set search_path = public, pg_temp;
alter function public.fn_cliente_confirmar_recebimento(uuid)            set search_path = public, pg_temp;
alter function public.fn_creditar_cashback(uuid)                        set search_path = public, pg_temp;
alter function public.fn_criar_contas_padrao()                          set search_path = public, pg_temp;
alter function public.fn_produtos_com_estoque(uuid)                     set search_path = public, pg_temp;
alter function public.fn_proximo_numero(uuid)                           set search_path = public, pg_temp;
alter function public.fn_quitar_pedido_cashback(uuid)                   set search_path = public, pg_temp;
alter function public.fn_recalcular_pedido(uuid)                        set search_path = public, pg_temp;
alter function public.fn_registrar_etapa_kds(uuid,text)                 set search_path = public, pg_temp;
alter function public.fn_sou_superadmin()                               set search_path = public, pg_temp;
alter function public.fn_trg_upsert_cliente()                           set search_path = public, pg_temp;
alter function public.fn_usar_cashback(uuid,uuid,uuid,numeric)          set search_path = public, pg_temp;
alter function public.fn_valida_estacao_pedido()                        set search_path = public, pg_temp;

alter function public.conversao_valida(text,text,numeric,numeric)       set search_path = public, pg_temp;
alter function public.fatores_conversao_valida()                        set search_path = public, pg_temp;
alter function public.fn_brl(numeric)                                   set search_path = public, pg_temp;
alter function public.fn_email_proxima_janela(timestamp with time zone) set search_path = public, pg_temp;
alter function public.fn_insumos_normaliza_nome()                       set search_path = public, pg_temp;
alter function public.set_faixas_entrega_updated_at()                   set search_path = public, pg_temp;
alter function public.update_timestamp_column()                         set search_path = public, pg_temp;
