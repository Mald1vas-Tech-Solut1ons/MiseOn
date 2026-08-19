import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';

/** Nutrientes como o motor devolve (chaves em caixa alta, ver fn_calcular_nutricao_receita). */
export interface NutricaoProduto {
  produto_id: string;
  status: string;
  cobertura_pct: number;
  massa_g: number;
  nutrientes: Record<string, number>;
}

/**
 * Ordem e rótulos seguem a rotulagem nutricional brasileira (RDC 429/2020):
 * valor energético primeiro, depois macronutrientes, açúcares, fibras e sódio.
 * Fugir dessa ordem faz o cliente procurar o dado no lugar errado.
 */
const LINHAS: Array<{ chave: string; rotulo: string; unidade: string; destaque?: boolean }> = [
  { chave: 'ENERGIA_KCAL', rotulo: 'Valor energético', unidade: 'kcal', destaque: true },
  { chave: 'CARBOIDRATOS', rotulo: 'Carboidratos', unidade: 'g' },
  { chave: 'ACUCARES_TOTAIS', rotulo: 'Açúcares totais', unidade: 'g' },
  { chave: 'ACUCARES_ADICIONADOS', rotulo: 'Açúcares adicionados', unidade: 'g' },
  { chave: 'PROTEINAS', rotulo: 'Proteínas', unidade: 'g', destaque: true },
  { chave: 'GORDURAS_TOTAIS', rotulo: 'Gorduras totais', unidade: 'g' },
  { chave: 'GORDURAS_SATURADAS', rotulo: 'Gorduras saturadas', unidade: 'g' },
  { chave: 'GORDURAS_TRANS', rotulo: 'Gorduras trans', unidade: 'g' },
  { chave: 'FIBRAS_ALIMENTARES', rotulo: 'Fibras alimentares', unidade: 'g' },
  { chave: 'COLESTEROL', rotulo: 'Colesterol', unidade: 'mg' },
  { chave: 'SODIO', rotulo: 'Sódio', unidade: 'mg', destaque: true },
];

const numero = (valor: number, unidade: string) => {
  if (!Number.isFinite(valor)) return '—';
  const casas = unidade === 'mg' || valor >= 100 ? 0 : 1;
  return valor.toFixed(casas).replace('.', ',');
};

export default function TabelaNutricional({ dados }: { dados: NutricaoProduto }) {
  const [aberto, setAberto] = useState(false);

  const kcal = dados.nutrientes?.ENERGIA_KCAL;
  const disponiveis = LINHAS.filter((l) => Number.isFinite(dados.nutrientes?.[l.chave]));
  if (disponiveis.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900/40">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-200">
          Informação nutricional
          {Number.isFinite(kcal) && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {numero(kcal, 'kcal')} kcal
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </button>

      {aberto && (
        <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-800">
          <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
            Porção de {numero(dados.massa_g, 'g')} g — o prato inteiro, como é servido.
          </p>

          <table className="w-full text-xs">
            <tbody>
              {disponiveis.map((l) => (
                <tr key={l.chave} className="border-b border-gray-200/70 last:border-0 dark:border-gray-800/70">
                  <td className={`py-1.5 ${l.destaque ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                    {l.rotulo}
                  </td>
                  <td className={`py-1.5 text-right tabular-nums ${l.destaque ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                    {numero(dados.nutrientes[l.chave], l.unidade)} {l.unidade}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/*
            Transparência obrigatória: o valor vem do somatório da ficha técnica,
            não de análise laboratorial. Quando parte dos insumos ainda não tem
            dado, o cliente precisa saber que o número é aproximado — inclusive
            quem evita um ingrediente por questão de saúde.
          */}
          <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-gray-500 dark:text-gray-500">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>
              Calculado a partir da ficha técnica do prato
              {dados.cobertura_pct < 100
                ? `, cobrindo ${numero(dados.cobertura_pct, 'g')}% dos ingredientes. Valores aproximados.`
                : '. Valores de referência, podendo variar conforme o preparo.'}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
