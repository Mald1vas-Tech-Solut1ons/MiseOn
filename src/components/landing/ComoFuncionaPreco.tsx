import { useState } from 'react';
import { ArrowRight, Check, Landmark, ShieldCheck } from 'lucide-react';
import { EFI_TARIFAS, EFI_LINKS, SAAS_PRICING } from '../../lib/efiInfo';
import { zap } from './zap';

import { useI18n } from '../../contexts/I18nContext';
const PASSOS = [
  { numero: '1', titulo: 'Cadastre sua loja', texto: 'Nome, cardápio e identidade visual. Você mesmo faz em minutos, ou nosso time monta com você no WhatsApp.' },
  { numero: '2', titulo: 'Conecte o recebimento', texto: 'Abra uma conta Efí gratuita e cole 3 dados no painel. Pix e cartão passam a cair direto na sua conta.' },
  { numero: '3', titulo: 'Venda no balcão, na mesa e no delivery', texto: 'Cardápio no ar, KDS ligado, PDV e Salão 3D funcionando. Tudo no mesmo sistema, no mesmo dia.' },
];

const INCLUSO = [
  'Salão 3D Inteligente com Gestão de Assentos e Divisão de Conta',
  'Grafo 3D PEPS de Custeio de Estoque e Rastreabilidade de Lotes',
  'Cardápio digital white-label + QR Code por mesa',
  'KDS de cozinha com cronômetros de preparo',
  'PDV de balcão e gestão unificada de comandas',
  'Central de compras e fichas técnicas de rendimento',
  'Logística de entregas com rotas ao vivo',
  'Cupons, cashback e recuperação de carrinho',
  'Emissor NFC-e (Cupom Fiscal) incluso',
  'PWA instalável (vira app no celular do garçom)',
];

