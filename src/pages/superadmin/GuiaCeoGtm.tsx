import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
export default function GuiaCeoGtm() {
  const { tDynamic } = useI18n();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-['Sora'] text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="text-[#FC5B24]" size={26} />
            {tDynamic('Bíblia de Vendas & Guia do CEO — Primeiros 10 Clientes SaaS')}
          </h1>
          <p className="text-xs text-gray-400">
            {tDynamic('Estratégia completa de Go-To-Market, abordagem PAP, tráfego pago e quebra de objeções para fechar os primeiros R$ 1.500/mês no MiseOn.')}
          </p>
        </div>

        <a
          href="/guia-ceo-gtm.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-[#FC5B24] px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-[#E34A1B]"
        >
          <ExternalLink size={16} /> {tDynamic('Abrir Versão em Tela Cheia (HTML)')}
        </a>
      </div>

      {/* Frame que carrega a versão HTML isolada */}
      <div className="rounded-3xl border border-white/10 overflow-hidden shadow-2xl h-[750px] bg-[#070C18]">
        <iframe
          src="/guia-ceo-gtm.html"
          title="Guia do CEO e Bíblia GTM"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
