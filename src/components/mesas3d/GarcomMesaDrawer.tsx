/**
 * GarcomMesaDrawer.tsx — Painel Mobile & App do Garçom para Gestão da Mesa e Assentos.
 */

import { useState, useMemo } from 'react';
import {
  X, Utensils, Calculator, Check, Banknote, QrCode, CreditCard,
  Clock, Plus, ShieldAlert,
} from 'lucide-react';
import type { Mesa3DPosicionada, ModoDivisaoConta } from '../../lib/mesas3d/types';
import type { MetodoPgto, Loja } from '../../types';
import { fmt } from '../../types';
import { imprimir } from '../../lib/print';
import { supabase } from '../../lib/supabase';

import { useI18n } from '../../contexts/I18nContext';
interface Props {
  mesa3d: Mesa3DPosicionada;
  assentoInicial?: number | null;
  loja: Loja | null;
  onClose: () => void;
  onAtualizar: () => void;
  onNovoPedidoAssento?: (mesaNumero: number, assentoNum: number | null) => void;
}

const METODOS: { m: MetodoPgto; label: string; icon: typeof Banknote }[] = [
  { m: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
  { m: 'PIX', label: 'Pix (chave da loja)', icon: QrCode },
  { m: 'CREDITO', label: 'Crédito', icon: CreditCard },
  { m: 'DEBITO', label: 'Débito', icon: CreditCard },
];

export function GarcomMesaDrawer({
  mesa3d,
  assentoInicial,
  loja,
  onClose,
  onAtualizar,
  onNovoPedidoAssento,
}: Props) {
  const { tDynamic } = useI18n();
  const [assentoAtivo, setAssentoAtivo] = useState<number | null>(assentoInicial ?? null);
  const [modoDivisao, setModoDivisao] = useState<ModoDivisaoConta>('POR_ASSENTO');
  const [qtdPessoasDivisao, setQtdPessoasDivisao] = useState<number>(mesa3d.capacidade);
  const [fechandoMetodo, setFechandoMetodo] = useState<MetodoPgto | null>(null);
  const [valorDigitado, setValorDigitado] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  // Taxa de serviço
  const [taxaPct, setTaxaPct] = useState<number>(loja?.taxa_servico_padrao_pct ?? 10);

  // Cálculos financeiros
  const subtotalMesa = mesa3d.totalParcial;
  const valorServico = subtotalMesa * (taxaPct / 100);
  const totalMesa = subtotalMesa + valorServico;
  const saldoDevedorMesa = Math.max(0, totalMesa - mesa3d.totalPago);

  // Itens filtrados pelo assento ativo
  const assentoObj = assentoAtivo ? mesa3d.assentos.find((a) => a.numero === assentoAtivo) : null;
  const subtotalAssento = assentoObj ? assentoObj.valorConsumido : subtotalMesa;
  const valorServicoAssento = subtotalAssento * (taxaPct / 100);
  const totalAssento = subtotalAssento + valorServicoAssento;

  // Valor a cobrar na modalidade escolhida
  const valorACobrar = useMemo(() => {
    if (modoDivisao === 'IGUALITARIA') {
      return saldoDevedorMesa / Math.max(1, qtdPessoasDivisao);
    }
    if (modoDivisao === 'POR_ASSENTO') {
      return totalAssento;
    }
    return Number(valorDigitado.replace(',', '.')) || saldoDevedorMesa;
  }, [modoDivisao, saldoDevedorMesa, qtdPessoasDivisao, totalAssento, valorDigitado]);

  const confirmarPagamento = async (metodo: MetodoPgto) => {
    if (!mesa3d.comanda || mesa3d.pedidos.length === 0) return;
    if (mesa3d.temItemEmPreparo) {
      setErro('Aguarde a cozinha finalizar o preparo antes de fechar a conta.');
      return;
    }
    if (valorACobrar <= 0) {
      setErro('Informe um valor válido a cobrar.');
      return;
    }

    setProcessando(true);
    setErro('');

    try {
      const comanda = mesa3d.comanda;
      const pedidoBase = [...mesa3d.pedidos].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
      const isPagamentoParcial = valorACobrar < saldoDevedorMesa - 0.05;

      // Grava o pagamento atrelado à comanda
      await supabase.from('pagamentos').insert({
        pedido_id: pedidoBase.id,
        metodo,
        valor_pago: valorACobrar,
        status: 'PAGO',
        data_pagamento: new Date().toISOString(),
      });

      if (!isPagamentoParcial) {
        // Fechamento Total da Mesa
        if (valorServico > 0) {
          await supabase
            .from('pedidos')
            .update({ valor_total: Number(pedidoBase.valor_total) + valorServico })
            .eq('id', pedidoBase.id);
        }
        await supabase
          .from('pedidos')
          .update({ status: 'FINALIZADO' })
          .eq('comanda_id', comanda.id)
          .not('status', 'in', '(CANCELADO,FINALIZADO)');

        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from('comandas')
          .update({
            status: 'FECHADA',
            fechada_em: new Date().toISOString(),
            fechada_por: user?.id ?? null,
            metodo_pagamento: metodo,
            valor_servico: valorServico,
            taxa_servico_pct: taxaPct,
          })
          .eq('id', comanda.id);
      }

      // Impressão do recibo do assento ou da mesa
      imprimir({
        template: 'CONTA_MESA',
        lojaNome: loja?.nome || 'MiseOn',
        loja: loja ?? undefined,
        contaMesa: {
          mesaNumero: mesa3d.mesa.numero,
          numerosPedidos: mesa3d.pedidos.map((p) => p.numero),
          itens: mesa3d.pedidos.flatMap((p) =>
            (p.itens_pedido ?? [])
              .filter((i) => !assentoAtivo || i.assento_numero === assentoAtivo)
              .map((i) => ({
                nome_produto: `${i.nome_produto}${i.assento_numero ? ` (Cadeira #${i.assento_numero})` : ''}`,
                quantidade: i.quantidade,
                preco_unitario: Number(i.preco_unitario),
              }))
          ),
          subtotal: subtotalAssento,
          taxaServicoPct: taxaPct,
          valorServico: valorServicoAssento,
          total: totalAssento,
          metodoPagamento: METODOS.find((m) => m.m === metodo)?.label,
          valorPagoParcial: isPagamentoParcial ? valorACobrar : undefined,
        },
      });

      onAtualizar();
      if (!isPagamentoParcial) onClose();
      else setFechandoMetodo(null);
    } catch (e: any) {
      setErro('Erro ao processar pagamento: ' + (e.message || String(e)));
    }
    setProcessando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-gray-800 bg-gray-950 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Drawer */}
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-gray-100">
              <Utensils size={18} className="text-orange-400" /> Mesa {mesa3d.mesa.numero}
              {mesa3d.mesa.nome && <span className="text-xs font-normal text-gray-400">({mesa3d.mesa.nome})</span>}
            </h3>
            <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
              <span>{mesa3d.capacidade} assentos</span> ·
              <span className="flex items-center gap-1 font-semibold text-orange-400">
                <Clock size={12} /> {mesa3d.tempoMinutos >= 60 ? `${Math.floor(mesa3d.tempoMinutos / 60)}h ${mesa3d.tempoMinutos % 60}m em mesa` : `${mesa3d.tempoMinutos}m em mesa`}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-800"><X size={20} /></button>
        </div>

        {/* Grade Visual de Assentos / Cadeiras */}
        <div className="border-b border-gray-800 bg-gray-900/50 p-3">
          <p className="mb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Selecione o Assento / Cadeira</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setAssentoAtivo(null)}
              className={`flex flex-col items-center justify-center min-w-[70px] rounded-xl px-3 py-2 text-xs font-bold transition border ${
                assentoAtivo === null
                  ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                  : 'border-gray-800 bg-gray-900 text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span>Visão Geral</span>
              <span className="text-[10px] opacity-75 font-normal">Mesa Toda</span>
            </button>

            {mesa3d.assentos.map((a) => (
              <button
                key={a.numero}
                onClick={() => setAssentoAtivo(a.numero)}
                className={`flex flex-col items-center justify-center min-w-[70px] rounded-xl px-3 py-2 text-xs font-bold transition border relative ${
                  assentoAtivo === a.numero
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : a.ocupado
                    ? 'border-emerald-500/40 bg-gray-900 text-emerald-300'
                    : 'border-gray-800 bg-gray-900/60 text-gray-500'
                }`}
              >
                <span>Cadeira #{a.numero}</span>
                <span className="text-[10px] font-mono mt-0.5">
                  {a.valorConsumido > 0 ? fmt(a.valorConsumido) : 'Livre'}
                </span>
                {a.valorConsumido > 0 && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo Principal Scrollável */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {mesa3d.temItemEmPreparo && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-300">
              <ShieldAlert size={16} /> {tDynamic('A cozinha está preparando itens desta mesa.')}
            </div>
          )}

          {/* Botão de Lançar Pedido no Assento */}
          <button
            onClick={() => onNovoPedidoAssento?.(mesa3d.mesa.numero, assentoAtivo)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-orange-500"
          >
            <Plus size={16} /> Lançar Pedido {assentoAtivo ? `no Assento #${assentoAtivo}` : 'na Mesa'}
          </button>

          {/* Modalidades de Divisão de Comanda */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-black text-gray-200 uppercase tracking-wider mb-3">
              <Calculator size={14} className="text-blue-400" /> {tDynamic('Modalidade de Divisão de Conta')}
            </h4>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setModoDivisao('POR_ASSENTO')}
                className={`rounded-xl p-2.5 text-xs font-bold border transition ${
                  modoDivisao === 'POR_ASSENTO'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-gray-800 bg-gray-900 text-gray-400'
                }`}
              >
                Por Assento
              </button>

              <button
                onClick={() => setModoDivisao('IGUALITARIA')}
                className={`rounded-xl p-2.5 text-xs font-bold border transition ${
                  modoDivisao === 'IGUALITARIA'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-gray-800 bg-gray-900 text-gray-400'
                }`}
              >
                Igualitária
              </button>

              <button
                onClick={() => setModoDivisao('PARCIAL_VALOR')}
                className={`rounded-xl p-2.5 text-xs font-bold border transition ${
                  modoDivisao === 'PARCIAL_VALOR'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-gray-800 bg-gray-900 text-gray-400'
                }`}
              >
                Valor Livre
              </button>
            </div>

            {modoDivisao === 'PARCIAL_VALOR' && (
              <div className="mt-3 border-t border-gray-800 pt-3">
                <label className="text-xs font-semibold text-gray-400">Informe o valor a pagar agora (R$)</label>
                <input
                  type="text"
                  value={valorDigitado}
                  onChange={(e) => setValorDigitado(e.target.value)}
                  placeholder={fmt(saldoDevedorMesa)}
                  className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-950 p-2.5 text-center text-lg font-black text-white outline-none focus:border-blue-500"
                />
              </div>
            )}

            {modoDivisao === 'IGUALITARIA' && (
              <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3 text-xs">
                <span className="text-gray-400 font-semibold">{tDynamic('Dividir por quantas pessoas?')}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQtdPessoasDivisao((q) => Math.max(1, q - 1))}
                    className="h-7 w-7 rounded-lg bg-gray-800 font-black text-gray-200"
                  >
                    -
                  </button>
                  <span className="font-mono text-sm font-black text-white">{qtdPessoasDivisao}</span>
                  <button
                    onClick={() => setQtdPessoasDivisao((q) => q + 1)}
                    className="h-7 w-7 rounded-lg bg-gray-800 font-black text-gray-200"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Resumo da Cobrança */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal {assentoAtivo ? `Assento #${assentoAtivo}` : 'Mesa'}</span>
              <span className="font-semibold text-gray-200">{fmt(subtotalAssento)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-400 text-xs">
              <span className="flex items-center gap-1">{tDynamic('Taxa de serviço (%)')}</span>
              <input
                type="number"
                min={0}
                max={30}
                value={taxaPct}
                onChange={(e) => setTaxaPct(Number(e.target.value))}
                className="w-14 rounded-lg border border-gray-800 bg-gray-950 p-1 text-center font-bold text-gray-100"
              />
            </div>
            <div className="flex justify-between text-base font-black text-gray-100 border-t border-gray-800 pt-2">
              <span>A Cobrar Agora</span>
              <span className="text-emerald-400">{fmt(valorACobrar)}</span>
            </div>
          </div>

          {erro && <p className="text-xs font-bold text-red-500 text-center">{erro}</p>}

          {/* Métodos de Pagamento / Fechamento */}
          {!fechandoMetodo ? (
            <div className="grid grid-cols-2 gap-2">
              {METODOS.map((m) => (
                <button
                  key={m.m}
                  onClick={() => setFechandoMetodo(m.m)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-gray-800 bg-gray-900 p-3 text-xs font-bold text-gray-300 transition hover:border-emerald-500 hover:text-emerald-400"
                >
                  <m.icon size={16} /> {m.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
              <div className="flex justify-between text-xs font-black text-emerald-400">
                <span>Pagar via {METODOS.find((x) => x.m === fechandoMetodo)?.label}</span>
                <button onClick={() => setFechandoMetodo(null)} className="text-gray-400 underline">Trocar</button>
              </div>

              <button
                onClick={() => confirmarPagamento(fechandoMetodo)}
                disabled={processando}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-50"
              >
                <Check size={16} /> Confirmar {fmt(valorACobrar)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