export function ComoFuncionaPreco() {
  const { tDynamic } = useI18n();
  const [anual, setAnual] = useState(true);

  const precoMensalStr = SAAS_PRICING.mensal.bruto.toFixed(2).replace('.', ',');
  const precoAnualStr = SAAS_PRICING.anual.mensalEquivalente.toFixed(2).replace('.', ',');
  const totalAnualStr = SAAS_PRICING.anual.totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const economiaAnoStr = (SAAS_PRICING.anual.economiaMensal * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <>
      {/* ── Como funciona ── */}
      <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)', background: 'rgba(10,92,196,0.03)' }} className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#FC5B24', textTransform: 'uppercase', marginBottom: 14 }}>
              Como funciona
            </div>
            <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {tDynamic('No ar hoje, sem técnico e sem obra')}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {PASSOS.map((p) => (
              <div key={p.numero} className="relative rounded-3xl border border-gray-800 bg-[#0B1120]/60 p-7">
                <div
                  style={{ fontFamily: "'Sora', sans-serif", background: 'linear-gradient(135deg, #FC5B24, #0A5CC4)' }}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-extrabold text-white"
                >
                  {p.numero}
                </div>
                <h3 style={{ fontFamily: "'Sora', sans-serif" }} className="mt-5 text-lg font-bold text-white">{p.titulo}</h3>
                <p style={{ color: 'rgba(234,241,251,0.55)' }} className="mt-2 text-sm leading-relaxed">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preço ── */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#FC5B24', textTransform: 'uppercase', marginBottom: 14 }}>
              {tDynamic('Preço Transparente')}
            </div>
            <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {tDynamic('Um preço fixo. Zero comissão por pedido.')}
            </h2>
            <p style={{ color: 'rgba(234,241,251,0.55)' }} className="mx-auto mt-4 max-w-2xl text-base">
              {tDynamic('Marketplace nenhum fica com percentual do seu faturamento. Aqui você escolhe a mensalidade e fica com 100% das suas vendas.')}
            </p>

            {/* Toggle Mensal / Anual */}
            <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-gray-800 bg-[#0B1120] p-1 shadow-2xl">
              <button
                onClick={() => setAnual(false)}
                style={{ fontFamily: "'Sora', sans-serif" }}
                className={`rounded-full px-6 py-2.5 text-xs sm:text-sm font-bold transition ${!anual ? 'bg-[#FC5B24] text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {tDynamic(`Mensal (R$ ${precoMensalStr}/mês)`)}
              </button>
              <button
                onClick={() => setAnual(true)}
                style={{ fontFamily: "'Sora', sans-serif" }}
                className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-xs sm:text-sm font-bold transition ${anual ? 'bg-[#0A5CC4] text-white shadow-[0_0_20px_rgba(10,92,196,0.5)]' : 'text-gray-400 hover:text-white'}`}
              >
                {tDynamic(`Anual (R$ ${precoAnualStr}/mês)`)} <span className={`rounded-full px-2 py-0.5 text-xs opacity-90 font-black ${anual ? 'bg-white text-[#0A5CC4]' : 'bg-blue-900/40 text-blue-400'}`}>-12% OFF</span>
              </button>
            </div>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
            {/* Card do plano */}
            <div
              style={{ border: '1px solid rgba(252,91,36,0.25)', background: 'rgba(10,92,196,0.06)', borderRadius: 32, position: 'relative', overflow: 'hidden' }}
              className="shadow-2xl"
            >
              <div style={{ height: 4, background: 'linear-gradient(90deg, #FC5B24, #0A5CC4)', position: 'absolute', top: 0, left: 0, right: 0 }} />
              <div className="p-8 sm:p-10">
                <p style={{ color: '#FC5B24', fontFamily: "'Sora', sans-serif" }} className="text-sm font-extrabold uppercase tracking-widest">
                  MiseOn Enterprise
                </p>
                <div style={{ fontFamily: "'Sora', sans-serif" }} className="mt-4 flex items-center text-6xl font-extrabold tracking-tight">
                  <span style={{ color: 'rgba(234,241,251,0.4)' }} className="mr-2 text-2xl">R$</span>
                  <span>{anual ? precoAnualStr : precoMensalStr}</span>
                  <span style={{ color: 'rgba(234,241,251,0.4)' }} className="text-xl font-medium">/mês</span>
                </div>
                <p style={{ color: 'rgba(234,241,251,0.4)' }} className="mt-3 text-sm">
                  {anual ? `Faturado em até 12x no cartão (R$ ${totalAnualStr}) ou Pix 5% OFF. Economia de R$ ${economiaAnoStr} por ano!` : 'Assinatura mensal sem fidelidade. Cancele quando quiser.'}
                </p>

                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {INCLUSO.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <Check size={16} style={{ color: '#FC5B24', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ color: 'rgba(234,241,251,0.75)' }}>{item}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="/cadastre-se"
                  style={{ background: '#FC5B24', fontFamily: "'Sora', sans-serif", boxShadow: '0 8px 24px rgba(252,91,36,0.4)' }}
                  className="mt-10 flex items-center justify-center gap-2 rounded-full py-4 text-center text-lg font-extrabold text-white transition hover:brightness-110 hover:scale-[1.02]"
                >
                  {tDynamic('Começar teste grátis')} <ArrowRight size={18} />
                </a>
                <p style={{ color: 'rgba(234,241,251,0.35)' }} className="mt-3 text-center text-xs">
                  {SAAS_PRICING.trialDias} dias grátis. Sem cartão de crédito.
                </p>
              </div>
            </div>

            {/* Transparência de recebimentos */}
            <div className="rounded-3xl border border-gray-800 bg-[#0B1120]/60 p-7 sm:p-8">
              <div className="mb-4 flex items-center gap-2">
                <Landmark size={16} style={{ color: '#FC5B24' }} />
                <span style={{ fontFamily: "'Sora', sans-serif", color: '#EAF1FB' }} className="text-sm font-extrabold">
                  {tDynamic('Recebimentos via Efí Bank, sem letra miúda')}
                </span>
              </div>
              <p style={{ color: '#AEB9CE' }} className="text-sm leading-relaxed">
                {tDynamic('Os pagamentos online são processados pelo')} <b style={{ color: '#EAF1FB' }}>Efí Bank</b> (instituição autorizada pelo Banco Central) e caem <b style={{ color: '#EAF1FB' }}>direto na conta da sua loja</b>. A MiseOn não segura o seu dinheiro e não fica com nada das suas vendas.
              </p>
              <div className="mt-5">
                {[
                  { forma: 'Pix (cai na hora)', taxa: EFI_TARIFAS.pix },
                  { forma: 'Crédito à vista', taxa: EFI_TARIFAS.creditoAVista },
                  { forma: 'Crédito 2–6x (prazo padrão)', taxa: EFI_TARIFAS.creditoParcelado2a6 },
                  { forma: 'Crédito 7–12x (prazo padrão)', taxa: EFI_TARIFAS.creditoParcelado7a12 },
                  { forma: 'Dinheiro / maquininha na entrega', taxa: 'R$ 0' },
                ].map((linha, i) => (
                  <div key={linha.forma} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,.07)' : 'none' }} className="flex items-center justify-between gap-3 py-3">
                    <span style={{ color: '#AEB9CE' }} className="text-sm">{linha.forma}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#EAF1FB', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }} className="shrink-0 rounded-full px-3 py-1 text-xs font-bold">
                      {linha.taxa}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ color: 'rgba(234,241,251,0.4)' }} className="mt-4 text-xs opacity-95 leading-relaxed">
                Tarifas públicas do Efí Bank ({EFI_TARIFAS.referencia}, negociáveis por volume). Confira em{' '}
                <a href={EFI_LINKS.tarifas} target="_blank" rel="noreferrer" className="underline transition hover:text-white">
                  sejaefi.com.br/tarifas
                </a>.
              </p>
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-gray-800 bg-black/20 p-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
                <p className="text-xs leading-relaxed text-gray-400">
                  {tDynamic('Zero conhecimento técnico: o painel tem um guia passo a passo e nosso time acompanha você pelo WhatsApp.')}
                </p>
              </div>
              <a
                href={zap('Olá! Quero entender como funcionam os recebimentos (Pix e cartão) no MiseOn.')}
                target="_blank"
                rel="noreferrer"
                style={{ border: '1px solid rgba(252,91,36,0.5)', color: '#FC5B24', fontFamily: "'Sora', sans-serif" }}
                className="mt-5 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition hover:bg-orange-500 hover:text-white"
              >
                {tDynamic('Tirar dúvidas sobre recebimentos')} <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
