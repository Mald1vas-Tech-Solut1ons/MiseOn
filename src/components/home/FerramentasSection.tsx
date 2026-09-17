import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, Percent, Bike, Sparkles } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';
import { FERRAMENTAS, type SlugFerramenta } from '../../data/ferramentasData';

const ICONES: Record<SlugFerramenta, typeof Calculator> = {
  'calculadora-cmv': Calculator,
  'preco-ifood': Bike,
  'markup-preco-de-venda': Percent,
};

export default function FerramentasSection() {
  const { tDynamic, idioma } = useI18n();
  
  return (
    <section className="border-b border-white/10 bg-gradient-to-b from-[#070C18] to-[#0B1120] py-20 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 right-[-8%] h-96 w-96 rounded-full bg-[#0A5CC4]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-6%] h-80 w-80 rounded-full bg-[#FC5B24]/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-blue-400">
            <Sparkles size={13} /> {tDynamic('Ferramentas Gratuitas')}
          </span>
          <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {tDynamic('Decida o lucro com seus próprios números')}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            {tDynamic('Calculadoras gratuitas para donos de restaurante, hamburgueria e pizzaria. Sem cadastro e sem pegadinha: digite seus números e proteja a sua margem.')}
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FERRAMENTAS.map((f) => {
            const Icone = ICONES[f.slug];
            const nome = f.nome[idioma === 'en-US' ? 'en' : 'pt'];
            const resumo = f.resumo[idioma === 'en-US' ? 'en' : 'pt'];

            return (
              <Link
                key={f.slug}
                to={f.path}
                className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-[#FC5B24]/70 hover:bg-white/10 hover:shadow-2xl hover:shadow-[#FC5B24]/20"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FC5B24]/20 text-[#FC5B24]">
                      <Icone size={24} />
                    </span>
                    <span className="rounded-full border border-[#FC5B24]/30 bg-[#FC5B24]/10 px-3 py-1 text-[11px] font-black uppercase text-[#FC5B24]">
                      {tDynamic('Usar Agora')}
                    </span>
                  </div>
                  <h3 className="mt-5 font-['Sora'] text-xl font-bold text-white group-hover:text-[#FC5B24] transition-colors">
                    {nome}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {resumo}
                  </p>
                </div>
                
                <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-[#FC5B24] group-hover:translate-x-1 transition-transform">
                  {tDynamic('Abrir calculadora')} <ArrowRight size={14} />
                </div>
              </Link>
            );
          })}
        </div>
        
        <div className="mt-10 text-center">
           <Link
             to="/ferramentas"
             className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"
           >
             {tDynamic('Ver todas as ferramentas')} <ArrowRight size={16} />
           </Link>
        </div>
      </div>
    </section>
  );
}
