import { QrCode, CreditCard, ShieldCheck, Landmark, ArrowRight } from 'lucide-react';
import { EFI_TARIFAS, EFI_LINKS } from '../../lib/efiInfo';
import { RotuloSecao } from './shared';
import { zap } from '../../constants/homeShared';

import { useI18n } from '../../contexts/I18nContext';
export function PagamentosSection() {
  const { tDynamic } = useI18n();
  return (
    <section id="pagamentos" style={{ borderTop: '1px solid rgba(10,92,196,0.15)' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <RotuloSecao numero="07" texto="Pagamentos transparentes" />
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold leading-tight sm:text-4xl">
              {tDynamic('Seu dinheiro cai direto')}<br />na <span style={{ color: '#FC5B24' }}>sua conta</span>. Não na nossa.
            </h2>
            <p style={{ color: '#AEB9CE' }} className="mt-5 max-w-xl text-base leading-relaxed">
              {tDynamic('Os pagamentos online são processados pelo')} <b style={{ color: '#EAF1FB' }}>Efí Bank</b>, instituição
              autorizada pelo Banco Central — e repassados <b style={{ color: '#EAF1FB' }}>automaticamente</b> para a
              conta da sua loja. O MiseOn não segura o seu dinheiro e não cobra comissão por venda: você paga só a
              mensalidade fixa.
            </p>

            <div className="mt-8 space-y-4">
              {[
                { icon: <QrCode size={18} />, cor: '#34D399', titulo: 'Pix cai na hora', texto: `Cliente pagou, dinheiro na sua conta Efí no mesmo segundo. Tarifa do banco: ${EFI_TARIFAS.pix} por venda.` },
                { icon: <CreditCard size={18} />, cor: '#6B9EFF', titulo: 'Cartão de crédito no seu ritmo', texto: `Escolha no painel: receber parcela a parcela (a partir de ${EFI_TARIFAS.creditoAVista} à vista) ou tudo antecipado em ~2 dias úteis.` },
                { icon: <ShieldCheck size={18} />, cor: '#FC5B24', titulo: 'Zero conhecimento técnico', texto: 'Você abre uma conta Efí gratuita e cola 3 dados simples no painel. O sistema tem um guia passo a passo — e nosso time acompanha você no WhatsApp.' },
              ].map((item) => (
                <div key={item.titulo} className="flex items-start gap-4">
                  <div style={{ background: `${item.cor}1f`, color: item.cor, border: `1px solid ${item.cor}40` }} className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    {item.icon}
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Sora', sans-serif", color: '#EAF1FB' }} className="font-bold">{item.titulo}</p>
                    <p style={{ color: '#AEB9CE' }} className="mt-1 text-sm leading-relaxed">{item.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,.09)', background: 'rgba(10,92,196,0.05)', borderRadius: 24 }} className="p-6 sm:p-7">
            <div className="mb-4 flex items-center gap-2">
              <Landmark size={16} style={{ color: '#FC5B24' }} />
              <span style={{ fontFamily: "'Sora', sans-serif", color: '#EAF1FB' }} className="text-sm font-extrabold">{tDynamic('Taxas do Efí Bank, sem letra miúda')}</span>
            </div>
            <div className="space-y-0">
              {[
                { forma: 'Pix (cai na hora)', taxa: EFI_TARIFAS.pix },
                { forma: 'Crédito à vista', taxa: EFI_TARIFAS.creditoAVista },
                { forma: 'Crédito 2–6x (prazo padrão)', taxa: EFI_TARIFAS.creditoParcelado2a6 },
                { forma: 'Crédito 7–12x (prazo padrão)', taxa: EFI_TARIFAS.creditoParcelado7a12 },
                { forma: 'Antecipação (tudo em ~2 dias úteis)', taxa: `${EFI_TARIFAS.creditoAVista} + ${EFI_TARIFAS.antecipacaoPorParcela}/parcela` },
                { forma: 'Dinheiro / maquininha na entrega', taxa: 'R$ 0' },
              ].map((linha, i) => (
                <div key={linha.forma} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,.07)' : 'none' }} className="flex items-center justify-between gap-3 py-3">
                  <span style={{ color: '#AEB9CE' }} className="text-sm">{linha.forma}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#EAF1FB', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }} className="shrink-0 rounded-full px-3 py-1 text-xs font-bold">{linha.taxa}</span>
                </div>
              ))}
            </div>
            <p style={{ color: 'rgba(234,241,251,0.4)' }} className="mt-4 text-xs opacity-95 leading-relaxed">
              Taxas cobradas pelo Efí Bank (tabela pública de {EFI_TARIFAS.referencia}, negociável por volume) — o MiseOn
              não fica com nada das suas vendas. Confira em{' '}
              <a href={EFI_LINKS.tarifas} target="_blank" rel="noreferrer" className="underline transition hover:text-white">sejaefi.com.br/tarifas</a>.
            </p>
            <a
              href={zap('Olá! Quero entender como funcionam os recebimentos (Pix e cartão) no MiseOn.')}
              style={{ border: '1px solid rgba(252,91,36,0.5)', color: '#FC5B24', fontFamily: "'Sora', sans-serif" }}
              className="mt-5 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition hover:bg-orange-500 hover:text-white"
            >
              {tDynamic('Tirar dúvidas sobre recebimentos')} <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
