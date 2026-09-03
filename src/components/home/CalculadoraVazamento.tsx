import { useState } from 'react';
import { Calculator, ArrowRight, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SAAS_PRICING } from '../../lib/efiInfo';
import { useI18n } from '../../contexts/I18nContext';

export default function CalculadoraVazamento() {
  const { tDynamic } = useI18n();
  const [faturamento, setFaturamento] = useState<number>(50000);
  const [pctDesperdicio, setPctDesperdicio] = useState<number>(3);
  const [pctAumentoInsumos, setPctAumentoInsumos] = useState<number>(4);
  const [errosComandaSemana, setErrosComandaSemana] = useState<number>(3);

  // Cálculo do Vazamento Estimado
  const perdaDesperdicio = faturamento * (pctDesperdicio / 100);
  const perdaInsumosNaoRepassados = (faturamento * 0.35) * (pctAumentoInsumos / 100); // 35% CMV médio
  const perdaErrosComanda = errosComandaSemana * 35 * 4; // R$ 35 ticket médio x 4 semanas

  const vazamentoMensalTotal = Math.round(perdaDesperdicio + perdaInsumosNaoRepassados + perdaErrosComanda);
  const vazamentoAnualTotal = vazamentoMensalTotal * 12;

  const precoMensalSaaS = SAAS_PRICING.anual.mensalEquivalente;
  const multiplicadorRetorno = Math.max(1, Math.round(vazamentoMensalTotal / precoMensalSaaS));

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] py-20 text-white border-b border-white/10">
      <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1 text-xs font-black uppercase tracking-widest text-blue-400">
            <Calculator size={14} /> {tDynamic('Calculadora de Vazamento de Caixa')}
          </span>
          <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight sm:text-4xl">
            {tDynamic('Quanto dinheiro pode estar escapando da sua operação todo mês?')}
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            {tDynamic('Ajuste as estimativas abaixo com a realidade do seu restaurante e veja o impacto acumulado no seu bolso:')}
          </p>
        </div>

        {/* Card Interativo da Calculadora */}
        <div className="mt-12 rounded-3xl border border-white/15 bg-white/5 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            
            {/* Controles / Inputs (Esquerda) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* 1. Faturamento Mensal */}
              <div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <label className="font-bold text-slate-200">{tDynamic('Faturamento Mensal do Restaurante:')}</label>
                  <span className="font-mono font-black text-lg text-emerald-400">
                    R$ {faturamento.toLocaleString('pt-BR')}
                  </span>
                </div>
                <input
                  type="range"
                  min={10000}
                  max={200000}
                  step={5000}
                  value={faturamento}
                  onChange={(e) => setFaturamento(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1 font-mono">
                  <span>R$ 10.000</span>
                  <span>R$ 100.000</span>
                  <span>R$ 200.000</span>
                </div>
              </div>

              {/* 2. Desperdício de Insumos */}
              <div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <label className="font-bold text-slate-200">{tDynamic('Desperdício / Perda no Pré-Preparo e Validades:')}</label>
                  <span className="font-mono font-bold text-orange-400">{pctDesperdicio}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={pctDesperdicio}
                  onChange={(e) => setPctDesperdicio(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
                />
              </div>

              {/* 3. Aumento Não Repassado */}
              <div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <label className="font-bold text-slate-200">{tDynamic('Aumento de Insumos Não Repassado no Cardápio:')}</label>
                  <span className="font-mono font-bold text-amber-400">{pctAumentoInsumos}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={pctAumentoInsumos}
                  onChange={(e) => setPctAumentoInsumos(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
                />
              </div>

              {/* 4. Erros de Comanda */}
              <div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <label className="font-bold text-slate-200">{tDynamic('Pedidos Refeitos / Erros de Comanda por Semana:')}</label>
                  <span className="font-mono font-bold text-red-400">{errosComandaSemana} pedidos/sem</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={errosComandaSemana}
                  onChange={(e) => setErrosComandaSemana(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
                />
              </div>

            </div>

            {/* Resultado do Vazamento (Direita) */}
            <div className="lg:col-span-5 rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-950/40 via-slate-900 to-red-950/20 p-6 text-center shadow-xl">
              <div className="inline-flex rounded-full bg-red-500/20 px-3 py-1 text-xs font-black uppercase text-red-400 mb-3 flex items-center gap-1 mx-auto">
                <TrendingDown size={14} /> {tDynamic('Estimativa de Vazamento')}
              </div>
              
              <p className="text-xs text-slate-300 uppercase tracking-widest font-bold">{tDynamic('Perda Silenciosa de Caixa')}</p>
              
              <div className="mt-2 text-4xl font-extrabold text-red-400 font-['Sora']">
                R$ {vazamentoMensalTotal.toLocaleString('pt-BR')}<span className="text-sm text-slate-400 font-normal"> / mês</span>
              </div>
              
              <p className="mt-1 text-xs text-slate-400">
                ({tDynamic('Equivalente a')} <strong className="text-red-300">R$ {vazamentoAnualTotal.toLocaleString('pt-BR')}</strong> {tDynamic('por ano')})
              </p>

              <div className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-300 leading-relaxed text-left space-y-2">
                <p>
                  💡 {tDynamic('O plano anual do MiseOn custa')} <strong>R$ {precoMensalSaaS.toFixed(2).replace('.', ',')}/mês</strong>.
                </p>
                <p className="text-emerald-400 font-bold">
                  ➔ {tDynamic('O sistema se paga cerca de')} <strong>{multiplicadorRetorno}x {tDynamic('todo mês')}</strong> {tDynamic('ao estancar esses vazamentos.')}
                </p>
              </div>

              <Link
                to="/cadastre-se"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-5 py-3.5 font-['Sora'] text-sm font-extrabold text-white shadow-lg transition hover:scale-[1.02]"
              >
                {tDynamic('Estancar Vazamentos (30 Dias Grátis)')} <ArrowRight size={16} />
              </Link>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
