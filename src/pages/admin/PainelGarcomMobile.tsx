import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Smartphone, CheckCircle, Volume2, Divide, ChevronRight, Zap } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useGarcomPush } from '../../hooks/useGarcomPush';
import type { CtxLoja } from './AdminLayout';
import type { Mesa, Produto } from '../../types';
import { ModalDivisaoItemGarcom } from '../../components/mesas/ModalDivisaoItemGarcom';

import { useI18n } from '../../contexts/I18nContext';
export function PainelGarcomMobile() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const {
    chamadosPendentes,
    pushHabilitado,
    solicitarPermissaoPush,
    atenderChamado,
    concluirChamado,
  } = useGarcomPush(lojaId);

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  const [produtoParaFracionar, setProdutoParaFracionar] = useState<Produto | null>(null);

  const carregarMesasEProdutos = useCallback(async () => {
    if (!lojaId) return;
    const [{ data: ms }, { data: ps }] = await Promise.all([
      supabase.from('mesas').select('*').eq('loja_id', lojaId).eq('ativo', true).order('numero'),
      supabase.from('produtos').select('*').eq('loja_id', lojaId).eq('disponivel', true),
    ]);

    setMesas((ms as Mesa[]) || []);
    setProdutos((ps as Produto[]) || []);
  }, [lojaId]);

  useEffect(() => {
    carregarMesasEProdutos();
  }, [carregarMesasEProdutos]);

  const lancarItemFracionado = async (produto: Produto, assentos: number[]) => {
    if (!mesaSelecionada || !lojaId) return;

    try {
      // Buscar ou criar comanda aberta da mesa
      let { data: comanda } = await supabase
        .from('comandas')
        .select('*')
        .eq('loja_id', lojaId)
        .eq('mesa_id', mesaSelecionada.id)
        .eq('status', 'ABERTA')
        .maybeSingle();

      if (!comanda) {
        const { data: novaCom, error: errCom } = await supabase
          .from('comandas')
          .insert({
            loja_id: lojaId,
            mesa_id: mesaSelecionada.id,
            status: 'ABERTA',
            taxa_servico_pct: 10,
            valor_servico: 0,
          })
          .select()
          .single();

        if (errCom) throw errCom;
        comanda = novaCom;
      }

      // Buscar ou criar pedido vinculado
      let { data: pedido } = await supabase
        .from('pedidos')
        .select('*')
        .eq('comanda_id', comanda.id)
        .neq('status', 'CANCELADO')
        .maybeSingle();

      if (!pedido) {
        const { data: novoPed, error: errPed } = await supabase
          .from('pedidos')
          .insert({
            loja_id: lojaId,
            comanda_id: comanda.id,
            mesa_numero: mesaSelecionada.numero,
            tipo_pedido: 'SALAO',
            status: 'ACEITO',
            identificador_cliente: `Mesa #${mesaSelecionada.numero}`,
            subtotal: 0,
            taxa_entrega: 0,
            desconto: 0,
            valor_total: 0,
            origem: 'garcom_mobile',
          })
          .select()
          .single();

        if (errPed) throw errPed;
        pedido = novoPed;
      }

      // Fracionar e inserir 1 registro para cada assento selecionado
      const fracao = 1 / assentos.length;
      const precoFracionado = Number((produto.preco * fracao).toFixed(2));

      const inserts = assentos.map((assentoNum) => ({
        pedido_id: pedido.id,
        produto_id: produto.id,
        nome_produto: `${produto.nome} (1/${assentos.length})`,
        preco_unitario: precoFracionado,
        quantidade: 1,
        fracionado: true,
        participantes_assentos: assentos,
        assento_numero: assentoNum,
      }));

      const { error: errItens } = await supabase.from('itens_pedido').insert(inserts);
      if (errItens) throw errItens;

      // Recalcular total do pedido
      const { data: todosItens } = await supabase
        .from('itens_pedido')
        .select('preco_unitario, quantidade')
        .eq('pedido_id', pedido.id);

      const novoSubtotal = (todosItens || []).reduce(
        (acc, item) => acc + Number(item.preco_unitario) * Number(item.quantidade),
        0
      );

      await supabase
        .from('pedidos')
        .update({ subtotal: novoSubtotal, valor_total: novoSubtotal })
        .eq('id', pedido.id);

      setProdutoParaFracionar(null);
      alert(`✅ ${produto.nome} fracionado com sucesso entre os assentos [${assentos.join(', ')}]!`);
    } catch (err: any) {
      console.error('Erro ao fracionar item no lançamento:', err);
      alert('Falha ao lançar item fracionado.');
    }
  };

  return (
    <div className="mx-auto max-w-md p-4 space-y-6 pb-24">
      {/* Header Garçom Mobile */}
      <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-slate-950 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Smartphone size={22} />
            <span>{tDynamic('Garçom Mobile PWA')}</span>
          </div>
          <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-xs font-bold">
            Ao Vivo
          </span>
        </div>

        <p className="text-xs font-medium text-slate-900 opacity-90">
          {tDynamic('Receba chamados com vibração e lance pedidos com fracionamento automático na mesa.')}
        </p>

        {!pushHabilitado && (
          <button
            onClick={solicitarPermissaoPush}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-2.5 text-xs font-bold text-orange-400 shadow-md hover:bg-slate-900 transition"
          >
            <Volume2 size={16} /> {tDynamic('Ativar Vibração & Notificações Push')}
          </button>
        )}
      </div>

      {/* Seção de Chamados com Alerta Hálptico */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Bell size={14} className="text-orange-400" />
          Chamados Pendentes no Salão ({chamadosPendentes.length})
        </h2>

        {chamadosPendentes.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center text-xs text-slate-400 space-y-1">
            <CheckCircle size={28} className="mx-auto text-emerald-500/60 mb-2" />
            <div className="font-semibold text-slate-300">{tDynamic('Nenhum chamado no momento')}</div>
            <div>{tDynamic('O dispositivo vibrará quando um cliente solicitar atendimento.')}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {chamadosPendentes.map((chamado) => (
              <div
                key={chamado.id}
                className={`rounded-2xl p-4 border shadow-lg space-y-3 animate-pulse ${
                  chamado.tipo === 'FECHAMENTO'
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                    : 'bg-orange-500/10 border-orange-500/40 text-orange-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-base flex items-center gap-1.5">
                    <Zap size={16} className="text-amber-400" />
                    Mesa #{chamado.mesa_numero || 'Geral'}
                  </span>
                  <span className="text-xs font-mono font-semibold rounded-full bg-slate-950/60 px-2.5 py-0.5 border border-slate-800">
                    {chamado.tipo}
                  </span>
                </div>

                <p className="text-xs opacity-90">
                  {chamado.tipo === 'FECHAMENTO'
                    ? 'Cliente solicitou o fechamento da conta!'
                    : 'Cliente solicita garçom para atendimento.'}
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => atenderChamado(chamado.id)}
                    className="flex-1 rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-orange-400 transition"
                  >
                    Atender Agora
                  </button>
                  <button
                    onClick={() => concluirChamado(chamado.id)}
                    className="rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção de Lançamento de Itens por Mesa com Fracionamento */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Divide size={14} className="text-amber-400" />
          {tDynamic('Lançar Pedido / Método 1 (Fracionado)')}
        </h2>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Selecione a Mesa
            </label>
            <select
              value={mesaSelecionada?.id || ''}
              onChange={(e) => {
                const m = mesas.find((x) => x.id === e.target.value) || null;
                setMesaSelecionada(m);
              }}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="">Selecione a mesa...</option>
              {mesas.map((m) => (
                <option key={m.id} value={m.id}>
                  Mesa #{m.numero} {m.nome ? `(${m.nome})` : ''}
                </option>
              ))}
            </select>
          </div>

          {mesaSelecionada && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">
                Toque no produto para fracionar entre os assentos da Mesa #{mesaSelecionada.numero}:
              </label>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {produtos.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => setProdutoParaFracionar(prod)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-orange-500/50 text-left transition"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 text-xs">{prod.nome}</div>
                      <div className="text-xs opacity-95 text-slate-400 font-mono">
                        R$ {Number(prod.preco).toFixed(2)}
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-bold text-orange-400">
                      Rachar <ChevronRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Método 1: Garçom Fraciona no Lançamento */}
      {produtoParaFracionar && mesaSelecionada && (
        <ModalDivisaoItemGarcom
          produto={produtoParaFracionar}
          capacidadeMesa={mesaSelecionada.capacidade || 6}
          onCancelar={() => setProdutoParaFracionar(null)}
          onConfirmar={(assentos) => lancarItemFracionado(produtoParaFracionar, assentos)}
        />
      )}
    </div>
  );
}
