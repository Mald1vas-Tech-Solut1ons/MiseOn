/**
 * EditorLayout3DModal.tsx — Editor de Arranjo Físico do Salão e Formatos de Mesa.
 */

import { useState } from 'react';
import { X, Save, Layers } from 'lucide-react';
import type { Mesa, FormatoMesa } from '../../types';
import { supabase } from '../../lib/supabase';

import { useI18n } from '../../contexts/I18nContext';
interface Props {
  mesas: Mesa[];
  onClose: () => void;
  onSalvo: () => void;
}

export function EditorLayout3DModal({ mesas, onClose, onSalvo }: Props) {
  const { tDynamic } = useI18n();
  const [mesaSelecionadaId, setMesaSelecionadaId] = useState<string>(mesas[0]?.id ?? '');
  const [formato, setFormato] = useState<FormatoMesa>('QUADRADA');
  const [capacidade, setCapacidade] = useState<number>(4);
  const [setor, setSetor] = useState<string>('Principal');
  const [rotacao, setRotacao] = useState<number>(0);
  const [salvando, setSalvando] = useState(false);

  const selecionarMesaParaEdicao = (id: string) => {
    setMesaSelecionadaId(id);
    const target = mesas.find((m) => m.id === id);
    if (target) {
      setFormato(target.formato ?? 'QUADRADA');
      setCapacidade(target.capacidade ?? 4);
      setSetor(target.setor ?? 'Principal');
      setRotacao(target.rotacao ?? 0);
    }
  };

  const salvarAlteracoes = async () => {
    if (!mesaSelecionadaId) return;
    setSalvando(true);
    try {
      await supabase
        .from('mesas')
        .update({
          formato,
          capacidade,
          setor,
          rotacao,
        })
        .eq('id', mesaSelecionadaId);

      onSalvo();
    } catch (e) {
      console.error(e);
    }
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-gray-800 bg-gray-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black text-gray-100">
            <Layers size={18} className="text-orange-400" /> {tDynamic('Configurar Salão 3D')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400">Selecione a Mesa</label>
            <select
              value={mesaSelecionadaId}
              onChange={(e) => selecionarMesaParaEdicao(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-sm font-bold text-gray-100 outline-none"
            >
              {mesas.map((m) => (
                <option key={m.id} value={m.id}>
                  Mesa {m.numero} {m.nome ? `(${m.nome})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400">{tDynamic('Formato da Mesa')}</label>
              <select
                value={formato}
                onChange={(e) => setFormato(e.target.value as FormatoMesa)}
                className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-sm font-bold text-gray-100 outline-none"
              >
                <option value="QUADRADA">Quadrada</option>
                <option value="REDONDA">Redonda</option>
                <option value="RETANGULAR">Retangular</option>
                <option value="BOOTH">Booth / Cabine</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">Assentos / Lugares</label>
              <input
                type="number"
                min={1}
                max={20}
                value={capacidade}
                onChange={(e) => setCapacidade(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-sm font-bold text-gray-100 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400">Setor do Salão</label>
            <input
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              placeholder="ex: Principal, Varanda, Rooftop, VIP"
              className="mt-1 w-full rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-sm font-bold text-gray-100 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400">Rotação 3D ({rotacao}°)</label>
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              value={rotacao}
              onChange={(e) => setRotacao(Number(e.target.value))}
              className="mt-2 w-full accent-orange-500"
            />
          </div>

          <button
            onClick={salvarAlteracoes}
            disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-orange-500 disabled:opacity-50"
          >
            <Save size={16} /> {salvando ? 'Salvando…' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
