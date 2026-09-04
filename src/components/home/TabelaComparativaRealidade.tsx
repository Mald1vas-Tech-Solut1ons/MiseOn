import { Check, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../contexts/I18nContext';

const LINHAS = [
  {
    situacao: 'PDV separado do estoque',
    problema: 'Você vende sem saber o custo real do prato e a margem desaba sem avisar.',
    miseon: 'Cada venda baixa o estoque exato por Ficha Técnica pelo custo PEPS.',
  },
  {
    situacao: 'Estoque no Excel ou no caderninho',
    problema: 'Você descobre a falta do insumo principal quando o prato já acabou no rush.',
    miseon: 'Alerta automático de estoque crítico e entrada pelo cupom fiscal (NFC-e).',
  },
  {
    situacao: 'Pedido anotado no papel',
    problema: 'Letra ilegível e rasuras viram refazimento de pratos e comida no lixo.',
    miseon: 'KDS de cozinha sem papel com telas de produção divididas por estação.',
  },
  {
    situacao: 'Ficha técnica estática / desatualizada',
    problema: 'O preço da carne/queijo sobe no fornecedor e você continua vendendo pelo preço antigo.',
    miseon: 'Atualização dinâmica de CMV por lote: o custo acompanha o valor pago na nota.',
  },
  {
    situacao: 'iFood separado da operação de balcão',
    problema: 'Mais uma tela no balcão, duas contabilidades e caos na conciliação.',
    miseon: 'Pedidos do iFood caindo na mesma fila do balcão e baixando o mesmo estoque.',
  },
];

export default function TabelaComparativaRealidade() {
  const { tDynamic } = useI18n();

  return (
    <section className="relative overflow-hidden bg-slate-900/60 py-20 border-b border-white/10 text-white backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1 text-xs font-black uppercase tracking-widest text-purple-300">
            {tDynamic('Comparativo de Realidade Operacional')}
          </span>
          <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight sm:text-4xl">
            {tDynamic('Você sabe o impacto de cada gargalo na sua loja?')}<br />
            <span className="text-purple-400">{tDynamic('Veja o que acontece no seu bolso e no seu caixa.')}</span>
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            {tDynamic('Veja a diferença entre trabalhar com ferramentas soltas e ter uma operação onde tudo protege o seu dinheiro:')}
          </p>
        </div>

        {/* Tabela de Conversão */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-12 bg-[#0F172A]/90 p-4 sm:p-6 text-xs font-black uppercase tracking-wider text-slate-400 border-b border-white/10">
            <div className="col-span-4 sm:col-span-3">{tDynamic('Na sua rotina atual...')}</div>
            <div className="col-span-4 text-center text-red-400">{tDynamic('O que acontece no seu bolso e caixa')}</div>
            <div className="col-span-4 sm:col-span-5 text-center text-emerald-400 font-extrabold">{tDynamic('Como o MiseOn protege seu lucro')}</div>
          </div>

          <div className="divide-y divide-white/10 text-xs sm:text-sm">
            {LINHAS.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center p-4 sm:p-6 transition hover:bg-white/5">
                {/* Coluna 1: Situação */}
                <div className="col-span-4 sm:col-span-3 font-bold text-white flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FC5B24] mt-1.5 shrink-0" />
                  <span>{tDynamic(row.situacao)}</span>
                </div>

                {/* Coluna 2: Problema */}
                <div className="col-span-4 text-center text-slate-300 text-xs sm:text-sm px-2 flex items-center justify-center gap-1.5">
                  <X size={15} className="text-red-400 shrink-0 hidden sm:inline" />
                  <span>{tDynamic(row.problema)}</span>
                </div>

                {/* Coluna 3: Solução MiseOn */}
                <div className="col-span-4 sm:col-span-5 text-center font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-2.5 sm:p-3 text-xs sm:text-sm shadow-inner flex items-center justify-center gap-1.5">
                  <Check size={16} className="text-emerald-400 shrink-0 hidden sm:inline" />
                  <span>{tDynamic(row.miseon)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/cadastre-se"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-sm font-extrabold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105"
          >
            {tDynamic('Quero Conectar Minha Operação (30 Dias Grátis)')} <ArrowRight size={18} />
          </Link>
        </div>

      </div>
    </section>
  );
}
