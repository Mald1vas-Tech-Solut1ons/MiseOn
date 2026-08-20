import { useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, SuccessCelebration } from '../ui';
import { zap } from './zap';

import { useI18n } from '../../contexts/I18nContext';
const SEGMENTOS = [
  { valor: 'lanchonete', rotulo: 'Lanchonete' },
  { valor: 'hamburgueria', rotulo: 'Hamburgueria' },
  { valor: 'restaurante', rotulo: 'Restaurante' },
  { valor: 'pizzaria', rotulo: 'Pizzaria' },
  { valor: 'cozinha_industrial', rotulo: 'Cozinha industrial' },
  { valor: 'outro', rotulo: 'Outro' },
] as const;

const inputCls =
  'w-full rounded-xl border border-gray-800 bg-[#0B1120]/70 p-3 text-sm text-white placeholder:text-gray-500 outline-none transition focus:border-[var(--cor-secundaria)]';

/**
 * Formulário de captação de leads da landing pública.
 * Grava em public.leads (INSERT público liberado pela migration 20260719120000_leads).
 */
export function LeadForm({ compact = false, origem = 'landing' }: { compact?: boolean; origem?: string }) {
  const { tDynamic } = useI18n();
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [segmento, setSegmento] = useState('');
  const [cidade, setCidade] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!nome.trim() || !whatsapp.trim()) return setErro('Preencha seu nome e seu WhatsApp.');
    if (!segmento) return setErro('Selecione o segmento do seu negócio.');

    setEnviando(true);
    const { error } = await supabase.from('leads').insert({
      nome: nome.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim() || null,
      segmento,
      cidade: cidade.trim() || null,
      mensagem: mensagem.trim() || null,
      origem,
    });
    setEnviando(false);

    if (error) {
      return setErro('Não conseguimos enviar agora. Tente de novo em instantes ou chame a gente no WhatsApp.');
    }
    setEnviado(true);
  };

  if (enviado) {
    return (
      <SuccessCelebration
        titulo="Recebemos seu contato!"
        subtitulo={`Vamos te chamar no WhatsApp ${whatsapp} para agendar sua demonstração.`}
      >
        <a
          href={zap(`Olá! Acabei de deixar meu contato no site da MiseOn (nome: ${nome.trim()}) e quero adiantar a conversa.`)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/60 px-5 py-2.5 text-sm font-bold text-emerald-400 transition hover:bg-emerald-500/10"
        >
          <MessageCircle size={16} /> {tDynamic('Falar agora no WhatsApp')}
        </a>
      </SuccessCelebration>
    );
  }

  return (
    <form onSubmit={enviar} className={compact ? 'space-y-3' : 'grid gap-3 sm:grid-cols-2'}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome*" className={inputCls} />
      <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (11) 9…*" className={inputCls} />
      <select value={segmento} onChange={(e) => setSegmento(e.target.value)} className={`${inputCls} ${segmento ? '' : 'text-gray-500'}`}>
        <option value="">{tDynamic('Segmento do negócio*')}</option>
        {SEGMENTOS.map((s) => (
          <option key={s.valor} value={s.valor} className="text-white">{s.rotulo}</option>
        ))}
      </select>
      <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" className={inputCls} />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        placeholder="E-mail (opcional)"
        className={`${inputCls} ${compact ? '' : 'sm:col-span-2'}`}
      />
      {!compact && (
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Conte um pouco da sua operação (opcional)"
          rows={3}
          className={`${inputCls} sm:col-span-2`}
        />
      )}

      {erro && <p className={`text-sm font-medium text-red-400 ${compact ? '' : 'sm:col-span-2'}`}>{erro}</p>}

      <div className={compact ? '' : 'sm:col-span-2'}>
        <Button type="submit" size="lg" carregando={enviando} icone={<ArrowRight size={18} />} className="w-full">
          {enviando ? 'Enviando…' : 'Quero uma demonstração'}
        </Button>
        <p className="mt-2 text-center text-xs text-gray-500">
          {tDynamic('Sem compromisso. Seus dados só serão usados para o nosso contato comercial.')}
        </p>
      </div>
    </form>
  );
}
