import React, { useState } from 'react';
import { Users, Search, Plus, CheckCircle2, Send } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
export interface LeadB2B {
  id: string;
  nomeLoja: string;
  nomeContato: string;
  telefone: string;
  email: string;
  segmento: string;
  origem: string;
  etapa: 'NOVO' | 'EM_CONTATO' | 'DEMO_TRIAL' | 'FECHAMENTO' | 'ASSINANTE' | 'PERDIDO';
  criadoEm: string;
  mrrEstimado: number;
  observacoes?: string;
}

const LEADS_INICIAIS: LeadB2B[] = [
  { id: '1', nomeLoja: 'Burger & Co. Paulista', nomeContato: 'Rafael Souza', telefone: '11988887777', email: 'rafael@burgerco.com.br', segmento: 'Hamburgueria', origem: 'Landing Page Hamburgueria', etapa: 'DEMO_TRIAL', criadoEm: '2026-07-28', mrrEstimado: 99.90, observacoes: 'Testando KDS na chapa e custeio de preparos.' },
  { id: '2', nomeLoja: 'Pizzaria Bella Napoli', nomeContato: 'Giovanni Rossi', telefone: '11977776666', email: 'contato@bellanapoli.com.br', segmento: 'Pizzaria', origem: 'Anúncio Meta Ads', etapa: 'NOVO', criadoEm: '2026-07-28', mrrEstimado: 149.90, observacoes: 'Interessado em comanda eletrônica de forno.' },
  { id: '3', nomeLoja: 'Restaurante Sabor no Quilo', nomeContato: 'Dona Maria', telefone: '11966665555', email: 'maria@sabornoquilo.com.br', segmento: 'Restaurante por Quilo', origem: 'Indicação / Google Search', etapa: 'EM_CONTATO', criadoEm: '2026-07-27', mrrEstimado: 99.90, observacoes: 'Quer integrar a balança Toledo de quilo.' },
  { id: '4', nomeLoja: 'Espetinho do Chefe', nomeContato: 'Marcos Viana', telefone: '11955554444', email: 'marcos@espetinho.com.br', segmento: 'Lanchonete / Bar', origem: 'Organic Search', etapa: 'ASSINANTE', criadoEm: '2026-07-20', mrrEstimado: 99.90, observacoes: 'Assinante ativo no plano mensal Efí Pix.' },
];

