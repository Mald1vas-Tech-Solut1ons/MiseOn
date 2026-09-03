import { useState } from 'react';
import { CheckSquare, Square, ShieldAlert, Siren, ArrowRight, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../contexts/I18nContext';

const CENAS = [
  {
    id: 'fornecedor',
    titulo: 'O aumento surpresa do fornecedor',
    descricao: 'O preço da carne, queijo ou óleo subiu e você só percebeu semanas depois, vendendo pratos com margem reduzida sem saber.',
    perdaEstimada: 1400,
  },
  {
    id: 'pico',
    titulo: 'O caos no pico de sexta-feira à noite',
    descricao: 'Pedidos do iFood, balcão e WhatsApp se misturam, comandas rasuram e a cozinha perde o tempo de preparo.',
    perdaEstimada: 1200,
  },
  {
    id: 'estoque',
    titulo: 'A ilusão do estoque no olhômetro',
    descricao: 'A planilha ou a memória dizia que tinha insumo, mas no meio do movimento de sábado o ingrediente principal acabou.',
    perdaEstimada: 1800,
  },
  {
    id: 'caixa',
    titulo: 'O mistério do fechamento de caixa',
    descricao: 'As vendas aconteceram e o caixa fechou, mas no final do mês você não sabe explicar exatamente para onde foi a margem.',
    perdaEstimada: 2500,
  },
];

export default function DiagnosticoOperacional() {
  const { tDynamic } = useI18n();
  const [marcados, setMarcados] = useState<Record<string, boolean>>({
    fornecedor: true,
    pico: true,
  });

  const alternar = (id: string) => {
    setMarcados((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const itensMarcados = CENAS.filter((c) => marcados[c.id]);
  const totalMarcados = itensMarcados.length;
  const perdaTotalEstimada = itensMarcados.reduce((acc, c) => acc + c.perdaEstimada, 0);

  return (
    <section className="relative overflow-hidden bg-[#0B1120] py-20 border-b border-white/10 text-white">
      {/* Glow de fundo pulsante se houver alarmes */}
      <div className={`pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl transition-all duration-500 ${
        totalMarcados >= 2 ? 'bg-red-600/25 animate-pulse' : 'bg-orange-500/10'
      }`} />
      
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
        
        {/* Badge do Diagnóstico */}
        <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
          totalMarcados >= 2
            ? 'border-red-500/60 bg-red-500/20 text-red-400 shadow-lg shadow-red-500/20 animate-bounce'
            : 'border-orange-500/30 bg-orange-500/10 text-orange-400'
        }`}>
          {totalMarcados >= 2 ? <Siren size={16} className="text-red-400 animate-spin" /> : <ShieldAlert size={14} />}
          {totalMarcados >= 2 ? tDynamic('ALERTA CRÍTICO DE PERDA DE MARGEM') : tDynamic('Diagnóstico da Operação Real')}
        </span>

        <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight sm:text-4xl">
          {tDynamic('Você não precisa de mais um sistema.')}<br />
          <span className={totalMarcados >= 2 ? 'text-red-400' : 'text-orange-400'}>
            {tDynamic('Precisa parar de perder dinheiro sem perceber.')}
          </span>
        </h2>
        
        <p className="mt-3 text-sm text-slate-300 max-w-2xl mx-auto">
          {tDynamic('Marque abaixo as situações que costumam acontecer na rotina do seu estabelecimento:')}
        </p>

        {/* Lista de Checkboxes Interativos */}
        <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
          {CENAS.map((c) => {
            const selecionado = !!marcados[c.id];
            return (
              <div
                key={c.id}
                onClick={() => alternar(c.id)}
                className={`group cursor-pointer rounded-2xl border p-5 transition-all duration-300 ${
                  selecionado
                    ? 'border-red-500/70 bg-red-950/30 shadow-xl shadow-red-500/10 scale-[1.01]'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {selecionado ? (
                      <CheckSquare size={22} className="text-red-400" />
                    ) : (
                      <Square size={22} className="text-slate-500 group-hover:text-slate-300" />
                    )}
                  </div>
                  <div>
                    <h3 className={`font-['Sora'] text-base font-bold transition-colors ${selecionado ? 'text-red-200' : 'text-white'}`}>
                      {tDynamic(c.titulo)}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {tDynamic(c.descricao)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Painel Dinâmico de Alarme e Urgência */}
        <div className={`mt-8 rounded-3xl border p-6 sm:p-8 transition-all duration-500 shadow-2xl backdrop-blur-xl ${
          totalMarcados >= 2
            ? 'border-red-500/80 bg-gradient-to-r from-red-950/70 via-slate-900 to-red-950/70 shadow-red-500/20 ring-2 ring-red-500/30'
            : totalMarcados === 1
            ? 'border-amber-500/60 bg-amber-950/30 text-amber-200'
            : 'border-emerald-500/60 bg-emerald-950/30 text-emerald-200'
        }`}>
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 text-left">
            
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                {totalMarcados >= 2 ? (
                  <Flame size={22} className="text-red-400 animate-pulse shrink-0" />
                ) : (
                  <ShieldAlert size={22} className="text-amber-400 shrink-0" />
                )}
                <h3 className="font-['Sora'] text-lg font-extrabold text-white">
                  {totalMarcados >= 2
                    ? tDynamic('ALERTA CRÍTICO: Sua operação possui vazamentos silenciosos de margem.')
                    : totalMarcados === 1
                    ? tDynamic('ALERTA MODERADO: Sua loja possui 1 gargalo ativo gerando vazamento invisível.')
                    : tDynamic('OPERAÇÃO SAUDÁVEL: Nenhum gargalo marcado! O MiseOn expande sua eficiência.')}
                </h3>
              </div>

              <p className="text-xs leading-relaxed text-slate-300">
                {totalMarcados >= 2
                  ? tDynamic('Ao marcar 2 ou mais itens, você está administrando no escuro. Cada dia sem automação é dinheiro deixado na mesa.')
                  : tDynamic('Mesmo com poucos gargalos, pequenos desvios de fichas técnicas acumulam grandes perdas no final do ano.')}
              </p>
            </div>

            {/* Contador de Perda em Tempo Real */}
            {totalMarcados > 0 && (
              <div className="shrink-0 rounded-2xl border border-red-500/40 bg-black/60 p-4 text-center sm:min-w-[240px]">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  {tDynamic('Vazamento invisível acumulado:')}
                </span>
                <span className="font-['Sora'] text-3xl font-black text-red-400 block mt-1 animate-pulse">
                  R$ {perdaTotalEstimada.toLocaleString('pt-BR')}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                  {tDynamic('por mês caindo pelo ralo')}
                </span>
              </div>
            )}

          </div>

          {/* CTA de Urgência */}
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-300 font-semibold text-center sm:text-left">
              {tDynamic('Recupere o controle financeiro e zere o desperdício em menos de 24 horas.')}
            </span>
            <Link
              to="/cadastre-se"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-7 py-3.5 font-['Sora'] text-sm font-extrabold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105"
            >
              {tDynamic('Quero Estancar Esse Vazamento Agora (30 Dias Grátis)')} <ArrowRight size={16} />
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
}
