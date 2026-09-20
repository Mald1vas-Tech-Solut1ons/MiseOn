import { useState } from 'react';
import { ArrowRight, TrendingDown, SlidersHorizontal, Store, Coffee, Sandwich, Pizza, Utensils, Lightbulb, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SAAS_PRICING } from '../../lib/efiInfo';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Esta calculadora já supôs, escondido no código, CMV de 35% e ticket de R$ 35
 * para TODO mundo — e ainda anunciava "você economiza Nx o valor do plano".
 * Número que o lojista não informou não entra na conta dele, e o MiseOn não tem
 * cliente medido para prometer economia (ver CLAUDE.md). Agora CMV e ticket são
 * controles, os presets são declarados como exemplo, e o resultado diz o que é:
 * a soma dos valores que a própria pessoa colocou.
 */
interface Preset {
  nome: string;
  icone: typeof Store;
  fat: number;
  desp: number;
  aum: number;
  erros: number;
  cmv: number;
  ticket: number;
}

const PRESETS: Preset[] = [
  { nome: 'Lanchonete / Cafeteria (R$ 25k)', icone: Coffee, fat: 25000, desp: 3, aum: 4, erros: 2, cmv: 32, ticket: 22 },
  { nome: 'Hamburgueria / Delivery (R$ 50k)', icone: Sandwich, fat: 50000, desp: 4, aum: 5, erros: 4, cmv: 35, ticket: 42 },
  { nome: 'Pizzaria / Salão (R$ 100k)', icone: Pizza, fat: 100000, desp: 5, aum: 6, erros: 5, cmv: 33, ticket: 75 },
  { nome: 'Buffet / Quilo (R$ 150k)', icone: Utensils, fat: 150000, desp: 6, aum: 7, erros: 6, cmv: 38, ticket: 48 },
];

