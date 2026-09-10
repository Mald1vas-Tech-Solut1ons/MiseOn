import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, X, AlertCircle, Carrot, ChefHat, Box, ShoppingBag } from 'lucide-react';
import { Insumo } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { GRUPOS_FICHA, tipoDoInsumo, podeEntrarNaFicha } from '../../lib/fichaTecnica';

/** Ícone de cada grupo do seletor — só apresentação; a regra mora na lib. */
const ICONES: Record<string, typeof Carrot> = {
  ALIMENTO: Carrot,
  PREPARO: ChefHat,
  REVENDA: ShoppingBag,
  EMBALAGEM: Box,
};


const semAcento = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props {
  insumos: Insumo[];
  valor: string;
  onChange: (insumoId: string) => void;
  /** Ids já usados em outras linhas da ficha — some da lista para não duplicar. */
  jaUsados?: string[];
}

export default function SeletorInsumo({ insumos, valor, onChange, jaUsados = [] }: Props) {
  const { tDynamic } = useI18n();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const selecionado = insumos.find(i => i.id === valor);

  useEffect(() => {
    if (!aberto) return;
    buscaRef.current?.focus();
    const aoClicarFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  const grupos = useMemo(() => {
    const termo = semAcento(busca.trim());
    const usados = new Set(jaUsados.filter(id => id && id !== valor));
    const elegiveis = insumos.filter(i =>
      podeEntrarNaFicha(i) &&
      !usados.has(i.id) &&
      (!termo || semAcento(i.nome).includes(termo) || semAcento(i.categoria_insumo ?? '').includes(termo)),
    );
    return GRUPOS_FICHA
      .map(g => ({
        ...g,
        icone: ICONES[g.chave] ?? Carrot,
        itens: elegiveis
          .filter(i => g.tipos.includes(tipoDoInsumo(i)))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      }))
      .filter(g => g.itens.length > 0);
  }, [insumos, busca, jaUsados, valor]);

  const totalVisivel = grupos.reduce((s, g) => s + g.itens.length, 0);
  const bloqueados = insumos.filter(i => !podeEntrarNaFicha(i)).length;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => { setAberto(a => !a); setBusca(''); }}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left text-sm transition-colors ${
          selecionado
            ? 'border-gray-200 bg-transparent dark:border-gray-800'
            : 'border-orange-300 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20'
        }`}
      >
        <span className="min-w-0 truncate font-semibold dark:text-gray-100">
          {selecionado
            ? <>{selecionado.nome} <span className="font-medium text-gray-400">· {tDynamic('estoque em')} {selecionado.unidade_medida}</span></>
            : <span className="text-gray-500">{tDynamic('Buscar matéria-prima…')}</span>}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 max-h-80 w-full min-w-[18rem] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-2 border-b border-gray-100 p-2 dark:border-gray-800">
            <Search size={15} className="shrink-0 text-gray-400" />
            <input
              ref={buscaRef}
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={tDynamic('Digite o nome ou a categoria…')}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-gray-100"
            />
            {busca && <button type="button" onClick={() => setBusca('')} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>

          <div className="max-h-60 overflow-y-auto">
            {totalVisivel === 0 ? (
              <p className="px-3 py-6 text-center text-xs font-medium text-gray-400">
                {tDynamic('Nenhuma matéria-prima encontrada com esse termo.')}
              </p>
            ) : grupos.map(grupo => {
              const Icone = grupo.icone;
              return (
                <div key={grupo.chave}>
                  <div className="sticky top-0 bg-gray-50 px-3 py-1.5 dark:bg-gray-900">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <Icone size={12} /> {tDynamic(grupo.rotulo)}
                    </p>
                    <p className="text-[10px] leading-snug text-gray-400">{tDynamic(grupo.ajuda)}</p>
                  </div>
                  {grupo.itens.map(item => {
                    const saldo = Number(item.quantidade_atual ?? 0);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { onChange(item.id); setAberto(false); }}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/20 ${
                          item.id === valor ? 'bg-orange-50 dark:bg-orange-950/30' : ''
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold dark:text-gray-100">{item.nome}</span>
                          {item.categoria_insumo && <span className="block truncate text-[11px] text-gray-400">{item.categoria_insumo}</span>}
                        </span>
                        <span className={`shrink-0 whitespace-nowrap text-xs font-bold tabular-nums ${saldo > 0 ? 'text-gray-500' : 'text-amber-500'}`}>
                          {saldo > 0 ? `${saldo} ${item.unidade_medida}` : tDynamic('sem saldo')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {bloqueados > 0 && (
            <p className="flex items-start gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2 text-[11px] leading-snug text-gray-500 dark:border-gray-800 dark:bg-gray-900">
              <AlertCircle size={13} className="mt-px shrink-0 text-gray-400" />
              {bloqueados} {tDynamic('itens de limpeza, higiene, EPI e manutenção ficam fora da ficha por segurança alimentar. Se algum item de comida sumiu daqui, corrija a categoria dele no Estoque.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
