import { useState } from 'react';
import { ArrowRight, Sparkles, CheckCircle2, ChevronRight, Layers, Cpu, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { KioskLeadModal } from '../landing/KioskLeadModal';
import { useI18n } from '../../contexts/I18nContext';

export function KioskHomeSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const { tDynamic } = useI18n();

  return (
    <section className="relative overflow-hidden py-16 sm:py-24 bg-[#070C18] border-y border-gray-800/80">
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-[#FC5B24]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-[140px] pointer-events-none" />

      {/* Marca d'água da marca, ao fundo.
          `mix-blend-screen` é o que dispensa editar o arquivo: sobre um fundo
          escuro o preto do PNG some e só o símbolo fica. Sem isso seria
          preciso um PNG com transparência, e o que existe no projeto
          (Mfavicon.png) tem fundo preto chapado.
          `aria-hidden` porque é decoração: anunciar "logo MiseOn" a cada
          seção só atrapalha quem usa leitor de tela. */}
      <img
        src="/Mfavicon.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 top-1/2 hidden w-[540px] -translate-y-1/2 select-none opacity-[0.07] mix-blend-screen lg:block"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        
        {/* Badge Institucional Superior */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FC5B24]/40 bg-[#FC5B24]/10 px-4 py-1.5 text-xs font-bold text-[#FC5B24] mb-3">
            <Sparkles size={14} /> NOVA VERTICAL COMERCIAL • MISEON KIOSK
          </div>
          <h2 className="font-['Sora'] text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight max-w-4xl">
            {tDynamic('Seu cliente pede sozinho.')} <br className="hidden sm:block" />
            <span className="text-[#FC5B24]">{tDynamic('Sua cozinha recebe.')}</span> {tDynamic('Seu negócio controla tudo.')}
          </h2>
          <p className="mt-3 font-['Sora'] text-base sm:text-xl font-bold text-amber-300">
            {tDynamic('Autoatendimento profissional ao seu alcance. É mais acessível do que parece!')}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl">
            {tDynamic('Estrutura profissional para restaurantes, lanchonetes e hamburguerias de alto fluxo.')}
          </p>
          <div className="mt-3 flex items-center justify-center gap-3 text-xs font-bold text-gray-400">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Cpu size={15} /> {tDynamic('Hardware Bravus Core 21" ("Tecnologia é o nosso core")')}
            </span>
            <span>+</span>
            <span className="flex items-center gap-1.5 text-orange-400">
              <Layers size={15} /> {tDynamic('Operação MiseOn OS')}
            </span>
          </div>
        </div>

        {/* Hero Product Display Card */}
        <div className="grid lg:grid-cols-12 gap-8 items-center rounded-3xl border border-gray-800 bg-gradient-to-br from-[#0B1120] via-[#090E1A] to-[#070C18] p-6 sm:p-10 shadow-2xl">
          
          {/* Lado Esquerdo: Mensagem e Recursos Conectados */}
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-1 text-xs font-bold text-gray-300">
              {tDynamic('SOLUÇÃO ENTERPRISE BRAVUS CORE + MISEON OS')}
            </div>

            <h3 className="font-['Sora'] text-2xl sm:text-3xl font-bold text-white leading-snug">
              {tDynamic('Não é apenas um totem.')} <br />
              <span className="text-gray-400 font-normal">{tDynamic('É uma nova estação de vendas para sua operação.')}</span>
            </h3>

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Transformamos a tela de autoatendimento em um ponto de venda inteligente conectado diretamente à cozinha (KDS), ao estoque PEPS, à ficha técnica e à DRE gerencial.
            </p>

            {/* Disclaimer Produto A Parte */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
              <ShieldCheck size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>{tDynamic('Produto B2B Independente:')}</strong> {tDynamic('Solução sob proposta comercial personalizada (Hardware Bravus Core + Licença Kiosk), não inclusa nos planos padrão de balcão.')}
              </span>
            </div>

            {/* Checklist da Estação Conectada */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
                <CheckCircle2 size={16} className="text-[#FC5B24]" /> {tDynamic('Pedidos & Pagamentos')}
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
                <CheckCircle2 size={16} className="text-[#FC5B24]" /> {tDynamic('Conectado ao KDS')}
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
                <CheckCircle2 size={16} className="text-[#FC5B24]" /> {tDynamic('Baixa de Estoque PEPS')}
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
                <CheckCircle2 size={16} className="text-[#FC5B24]" /> {tDynamic('DRE e Financeiro Real')}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-3">
              <button type="button"
                onClick={() => setModalOpen(true)}
                className="rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-7 py-3.5 font-['Sora'] text-sm font-bold text-white shadow-xl shadow-[#FC5B24]/25 hover:brightness-110 hover:scale-105 transition flex items-center justify-center gap-2"
              >
                <span>{tDynamic('Não perca tempo — Fale com a MiseOn')}</span>
                <ArrowRight size={18} />
              </button>

              <Link
                to="/autoatendimento"
                className="rounded-full border border-gray-700 bg-white/5 px-6 py-3.5 font-['Sora'] text-sm font-bold text-white hover:bg-white/10 transition flex items-center justify-center gap-2"
              >
                <span>{tDynamic('Ver como funciona')}</span>
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>

          {/* Lado Direito: Apresentação Visual do Totem Bravus */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="relative group w-full max-w-xl xl:max-w-2xl">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#FC5B24]/30 to-blue-600/30 blur-xl opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-[#0B1120] shadow-2xl">
                {/* O totem em USO, não o totem parado.
                    Foto de hardware mostra um móvel; o que vende
                    autoatendimento é a cena — a pessoa chega, escolhe, paga e
                    sai, sem fila no caixa e sem ninguém anotando.

                    `muted` + `playsInline` são obrigatórios para o autoplay
                    não ser bloqueado em iOS e Chrome, e o `poster` é o que
                    aparece enquanto carrega (ou fica, se o aparelho bloquear).
                    Servido do Storage: 790 KB não têm por que entrar no bundle
                    e atrasar o deploy de todo mundo. */}
                <video
                  src="https://zzuxklwhaoisuuvndtfw.supabase.co/storage/v1/object/public/loja-assets/marketing/totem-miseon.mp4"
                  poster="https://zzuxklwhaoisuuvndtfw.supabase.co/storage/v1/object/public/loja-assets/marketing/totem-poster.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label="Cliente fazendo o próprio pedido no totem de autoatendimento MiseOn e pagando na tela"
                  className="w-full h-auto object-cover transition transform group-hover:scale-105 duration-500"
                />
                
                {/* Faixa de integração — ABAIXO do vídeo, não por cima.
                    Ela nasceu sobreposta porque cobria uma FOTO vertical do
                    totem, onde a parte de baixo era só o pedestal. O vídeo é
                    2:1, e ali embaixo estão a cliente e o leitor de cartão —
                    justamente a cena que vende. Sobreposta, a tarja comia
                    metade do que havia para ver. */}
                <div className="flex items-center justify-between gap-3 border-t border-gray-700/80 bg-[#070C18] px-3.5 py-2.5">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-gray-400">HARDWARE HOMOLOGADO</span>
                    <span className="text-xs font-bold text-white">Totem Bravus Core 21"</span>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-[10px] font-extrabold text-emerald-400">
                    KDS CONECTADO
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Lead do Kiosk */}
      <KioskLeadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Solicitar Proposta do MiseOn Kiosk"
        subtitle="Transforme seu balcão em uma estação de vendas. Preencha seus dados para receber um orçamento comercial B2B."
        origem="kiosk_home_section"
      />
    </section>
  );
}
