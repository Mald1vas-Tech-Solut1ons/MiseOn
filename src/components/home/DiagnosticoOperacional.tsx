import { useState } from 'react';
import { AlertTriangle, CheckSquare, Square, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

const CENAS = [
  {
    id: 'fornecedor',
    titulo: 'O aumento surpresa do fornecedor',
    descricao: 'O preço da carne, queijo ou óleo subiu e você só percebeu semanas depois, vendendo pratos com margem reduzida sem saber.',
  },
  {
    id: 'pico',
    titulo: 'O caos no pico de sexta-feira à noite',
    descricao: 'Pedidos do iFood, balcão e WhatsApp se misturam, comandas rasuram e a cozinha perde o tempo de preparo.',
  },
  {
    id: 'estoque',
    titulo: 'A ilusão do estoque no olhômetro',
    descricao: 'A planilha ou a memória dizia que tinha insumo, mas no meio do movimento de sábado o ingrediente principal acabou.',
  },
  {
    id: 'caixa',
    titulo: 'O mistério do fechamento de caixa',
    descricao: 'As vendas aconteceram e o caixa fechou, mas no final do mês você não sabe explicar exatamente para onde foi a margem.',
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

  const totalMarcados = Object.values(marcados).filter(Boolean).length;

  return (
    <section className="relative overflow-hidden bg-slate-900 py-20 border-b border-white/10 text-white">
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
      
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1 text-xs font-black uppercase tracking-widest text-orange-400">
          <ShieldAlert size={14} /> {tDynamic('Diagnóstico da Operação Real')}
        </span>

        <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight sm:text-4xl">
          {tDynamic('Você não precisa de mais um sistema.')}<br />
          <span className="text-orange-400">{tDynamic('Precisa parar de perder dinheiro sem perceber.')}</span>
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
                className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 ${
                  selecionado
                    ? 'border-orange-500/60 bg-orange-500/10 shadow-lg shadow-orange-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 text-orange-400">
                    {selecionado ? <CheckSquare size={22} className="text-orange-400" /> : <Square size={22} className="text-slate-500" />}
                  </div>
                  <div>
                    <h3 className="font-['Sora'] text-base font-bold text-white">{tDynamic(c.titulo)}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">{tDynamic(c.descricao)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Veredito Dinâmico */}
        <div className={`mt-8 rounded-2xl border p-6 transition-all duration-300 ${
          totalMarcados >= 2
            ? 'border-red-500/40 bg-red-500/10 text-red-200'
            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
        }`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle size={24} className={`shrink-0 mt-0.5 ${totalMarcados >= 2 ? 'text-red-400' : 'text-emerald-400'}`} />
              <div>
                <p className="font-['Sora'] text-sm font-bold">
                  {totalMarcados >= 2
                    ? tDynamic('Diagnóstico: Sua operação possui vazamentos silenciosos de margem.')
                    : tDynamic('Diagnóstico: Boa gestão! O MiseOn ajuda a manter o controle 100% automatizado.')}
                </p>
                <p className="mt-1 text-xs opacity-90 leading-relaxed">
                  {totalMarcados >= 2
                    ? tDynamic('Ao marcar 2 ou mais itens, seu restaurante provavelmente está administrando parte do negócio no escuro, acumulando perdas invisíveis no final do mês.')
                    : tDynamic('Mantenha suas fichas técnicas e estoque integrados para evitar que surpresas de mercado reduzam seu lucro.')}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