export default function CrmLeads() {
  const { tDynamic } = useI18n();
  const [leads, setLeads] = useState<LeadB2B[]>(LEADS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [etapaFiltro, setEtapaFiltro] = useState<string>('TODAS');
  const [modalNovoLead, setModalNovoLead] = useState(false);
  const [novoLead, setNovoLead] = useState({ nomeLoja: '', nomeContato: '', telefone: '', email: '', segmento: 'Hamburgueria', mrrEstimado: '99.90' });
  const [mensagemStatus, setMensagemStatus] = useState<string | null>(null);

  const leadsFiltrados = leads.filter((l) => {
    const bateBusca = l.nomeLoja.toLowerCase().includes(busca.toLowerCase()) || l.nomeContato.toLowerCase().includes(busca.toLowerCase()) || l.telefone.includes(busca);
    const bateEtapa = etapaFiltro === 'TODAS' || l.etapa === etapaFiltro;
    return bateBusca && bateEtapa;
  });

  const mrrTotalEstimado = leads.filter((l) => l.etapa === 'ASSINANTE' || l.etapa === 'FECHAMENTO' || l.etapa === 'DEMO_TRIAL').reduce((acc, l) => acc + l.mrrEstimado, 0);
  const totalAssinantes = leads.filter((l) => l.etapa === 'ASSINANTE').length;
  const totalTrials = leads.filter((l) => l.etapa === 'DEMO_TRIAL').length;

  const moverEtapa = (id: string, novaEtapa: LeadB2B['etapa']) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, etapa: novaEtapa } : l)));
    setMensagemStatus('Etapa atualizada com sucesso no Pipeline B2B!');
    setTimeout(() => setMensagemStatus(null), 3000);
  };

  const abrirWhatsAppComercial = (lead: LeadB2B) => {
    const texto = `Olá ${lead.nomeContato}! Aqui é o consultor oficial do MiseOn — Sistema de Gestão para Food Service. 🚀\n\nVi que você tem a *${lead.nomeLoja}* (${lead.segmento}). Consegue conversar 5 minutos agora para eu te mostrar como eliminar erros de estoque e organizar o KDS da sua cozinha?`;
    const url = `https://wa.me/55${lead.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };

  const adicionarLead = () => {
    if (!novoLead.nomeLoja || !novoLead.telefone) return;
    const item: LeadB2B = {
      id: Date.now().toString(),
      nomeLoja: novoLead.nomeLoja,
      nomeContato: novoLead.nomeContato || 'Responsável',
      telefone: novoLead.telefone,
      email: novoLead.email || 'contato@restaurante.com.br',
      segmento: novoLead.segmento,
      origem: 'Prospecção Ativa SuperAdmin',
      etapa: 'NOVO',
      criadoEm: new Date().toISOString().slice(0, 10),
      mrrEstimado: Number(novoLead.mrrEstimado) || 99.90,
    };
    setLeads([item, ...leads]);
    setModalNovoLead(false);
    setNovoLead({ nomeLoja: '', nomeContato: '', telefone: '', email: '', segmento: 'Hamburgueria', mrrEstimado: '99.90' });
    setMensagemStatus(`Lead "${item.nomeLoja}" adicionado ao Pipeline!`);
    setTimeout(() => setMensagemStatus(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* ══════════ 1. HEADER & METRICAS ══════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-['Sora'] text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-indigo-400" size={26} />
            {tDynamic('CRM de Leads B2B & Funil de Vendas MiseOn')}
          </h1>
          <p className="text-xs text-gray-400">
            {tDynamic('Pipeline de prospecção, qualificação de restaurantes e conversão em assinantes recorrentes (MRR).')}
          </p>
        </div>

        <button
          onClick={() => setModalNovoLead(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
        >
          <Plus size={16} /> Adicionar Novo Lead
        </button>
      </div>

      {mensagemStatus && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-3 text-xs font-bold text-emerald-300">
          <CheckCircle2 size={16} /> {mensagemStatus}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <span className="text-xs opacity-95 font-bold text-gray-400">{tDynamic('MRR Potencial no Funil')}</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-emerald-400">
            R$ {mrrTotalEstimado.toFixed(2)}/mês
          </p>
          <span className="text-xs opacity-90 text-gray-400 block mt-1">Assinaturas estimadas</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <span className="text-xs opacity-95 font-bold text-gray-400">Assinantes Ativos</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-indigo-400">{totalAssinantes}</p>
          <span className="text-xs opacity-90 text-emerald-400 font-semibold block mt-1">{tDynamic('Lojas em produção')}</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <span className="text-xs opacity-95 font-bold text-gray-400">{tDynamic('Degustação / Trial 30D')}</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-orange-400">{totalTrials}</p>
          <span className="text-xs opacity-90 text-orange-300 block mt-1">{tDynamic('Em período de teste')}</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <span className="text-xs opacity-95 font-bold text-gray-400">{tDynamic('Total de Leads no Funil')}</span>
          <p className="mt-1 font-['Sora'] text-xl font-bold text-white">{leads.length}</p>
          <span className="text-xs opacity-90 text-gray-400 block mt-1">Origem multicanal</span>
        </div>
      </div>

      {/* ══════════ 2. PIPELINE KANBAN POR ETAPAS ══════════ */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por restaurante, responsável ou telefone..."
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {['TODAS', 'NOVO', 'EM_CONTATO', 'DEMO_TRIAL', 'FECHAMENTO', 'ASSINANTE', 'PERDIDO'].map((etapa) => (
              <button
                key={etapa}
                onClick={() => setEtapaFiltro(etapa)}
                className={`rounded-full px-3 py-1 text-xs opacity-95 font-bold transition ${
                  etapaFiltro === etapa
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {etapa}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela de Leads */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="border-b border-white/10 text-xs opacity-95 uppercase tracking-wider text-gray-400">
              <tr>
                <th className="py-3 px-4">Restaurante / Lead</th>
                <th className="py-3 px-4">Segmento</th>
                <th className="py-3 px-4">Etapa do Funil</th>
                <th className="py-3 px-4">MRR Previsto</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4 text-right">Contato Comercial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {leadsFiltrados.map((lead) => (
                <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-bold text-white">{lead.nomeLoja}</p>
                    <p className="text-xs opacity-95 text-gray-400">{lead.nomeContato} · {lead.telefone}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs opacity-90 font-bold text-gray-300">
                      {lead.segmento}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={lead.etapa}
                      onChange={(e) => moverEtapa(lead.id, e.target.value as LeadB2B['etapa'])}
                      className={`rounded-lg border px-2.5 py-1 text-xs opacity-95 font-bold outline-none bg-black/60 ${
                        lead.etapa === 'ASSINANTE' ? 'border-emerald-500/50 text-emerald-400' :
                        lead.etapa === 'DEMO_TRIAL' ? 'border-orange-500/50 text-orange-400' :
                        lead.etapa === 'FECHAMENTO' ? 'border-indigo-500/50 text-indigo-400' :
                        lead.etapa === 'EM_CONTATO' ? 'border-blue-500/50 text-blue-400' :
                        lead.etapa === 'PERDIDO' ? 'border-red-500/50 text-red-400' :
                        'border-gray-500/50 text-gray-300'
                      }`}
                    >
                      <option value="NOVO">Novo Lead</option>
                      <option value="EM_CONTATO">Em Contato</option>
                      <option value="DEMO_TRIAL">Trial 30D Ativo</option>
                      <option value="FECHAMENTO">Proposta / Fechamento</option>
                      <option value="ASSINANTE">Assinante Ativo (Ganho)</option>
                      <option value="PERDIDO">{tDynamic('Perdido / Sem Perfil')}</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                    R$ {lead.mrrEstimado.toFixed(2)}/mês
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs opacity-95">
                    {lead.origem}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => abrirWhatsAppComercial(lead)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition"
                    >
                      <Send size={13} /> {tDynamic('Chamar no WhatsApp')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ADICIONAR LEAD */}
      {modalNovoLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F172A] p-6 shadow-2xl text-white">
            <h3 className="font-['Sora'] text-lg font-bold">{tDynamic('Cadastrar Lead de Prospecção')}</h3>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">{tDynamic('Nome do Restaurante / Loja')}</label>
                <input
                  type="text"
                  value={novoLead.nomeLoja}
                  onChange={(e) => setNovoLead({ ...novoLead, nomeLoja: e.target.value })}
                  placeholder="Ex: Hamburgueria Real"
                  className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">{tDynamic('Nome do Responsável / Head')}</label>
                <input
                  type="text"
                  value={novoLead.nomeContato}
                  onChange={(e) => setNovoLead({ ...novoLead, nomeContato: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Telefone WhatsApp</label>
                <input
                  type="text"
                  value={novoLead.telefone}
                  onChange={(e) => setNovoLead({ ...novoLead, telefone: e.target.value })}
                  placeholder="Ex: 11988887777"
                  className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Segmento</label>
                <select
                  value={novoLead.segmento}
                  onChange={(e) => setNovoLead({ ...novoLead, segmento: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-white outline-none"
                >
                  <option value="Hamburgueria">Hamburgueria</option>
                  <option value="Pizzaria">Pizzaria</option>
                  <option value="Restaurante por Quilo">{tDynamic('Restaurante por Quilo')}</option>
                  <option value="Lanchonete / Bar">Lanchonete / Bar</option>
                  <option value="Delivery Multicanais">Delivery Multicanais</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setModalNovoLead(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-gray-400 hover:text-white">
                Cancelar
              </button>
              <button onClick={adicionarLead} className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500">
                Salvar Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
