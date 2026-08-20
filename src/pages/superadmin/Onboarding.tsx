import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LeadCadastro } from '../../types';

import { useI18n } from '../../contexts/I18nContext';
const DIACRITICOS = new RegExp(String.fromCharCode(0x5b, 0x5c, 0x75, 0x30, 0x33, 0x30, 0x30, 0x2d, 0x5c, 0x75, 0x30, 0x33, 0x36, 0x66, 0x5d), 'g');
const gerarSlug = (nome: string) => nome
  .normalize('NFD')
  .replace(DIACRITICOS, '')
  .toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const STATUS_COR: Record<string, string> = {
  novo: 'bg-amber-100 text-amber-700',
  contatado: 'bg-blue-100 text-blue-700',
  convertido: 'bg-green-100 text-green-700',
  descartado: 'bg-gray-100 text-gray-500 dark:text-gray-400',
};

export default function Onboarding() {
  const { tDynamic } = useI18n();
  const [slug, setSlug] = useState('');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [emailDono, setEmailDono] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [leads, setLeads] = useState<LeadCadastro[]>([]);

  const carregarLeads = async () => {
    const { data } = await supabase.from('leads_cadastro').select('*').order('criado_em', { ascending: false });
    setLeads((data as LeadCadastro[]) ?? []);
  };
  useEffect(() => { setTimeout(carregarLeads, 0); }, []);

  const usarLead = (l: LeadCadastro) => {
    setNome(l.nome_loja);
    setSlug(gerarSlug(l.nome_loja));
    setWhatsapp(l.whatsapp.replace(/\D/g, ''));
    setEmailDono(l.email ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const mudarStatusLead = async (l: LeadCadastro, status: LeadCadastro['status']) => {
    await supabase.from('leads_cadastro').update({ status }).eq('id', l.id);
    carregarLeads();
  };

  const criar = async () => {
    setErro(''); setMsg('');
    if (!slug || !nome || !whatsapp || !emailDono) return setErro('Preencha todos os campos.');
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke('superadmin-criar-loja', {
      body: { slug, nome, whatsapp, email_dono: emailDono },
    });
    setEnviando(false);
    if (error || data?.error) return setErro(data?.error ?? error?.message ?? 'Erro ao criar loja.');
    setMsg(`Loja "${data.slug}" criada! Convite enviado para ${emailDono}.`);
    setSlug(''); setNome(''); setWhatsapp(''); setEmailDono('');
    carregarLeads();
  };

  const leadsAbertos = leads.filter((l) => l.status === 'novo' || l.status === 'contatado');

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">{tDynamic('Onboarding de nova loja')}</h2>

      {leadsAbertos.length > 0 && (
        <div className="mb-5 max-w-md">
          <p className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Cadastros recebidos em /cadastre-se ({leadsAbertos.length})</p>
          <div className="space-y-2">
            {leadsAbertos.map((l) => (
              <div key={l.id} className="rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{l.nome_loja}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COR[l.status]}`}>{l.status}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {l.nome_responsavel} - {l.whatsapp}{l.email ? ` - ${l.email}` : ''}
                  {l.tipo_negocio ? ` - ${l.tipo_negocio}` : ''}{l.cidade ? ` - ${l.cidade}` : ''}
                </p>
                {l.observacao && <p className="mt-0.5 text-xs italic text-gray-400">"{l.observacao}"</p>}
                <div className="mt-2 flex gap-2">
                  <button onClick={() => usarLead(l)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-900 py-1.5 text-xs font-semibold text-white">
                    Usar esses dados <ArrowRight size={12} />
                  </button>
                  {l.status === 'novo' && (
                    <button onClick={() => mudarStatusLead(l, 'contatado')} className="rounded-lg border px-3 text-xs font-medium">Contatado</button>
                  )}
                  <button onClick={() => mudarStatusLead(l, 'descartado')} className="rounded-lg border border-red-200 px-3 text-xs font-medium text-red-500">Descartar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-md space-y-2 rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da loja" className="w-full rounded-xl border p-2.5 text-sm" />
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug (ex: burger-do-ze)" className="w-full rounded-xl border p-2.5 text-sm" />
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (5511999999999)" className="w-full rounded-xl border p-2.5 text-sm" />
        <input value={emailDono} onChange={(e) => setEmailDono(e.target.value)} placeholder="E-mail do dono da loja" className="w-full rounded-xl border p-2.5 text-sm" />
        {erro && <p className="text-sm font-medium text-red-500">{erro}</p>}
        {msg && <p className="text-sm font-medium text-green-600">{msg}</p>}
        <button onClick={criar} disabled={enviando}
          className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white disabled:opacity-40">
          {enviando ? 'Criando…' : 'Criar loja e convidar dono'}
        </button>
      </div>
    </div>
  );
}