export default function CalculadoraVazamento() {
  const { tDynamic } = useI18n();
  const [faturamento, setFaturamento] = useState<number>(50000);
  const [pctDesperdicio, setPctDesperdicio] = useState<number>(3);
  const [pctAumentoInsumos, setPctAumentoInsumos] = useState<number>(4);
  const [errosComandaSemana, setErrosComandaSemana] = useState<number>(3);
  const [pctCmv, setPctCmv] = useState<number>(35);
  const [ticketMedio, setTicketMedio] = useState<number>(42);

  const aplicarPreset = (p: Preset) => {
    setFaturamento(p.fat);
    setPctDesperdicio(p.desp);
    setPctAumentoInsumos(p.aum);
    setErrosComandaSemana(p.erros);
    setPctCmv(p.cmv);
    setTicketMedio(p.ticket);
  };

  // Cada parcela usa um número que a pessoa informou nos controles acima.
  const perdaDesperdicio = faturamento * (pctDesperdicio / 100);
  const perdaInsumosNaoRepassados = faturamento * (pctCmv / 100) * (pctAumentoInsumos / 100);
  const perdaErrosComanda = errosComandaSemana * ticketMedio * 4;

  const vazamentoMensalTotal = Math.round(perdaDesperdicio + perdaInsumosNaoRepassados + perdaErrosComanda);
  const vazamentoAnualTotal = vazamentoMensalTotal * 12;

  const precoMensalSaaS = SAAS_PRICING.anual.mensalEquivalente;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] py-20 text-white border-b border-white/10">
      <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-blue-400 shadow-lg shadow-blue-500/10 animate-pulse">
            <SlidersHorizontal size={14} className="text-blue-400" />
            {tDynamic('CALCULADORA INTERATIVA — ARRASTE OS CONTROLES ABAIXO')}
          </span>

          <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight sm:text-4xl">
            {tDynamic('Você sabe quanto dinheiro está saindo do seu bolso todo mês?')}
          </h2>

          <p className="mt-3 text-sm text-slate-300">
            {tDynamic('Ajuste os controles interativos abaixo com a realidade do seu restaurante e veja o valor que pode ficar no seu bolso:')}
          </p>
        </div>

        {/* Atalhos Rápidos por Perfil de Estabelecimento */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-2">
            <Store size={14} /> {tDynamic('Exemplos (ajuste depois com os seus números):')}
          </span>
          {PRESETS.map((p, idx) => {
            const Icone = p.icone;
            return <button type="button"
              key={idx}
              onClick={() => aplicarPreset(p)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition border ${
                faturamento === p.fat
                  ? 'border-[#FC5B24] bg-[#FC5B24] text-white shadow-md'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <Icone size={13} aria-hidden="true" className="mr-1.5 inline-block align-[-2px]" />
              {tDynamic(p.nome)}
            </button>;
          })}
        </div>

        {/* Card Interativo da Calculadora */}
        <div className="mt-8 rounded-3xl border border-white/15 bg-white/5 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            
            {/* Controles / Inputs (Esquerda) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* 1. Faturamento Mensal */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:border-white/20">
                <div className="flex justify-between items-center text-sm mb-2">
                  <label className="font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-400" />
                    {tDynamic('Faturamento Mensal do Restaurante:')}
                  </label>
                  <span className="font-mono font-black text-lg text-emerald-400 bg-emerald-500/10 px-3 py-0.5 rounded-lg border border-emerald-500/20">
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
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
                  <span>R$ 10.000</span>
                  <span>R$ 100.000</span>
                  <span>R$ 200.000</span>
                </div>
              </div>

              {/* 2. Desperdício de Insumos */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:border-white/20">
                <div className="flex justify-between items-center text-sm mb-2">
                  <label className="font-bold text-slate-200">{tDynamic('Desperdício / Perda no Pré-Preparo e Validades:')}</label>
                  <span className="font-mono font-bold text-orange-400 bg-orange-500/10 px-2.5 py-0.5 rounded-lg border border-orange-500/20">
                    {pctDesperdicio}%
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={pctDesperdicio}
                  onChange={(e) => setPctDesperdicio(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
                />
              </div>

              {/* 3. Aumento Não Repassado */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:border-white/20">
                <div className="flex justify-between items-center text-sm mb-2">
                  <label className="font-bold text-slate-200">{tDynamic('Aumento de Insumos Não Repassado no Cardápio:')}</label>
                  <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                    {pctAumentoInsumos}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={pctAumentoInsumos}
                  onChange={(e) => setPctAumentoInsumos(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
                />
              </div>

              {/* 4. CMV informado pela própria loja */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:border-white/20">
                <div className="flex justify-between items-center text-sm mb-2">
                  <label className="font-bold text-slate-200">{tDynamic('CMV da sua loja (quanto do faturamento vira insumo):')}</label>
                  <span className="font-mono font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-lg border border-sky-500/20">
                    {pctCmv}%
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={60}
                  step={1}
                  value={pctCmv}
                  onChange={(e) => setPctCmv(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {tDynamic('Não sabe o seu? Calcule grátis na nossa calculadora de CMV.')}
                </p>
              </div>

              {/* 5. Ticket médio informado pela própria loja */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:border-white/20">
                <div className="flex justify-between items-center text-sm mb-2">
                  <label className="font-bold text-slate-200">{tDynamic('Ticket médio do seu pedido:')}</label>
                  <span className="font-mono font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-lg border border-sky-500/20">
                    R$ {ticketMedio.toLocaleString('pt-BR')}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={1}
                  value={ticketMedio}
                  onChange={(e) => setTicketMedio(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
                />
              </div>

              {/* 6. Erros de Comanda */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:border-white/20">
                <div className="flex justify-between items-center text-sm mb-2">
                  <label className="font-bold text-slate-200">{tDynamic('Pedidos Refeitos / Erros de Comanda por Semana:')}</label>
                  <span className="font-mono font-bold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-lg border border-red-500/20">
                    {errosComandaSemana} {tDynamic('pedidos/sem')}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={errosComandaSemana}
                  onChange={(e) => setErrosComandaSemana(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FC5B24]"
                />
              </div>

            </div>

            {/* Resultado do Vazamento (Direita) */}
            <div className="lg:col-span-5 rounded-2xl border border-red-500/40 bg-gradient-to-b from-red-950/50 via-slate-900 to-red-950/30 p-6 text-center shadow-2xl backdrop-blur-xl">
              <div className="inline-flex rounded-full bg-red-500/20 px-3 py-1 text-xs font-black uppercase text-red-400 mb-3 flex items-center gap-1 mx-auto border border-red-500/30">
                <TrendingDown size={14} /> {tDynamic('Estimativa de Vazamento')}
              </div>
              
              <p className="text-xs text-slate-300 uppercase tracking-widest font-bold">{tDynamic('Saindo do Seu Bolso e Caixa')}</p>
              
              <div className="mt-2 text-4xl font-extrabold text-red-400 font-['Sora'] animate-pulse">
                R$ {vazamentoMensalTotal.toLocaleString('pt-BR')}<span className="text-sm text-slate-400 font-normal"> {tDynamic('/ mês')}</span>
              </div>
              
              <p className="mt-1 text-xs text-slate-400">
                ({tDynamic('Equivalente a')} <strong className="text-red-300">R$ {vazamentoAnualTotal.toLocaleString('pt-BR')}</strong> {tDynamic('por ano fora do seu bolso')})
              </p>

              <div className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-300 leading-relaxed text-left space-y-2">
                <p>
                  {tDynamic('Esta é a soma dos valores que você informou acima: desperdício, aumento de insumo não repassado e pedidos refeitos. Não é promessa de economia, é o tamanho do problema que você mesmo estimou.')}
                </p>
                <p className="flex items-start gap-2">
                  <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
                  <span>{tDynamic('O plano anual do MiseOn custa')} <strong>R$ {precoMensalSaaS.toFixed(2).replace('.', ',')}/mês</strong>. {tDynamic('Quanto disso o sistema evita depende da sua operação, e quem mede é você.')}</span>
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
