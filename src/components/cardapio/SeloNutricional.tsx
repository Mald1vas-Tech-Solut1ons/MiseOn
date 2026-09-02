import { AlertTriangle, Flame, ShieldCheck } from 'lucide-react';
import { ATRIBUTOS, formatarValor, type NutricaoProduto } from '../../lib/nutricao';

/**
 * O resumo que cabe num card de cardápio: caloria, um selo de atributo e o
 * aviso de alérgeno. É o que faz o cliente abrir (ou não abrir) o produto.
 *
 * Deliberadamente pequeno: quem quiser a tabela inteira abre o item. O que
 * não pode faltar aqui é o alérgeno — quem tem restrição precisa enxergar
 * antes de clicar, não depois.
 */
export default function SeloNutricional({ dados, compacto = false }: { dados?: NutricaoProduto; compacto?: boolean }) {
  if (!dados) return null;

  const kcal = dados.publicavel ? dados.por_porcao?.ENERGIA_KCAL : undefined;
  const atributo = (dados.atributos ?? []).find((a) => ATRIBUTOS[a]);
  const contem = dados.alergenos_contem ?? [];

  if (!Number.isFinite(kcal) && !atributo && contem.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {Number.isFinite(kcal) && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-900/90 px-1.5 py-0.5 text-[9px] font-black text-white dark:bg-gray-100 dark:text-gray-900">
          <Flame size={9} strokeWidth={3} />
          {formatarValor(kcal as number, 'kcal')} kcal
        </span>
      )}

      {atributo && (
        <span
          title={ATRIBUTOS[atributo].criterio}
          className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
        >
          <ShieldCheck size={9} strokeWidth={3} />
          {ATRIBUTOS[atributo].rotulo}
        </span>
      )}

      {contem.length > 0 && !compacto && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
          <AlertTriangle size={9} strokeWidth={3} />
          {contem.length === 1 ? `Contém ${contem[0].toLowerCase()}` : `${contem.length} alergênicos`}
        </span>
      )}
    </div>
  );
}
