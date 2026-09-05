import { useState, FormEvent } from 'react';
import { ArrowRight, MessageCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, SuccessCelebration } from '../ui';
import { zap } from './zap';
import { useI18n } from '../../contexts/I18nContext';

const SEGMENTOS = [
  { valor: 'hamburgueria', rotulo: 'Hamburgueria' },
  { valor: 'lanchonete', rotulo: 'Lanchonete / Fast Food' },
  { valor: 'restaurante', rotulo: 'Restaurante / Bar' },
  { valor: 'pizzaria', rotulo: 'Pizzaria' },
  { valor: 'cafeteria', rotulo: 'Cafeteria / Padaria' },
  { valor: 'food_hall', rotulo: 'Food Hall / Praça de Alimentação' },
  { valor: 'rede_franquia', rotulo: 'Rede / Franquia' },
  { valor: 'outro', rotulo: 'Outro' },
] as const;

const UNIDADES_OPCOES = [
  { valor: '1', rotulo: '1 unidade' },
  { valor: '2_5', rotulo: '2 a 5 unidades' },
  { valor: '6_10', rotulo: '6 a 10 unidades' },
  { valor: '10_mais', rotulo: 'Mais de 10 unidades' },
] as const;

const INTERESSE_OPCOES = [
  { valor: 'totem_completo', rotulo: 'Solução Completa (Hardware Bravus + Software MiseOn)' },
  { valor: 'software_apenas', rotulo: 'Já tenho o totem, preciso apenas do Software' },
  { valor: 'consultoria', rotulo: 'Quero avaliar a viabilidade para minha operação' },
] as const;

const inputCls =
  'w-full rounded-xl border border-gray-700/60 bg-[#070C18]/90 p-3.5 text-sm text-white placeholder:text-gray-400 outline-none transition focus:border-[#FC5B24] focus:ring-1 focus:ring-[#FC5B24] dark:bg-[#0B1120]';

export interface KioskLeadFormProps {
  compact?: boolean;
  origem?: string;
  defaultPedidosDia?: number;
  onSuccess?: () => void;
}

export function KioskLeadForm({
  compact = false,
  origem = 'kiosk_landing',
  defaultPedidosDia,
  onSuccess,
}: KioskLeadFormProps) {
  const { tDynamic } = useI18n();
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [segmento, setSegmento] = useState('');
  const [cidade, setCidade] = useState('');
  const [unidades, setUnidades] = useState('1');
  const [pedidosDia, setPedidosDia] = useState(defaultPedidosDia ? String(defaultPedidosDia) : '');
  const [interesse, setInteresse] = useState('totem_completo');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!nome.trim() || !whatsapp.trim()) return setErro('Preencha seu nome e seu WhatsApp.');
    if (!segmento) return setErro('Selecione o segmento do seu negócio.');

    setEnviando(true);
    try {
      const mensagemDetalhada = `[MiseOn Kiosk Lead] Empresa: ${empresa.trim() || 'Não informada'} | Unidades: ${unidades} | Pedidos/dia: ${pedidosDia || 'Não informado'} | Interesse: ${interesse}`;

      const { error } = await supabase.from('leads').insert({
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim() || null,
        segmento,
        cidade: cidade.trim() || null,
        mensagem: mensagemDetalhada,
        origem,
      });

      setEnviando(false);

      if (error) {
        // Se houver erro de Supabase, ainda oferece fallback pro WhatsApp
        console.warn('Erro ao inserir lead:', error);
      }

      setEnviado(true);

      // Trigger analytics event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'kiosk_lead_submit', {
          event_category: 'Kiosk',
          event_label: origem,
          segmento,
        });
      }

      if (onSuccess) onSuccess();
    } catch {
      setEnviando(false);
      setEnviado(true);
    }
  };

  if (enviado) {
    return (
      <SuccessCelebration
        titulo="Solicitação Recebida!"
        subtitulo={`Obrigado, ${nome.trim()}! Nossa equipe de especialistas do MiseOn Kiosk entrará em contato pelo WhatsApp ${whatsapp} em instantes para apresentar o projeto comercial.`}
      >
        <div className="flex flex-col items-center gap-3 pt-2">
          <a
            href={zap(
              `Olá! Acabei de solicitar uma demonstração do MiseOn Kiosk no site (Empresa: ${empresa.trim() || nome.trim()}, Cidade: ${cidade || 'SP'}). Quero adiantar a apresentação comercial.`
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
          >
            <MessageCircle size={18} /> {tDynamic('Falar direto com Especialista no WhatsApp')}
          </a>
          <p className="text-xs text-gray-400">Atendimento prioritário para operações de alimentação.</p>
        </div>
      </SuccessCelebration>
    );
  }

  return (
    <form onSubmit={enviar} className={compact ? 'space-y-3' : 'grid gap-4 sm:grid-cols-2'}>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Seu Nome*</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Roberto Silva"
          className={inputCls}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">WhatsApp (com DDD)*</label>
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="(11) 99999-9999"
          className={inputCls}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Nome do seu Estabelecimento</label>
        <input
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          placeholder="Ex: Smash Burger & Co."
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Cidade / Estado</label>
        <input
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          placeholder="Ex: São Paulo / SP"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Tipo de Negócio*</label>
        <select
          value={segmento}
          onChange={(e) => setSegmento(e.target.value)}
          className={`${inputCls} ${segmento ? 'text-white' : 'text-gray-400'}`}
          required
        >
          <option value="">Selecione o segmento...</option>
          {SEGMENTOS.map((s) => (
            <option key={s.valor} value={s.valor} className="bg-[#0B1120] text-white">
              {s.rotulo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Quantidade de Unidades</label>
        <select
          value={unidades}
          onChange={(e) => setUnidades(e.target.value)}
          className={`${inputCls} text-white`}
        >
          {UNIDADES_OPCOES.map((u) => (
            <option key={u.valor} value={u.valor} className="bg-[#0B1120] text-white">
              {u.rotulo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Média de Pedidos/Dia (Aproximado)</label>
        <input
          value={pedidosDia}
          onChange={(e) => setPedidosDia(e.target.value)}
          type="number"
          placeholder="Ex: 150"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">E-mail Corporativo</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="contato@seunegocio.com.br"
          className={inputCls}
        />
      </div>

      <div className={compact ? '' : 'sm:col-span-2'}>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Interesse Principal</label>
        <select
          value={interesse}
          onChange={(e) => setInteresse(e.target.value)}
          className={`${inputCls} text-white`}
        >
          {INTERESSE_OPCOES.map((o) => (
            <option key={o.valor} value={o.valor} className="bg-[#0B1120] text-white">
              {o.rotulo}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <p className={`text-sm font-medium text-red-400 ${compact ? '' : 'sm:col-span-2'}`}>{erro}</p>
      )}

      <div className={compact ? '' : 'sm:col-span-2'}>
        <Button
          type="submit"
          size="lg"
          carregando={enviando}
          icone={<ArrowRight size={18} />}
          className="w-full justify-center bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] font-bold text-white shadow-xl shadow-[#FC5B24]/20 hover:brightness-110"
        >
          {enviando ? 'Enviando solicitação...' : 'Não perca tempo — Fale com a MiseOn'}
        </Button>
        
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" /> Atendimento direto B2B
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 size={14} className="text-emerald-400" /> Sem compromisso
          </span>
        </div>
      </div>
    </form>
  );
}
