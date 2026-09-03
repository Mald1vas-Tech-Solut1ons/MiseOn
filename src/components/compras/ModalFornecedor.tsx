/**
 * Cadastro de fornecedor.
 *
 * Os campos operacionais (prazo de entrega, dias em que entrega, pedido mínimo)
 * não são enfeite de cadastro: são o que permite a Central de Compras dizer
 * "peça hoje, senão falta na quinta" em vez de só apontar o que já acabou.
 */

import { useState } from 'react';
import { X, Loader2, Truck, AlertTriangle } from 'lucide-react';
import { Fornecedor, salvarFornecedor } from '../../lib/compras';

import { useI18n } from '../../contexts/I18nContext';
interface Props {
  lojaId: string;
  fornecedor?: Fornecedor | null;
  onFechar: () => void;
  onSalvo: () => void;
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ModalFornecedor({ lojaId, fornecedor, onFechar, onSalvo }: Props) {
  const { tDynamic } = useI18n();
  const [f, setF] = useState<Partial<Fornecedor>>(fornecedor ?? { nome: '', ativo: true });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const set = (patch: Partial<Fornecedor>) => setF(v => ({ ...v, ...patch }));

  const toggleDia = (d: number) => {
    const atuais = f.dias_entrega ?? [];
    set({ dias_entrega: atuais.includes(d) ? atuais.filter(x => x !== d) : [...atuais, d].sort() });
  };

  const salvar = async () => {
    if (!f.nome?.trim() || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      await salvarFornecedor({ ...f, loja_id: lojaId, nome: f.nome, id: fornecedor?.id } as Fornecedor);
      onSalvo();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 23505 = índice único (loja, nome) entre fornecedores ativos.
      setErro(msg.includes('23505') || msg.includes('duplicate')
        ? `Já existe um fornecedor chamado "${f.nome}".`
        : `Não foi possível salvar: ${msg}`);
    } finally {
      setSalvando(false);
    }
  };

  const campo = 'mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';
  const rotulo = 'text-xs opacity-95 font-semibold text-gray-600 dark:text-gray-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900" onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-gray-100">
            <Truck size={18} className="text-[var(--cor-primaria)]" />
            {fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h2>
          <button onClick={onFechar} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6 hide-scrollbar">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={rotulo}>Nome *</span>
              <input className={campo} autoFocus placeholder="Ex: Distribuidora Central"
                value={f.nome ?? ''} onChange={e => set({ nome: e.target.value })} />
            </label>
            <label className="block">
              <span className={rotulo}>Razão social</span>
              <input className={campo} value={f.razao_social ?? ''} onChange={e => set({ razao_social: e.target.value })} />
            </label>
            <label className="block">
              <span className={rotulo}>CNPJ</span>
              <input className={campo} placeholder="00.000.000/0000-00"
                value={f.cnpj ?? ''} onChange={e => set({ cnpj: e.target.value })} />
            </label>
            <label className="block">
              <span className={rotulo}>Telefone / WhatsApp</span>
              <input className={campo} placeholder="(11) 99999-9999"
                value={f.telefone ?? ''} onChange={e => set({ telefone: e.target.value })} />
            </label>
            <label className="block">
              <span className={rotulo}>E-mail</span>
              <input className={campo} type="email" value={f.email ?? ''} onChange={e => set({ email: e.target.value })} />
            </label>
            <label className="block">
              <span className={rotulo}>{tDynamic('Pessoa de contato')}</span>
              <input className={campo} placeholder="Ex: Seu Zé, o vendedor"
                value={f.contato_nome ?? ''} onChange={e => set({ contato_nome: e.target.value })} />
            </label>
            <label className="block">
              <span className={rotulo}>{tDynamic('Condição de pagamento')}</span>
              <input className={campo} placeholder="Ex: 28 dias, à vista"
                value={f.condicao_pagamento ?? ''} onChange={e => set({ condicao_pagamento: e.target.value })} />
            </label>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
            <p className="mb-3 text-xs opacity-95 font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {tDynamic('Logística — alimenta a sugestão de compra')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={rotulo}>{tDynamic('Prazo de entrega (dias)')}</span>
                <input className={campo} type="number" min="0" placeholder="Ex: 2"
                  value={f.prazo_entrega_dias ?? ''} onChange={e => set({ prazo_entrega_dias: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className={rotulo}>{tDynamic('Pedido mínimo R$')}</span>
                <input className={campo} type="number" step="any" min="0" placeholder="Ex: 300"
                  value={f.pedido_minimo ?? ''} onChange={e => set({ pedido_minimo: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
            </div>
            <div className="mt-3">
              <span className={rotulo}>{tDynamic('Dias em que entrega')}</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {DIAS.map((d, i) => {
                  const ativo = (f.dias_entrega ?? []).includes(i);
                  return (
                    <button key={d} onClick={() => toggleDia(i)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs opacity-95 font-bold transition-colors ${
                        ativo ? 'bg-[var(--cor-primaria)] text-white shadow-sm'
                              : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="block">
            <span className={rotulo}>Observações</span>
            <textarea className={campo} rows={2} placeholder="Ex: só atende pedido até 16h"
              value={f.observacao ?? ''} onChange={e => set({ observacao: e.target.value })} />
          </label>

          {erro && (
            <p className="flex items-start gap-1.5 rounded-lg bg-red-50 p-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle size={14} className="mt-px shrink-0" /> {erro}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <button onClick={salvar} disabled={salvando || !f.nome?.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100">
            {salvando ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : 'Salvar fornecedor'}
          </button>
        </div>
      </div>
    </div>
  );
}
