import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, CheckCircle2, Mail, MapPin, MessageCircle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SEO } from '../../components/SEO';
import FooterSEO from '../../components/FooterSEO';
import MiseOnLogo from '../../components/MiseOnLogo';
import { useI18n } from '../../contexts/I18nContext';

export default function Contato() {
  const { tDynamic } = useI18n();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !whatsapp.trim()) {
      setErro(tDynamic('Por favor, preencha seu nome e WhatsApp.'));
      return;
    }

    setEnviando(true);
    setErro('');

    try {
      const { error } = await supabase.from('leads').insert({
        nome_responsavel: nome.trim(),
        nome_loja: 'Contato via Site',
        whatsapp: whatsapp.trim(),
        email: email.trim() || null,
        observacao: mensagem.trim() || 'Contato comercial/suporte enviado via formulário do site.',
        status: 'novo',
      });

      if (error) {
        setErro('Ocorreu um erro ao enviar a mensagem. Tente pelo WhatsApp.');
      } else {
        setSucesso(true);
        setNome('');
        setEmail('');
        setWhatsapp('');
        setMensagem('');
      }
    } catch {
      setErro('Ocorreu um erro temporário de conexão.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070C18] font-sans text-slate-200 selection:bg-orange-500 selection:text-white">
      <SEO
        title="Contato & Suporte | MiseOn — Sistema para Restaurantes"
        description="Fale com a equipe do MiseOn. Canais oficiais de atendimento comercial e suporte técnico via WhatsApp, e-mail e formulário. CNPJ 63.310.253/0001-81."
        keywords="contato miseon, suporte miseon, whatsapp miseon, endereco miseon, cnpj miseon"
        canonicalUrl="https://miseon.app.br/contato"
        schemaJson={{
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          'name': 'Contato & Suporte MiseOn',
          'description': 'Página oficial de contato do sistema MiseOn.',
          'url': 'https://miseon.app.br/contato',
          'mainEntity': {
            '@type': 'Organization',
            'name': 'MiseOn Tecnologia e Soluções para Food Service',
            'taxID': '63.310.253/0001-81',
            'email': 'contato@miseon.app.br',
            'telephone': '+55-11-91988-9233',
            'address': {
              '@type': 'PostalAddress',
              'addressLocality': 'Manaus',
              'addressRegion': 'AM',
              'addressCountry': 'BR'
            }
          }
        }}
      />

      {/* Header com Navegação */}
      <header className="border-b border-white/10 bg-[#0B1120]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" aria-label="Voltar para o início">
            <MiseOnLogo size={130} />
          </Link>

          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> {tDynamic('Voltar ao Início')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400">
            <MessageCircle size={14} /> {tDynamic('Atendimento Direto')}
          </span>

          <h1 className="mt-4 font-['Sora'] text-3xl font-extrabold text-white sm:text-5xl">
            {tDynamic('Fale com a nossa equipe')}
          </h1>
          <p className="mt-4 text-base text-slate-300">
            {tDynamic('Estamos prontos para atender você. Tire suas dúvidas sobre planos, integrações ou solicite suporte para a sua loja.')}
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          
          {/* Form de Mensagem */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-md">
            <h2 className="font-['Sora'] text-xl font-bold text-white mb-2">{tDynamic('Envie uma Mensagem')}</h2>
            <p className="text-xs text-slate-400 mb-6">{tDynamic('Preencha o formulário abaixo e retornaremos em breve.')}</p>

            {sucesso && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 p-4 text-emerald-300 text-xs font-bold">
                <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
                <span>{tDynamic('Mensagem enviada com sucesso! Nossa equipe entrará em contato em breve pelo seu WhatsApp.')}</span>
              </div>
            )}

            {erro && (
              <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/15 p-4 text-red-300 text-xs font-bold">
                {erro}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{tDynamic('Seu Nome / Responsável *')}</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{tDynamic('WhatsApp com DDD *')}</label>
                  <input
                    type="tel"
                    required
                    placeholder="(11) 99999-9999"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{tDynamic('E-mail (opcional)')}</label>
                  <input
                    type="email"
                    placeholder="seuemail@loja.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{tDynamic('Sua Mensagem / Dúvida')}</label>
                <textarea
                  rows={4}
                  placeholder={tDynamic('Como podemos ajudar o seu estabelecimento?')}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                type="submit"
                disabled={enviando}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
              >
                <Send size={16} /> {enviando ? tDynamic('Enviando mensagem...') : tDynamic('Enviar Mensagem')}
              </button>
            </form>
          </div>

          {/* Cards de Contato & Informações da Empresa */}
          <div className="space-y-6">
            
            {/* Card WhatsApp */}
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/20 p-3 text-emerald-400">
                  <MessageCircle size={24} />
                </div>
                <div>
                  <h3 className="font-['Sora'] text-base font-bold text-white">{tDynamic('Atendimento via WhatsApp')}</h3>
                  <p className="text-xs text-emerald-300 mt-0.5">{tDynamic('Resposta rápida em horário comercial')}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-300 leading-relaxed">
                {tDynamic('Fale diretamente com nossa equipe comercial e suporte pelo WhatsApp.')}
              </p>
              <div className="mt-4">
                <a
                  href="https://wa.me/5511919889233?text=Olá!%20Gostaria%20de%20saber%20mais%20sobre%20o%20MiseOn."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 transition"
                >
                  <MessageCircle size={16} /> {tDynamic('Iniciar Conversa no WhatsApp')}
                </a>
              </div>
            </div>

            {/* Card E-mails */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-500/20 p-3 text-blue-400">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="font-['Sora'] text-base font-bold text-white">{tDynamic('Canais de E-mail')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{tDynamic('Canais diretos para solicitações formais')}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <strong className="text-white">{tDynamic('Comercial & Parcerias:')}</strong>
                  <a href="mailto:contato@miseon.app.br" className="text-blue-400 hover:underline">contato@miseon.app.br</a>
                </div>
                <div className="flex items-center gap-2">
                  <strong className="text-white">{tDynamic('Suporte Técnico:')}</strong>
                  <a href="mailto:suporte@miseon.app.br" className="text-blue-400 hover:underline">suporte@miseon.app.br</a>
                </div>
              </div>
            </div>

            {/* Card Empresa / CNPJ */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md space-y-3">
              <div className="flex items-center gap-3">
                <Building2 size={20} className="text-orange-400" />
                <h3 className="font-['Sora'] text-sm font-bold text-white">{tDynamic('Dados Jurídicos da Empresa')}</h3>
              </div>

              <div className="text-xs text-slate-300 space-y-1 font-mono">
                <p><strong>{tDynamic('Razão Social:')}</strong> MiseOn Tecnologia e Soluções para Food Service</p>
                <p><strong>CNPJ:</strong> 63.310.253/0001-81</p>
                <p className="flex items-center gap-1 font-sans text-slate-400 mt-2">
                  <MapPin size={14} className="text-orange-400" /> Manaus / AM — Brasil
                </p>
              </div>
            </div>

          </div>

        </div>
      </main>

      <FooterSEO />
    </div>
  );
}
