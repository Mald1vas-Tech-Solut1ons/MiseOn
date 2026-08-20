import { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Plus, Trash2, X, Save, ChevronUp, ChevronDown, MessageCircle,
  Wallet, QrCode, ShoppingCart, Gift, Target, Megaphone, Users, Mail, Send
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Cupom, Banner, Cliente, CarrinhoAbandonado, MetodoPgto, fmt } from '../../types';
import ImageUpload from '../../components/ImageUpload';
import CrmClientes from '../../components/admin/CrmClientes';
import type { CtxLoja } from './AdminLayout';
import { getOptimizedImageUrl } from '../../lib/cdn';

import { useI18n } from '../../contexts/I18nContext';
type Tab = 'cupons' | 'banners' | 'cashback' | 'recuperacao' | 'anuncios' | 'disparos' | 'emails' | 'crm';

export default function Marketing() {
  const { tDynamic } = useI18n();
  const { lojaId, lojaSlug } = useOutletContext<CtxLoja>();
  const [tab, setTab] = useState<Tab>('cupons');

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-['JetBrains_Mono'] text-[11px] tracking-[0.25em] text-orange-500 uppercase">{tDynamic('GESTÃO · MARKETING & VENDAS')}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
        </div>
        <h2 className="font-['Sora'] text-2xl font-black text-gray-900 dark:text-white">Marketing & Engajamento</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-2xl">
          {tDynamic('Atraia novos clientes com anúncios rastreados, fidelize com cashback e recupere vendas no WhatsApp sem pagar comissões adicionais.')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {[
          { id: 'cupons', label: 'Cupons', icon: Gift },
          { id: 'banners', label: 'Banners de Vitrine', icon: Megaphone },
          { id: 'cashback', label: 'Cashback Fidelidade', icon: Wallet },
          { id: 'recuperacao', label: 'Recuperação de Vendas', icon: ShoppingCart },
          { id: 'anuncios', label: 'Meta Pixel & GA4', icon: Target },
          { id: 'disparos', label: 'Disparos WhatsApp', icon: MessageCircle },
          { id: 'emails', label: 'E-mails Transacionais', icon: Mail },
          { id: 'crm', label: 'CRM & RFM', icon: Users },
        ].map(({ id, label, icon: IconComponent }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
              tab === id
                ? 'bg-[var(--cor-primaria)] text-white shadow-md shadow-[var(--cor-primaria)]/25'
                : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700 shadow-sm'
            }`}
          >
            <IconComponent size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {tab === 'cupons' && <CuponsTab lojaId={lojaId} />}
      {tab === 'banners' && <BannersTab lojaId={lojaId} />}
      {tab === 'cashback' && <CashbackTab lojaId={lojaId} />}
      {tab === 'recuperacao' && <RecuperacaoTab lojaId={lojaId} lojaSlug={lojaSlug} />}
      {tab === 'anuncios' && <AnunciosTab lojaId={lojaId} />}
      {tab === 'disparos' && <DisparosTab lojaId={lojaId} lojaSlug={lojaSlug} />}
      {tab === 'emails' && <EmailsTab lojaId={lojaId} />}
      {tab === 'crm' && <CrmClientes />}
    </div>
  );
}

// ── Cupons ────────────────────────────────────────────────────
function CuponsTab({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [editando, setEditando] = useState<Cupom | 'novo' | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('cupons').select('*').eq('loja_id', lojaId).order('codigo');
    setCupons((data as Cupom[]) ?? []);
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const toggleAtivo = async (c: Cupom) => {
    await supabase.from('cupons').update({ ativo: !c.ativo }).eq('id', c.id);
    carregar();
  };
  const excluir = async (c: Cupom) => {
    if (!confirm(`Excluir cupom "${c.codigo}"?`)) return;
    await supabase.from('cupons').delete().eq('id', c.id);
    carregar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{tDynamic('Cupons de Desconto')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{tDynamic('Ofereça incentivos estratégicos para primeira compra ou pedidos mínimos.')}</p>
        </div>
        <button
          onClick={() => setEditando('novo')}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[var(--cor-primaria)]/20 hover:brightness-110 transition-all"
        >
          <Plus size={14} /> Criar Cupom
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cupons.map((c) => (
          <div
            key={c.id}
            className={`rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm space-y-3 transition ${
              c.ativo === false ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block font-mono text-base font-extrabold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
                  {c.codigo}
                </span>
                {c.apenas_primeiro_pedido && (
                  <span className="ml-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5">
                    1ª Compra
                  </span>
                )}
              </div>
              <span className="text-lg font-black text-[var(--cor-primaria)]">
                {c.tipo === 'FIXO' ? fmt(Number(c.valor)) : `${c.valor}% OFF`}
              </span>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 min-h-[32px]">
              {c.descricao || 'Cupom promocional para uso na vitrine.'}
              {c.pedido_minimo > 0 && ` · Mín: ${fmt(Number(c.pedido_minimo))}`}
              {c.metodo_exigido && ` · Válido em: ${c.metodo_exigido}`}
            </p>

            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3 gap-2">
              <button
                onClick={() => setEditando(c)}
                className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Editar
              </button>
              <button
                onClick={() => toggleAtivo(c)}
                className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                  c.ativo === false
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                {c.ativo === false ? 'Ativar' : 'Pausar'}
              </button>
              <button
                onClick={() => excluir(c)}
                className="rounded-xl border border-red-200 dark:border-red-900/50 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {cupons.length === 0 && (
        <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl">
          <Gift size={32} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Nenhum cupom cadastrado</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">{tDynamic('Crie cupons de primeira compra para aumentar a taxa de conversão do seu cardápio.')}</p>
        </div>
      )}

      {editando && (
        <CupomModal
          lojaId={lojaId}
          cupom={editando === 'novo' ? null : editando}
          onClose={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}

function CupomModal({ lojaId, cupom, onClose, onSalvo }: { lojaId: string; cupom: Cupom | null; onClose: () => void; onSalvo: () => void }) {
  const { tDynamic } = useI18n();
  const [codigo, setCodigo] = useState(cupom?.codigo ?? '');
  const [descricao, setDescricao] = useState(cupom?.descricao ?? '');
  const [tipo, setTipo] = useState<'FIXO' | 'PERCENTUAL'>(cupom?.tipo ?? 'FIXO');
  const [valor, setValor] = useState(String(cupom?.valor ?? ''));
  const [pedidoMinimo, setPedidoMinimo] = useState(String(cupom?.pedido_minimo ?? '0'));
  const [primeiraCompra, setPrimeiraCompra] = useState(cupom?.apenas_primeiro_pedido ?? false);
  const [metodo, setMetodo] = useState<MetodoPgto | ''>(cupom?.metodo_exigido ?? '');
  const [validade, setValidade] = useState(cupom?.validade ?? '');
  const [limiteUsos, setLimiteUsos] = useState(cupom?.limite_usos != null ? String(cupom.limite_usos) : '');
  const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!codigo.trim() || !valor) return setErro('Preencha código e valor.');
    const payload = {
      loja_id: lojaId,
      codigo: codigo.trim().toUpperCase(),
      descricao: descricao || null,
      tipo, valor: Number(valor),
      pedido_minimo: Number(pedidoMinimo || 0),
      apenas_primeiro_pedido: primeiraCompra,
      metodo_exigido: metodo || null,
      validade: validade || null,
      limite_usos: limiteUsos ? Number(limiteUsos) : null,
    };
    const { error } = cupom
      ? await supabase.from('cupons').update(payload).eq('id', cupom.id)
      : await supabase.from('cupons').insert(payload);
    if (error) return setErro('Erro: ' + error.message);
    onSalvo();
  };

  return (
    <div className="fade fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="sheet w-full max-w-lg rounded-3xl bg-white dark:bg-gray-900 dark:border-gray-800 p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <h3 className="text-base font-bold dark:text-white">{cupom ? 'Editar cupom' : 'Criar novo cupom'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">{tDynamic('Código do Cupom')}</label>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex: BEMVINDO10" className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 font-mono font-bold uppercase outline-none focus:ring-2 focus:ring-[var(--cor-primaria)]" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">{tDynamic('Descrição (Exibida para o cliente)')}</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: 10% de desconto no seu primeiro pedido!" className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 outline-none focus:ring-2 focus:ring-[var(--cor-primaria)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">{tDynamic('Tipo de Desconto')}</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 font-semibold outline-none">
                <option value="FIXO">Valor fixo (R$)</option>
                <option value="PERCENTUAL">Percentual (%)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">{tDynamic('Valor do Desconto')}</label>
              <input value={valor} onChange={(e) => setValor(e.target.value)} type="number" placeholder="10" className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 font-bold outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">{tDynamic('Pedido Mínimo (R$)')}</label>
              <input value={pedidoMinimo} onChange={(e) => setPedidoMinimo(e.target.value)} type="number" placeholder="0" className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Limite de Usos</label>
              <input value={limiteUsos} onChange={(e) => setLimiteUsos(e.target.value)} type="number" placeholder="Ilimitado" className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">{tDynamic('Forma de Pagamento')}</label>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as any)} className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 outline-none">
                <option value="">{tDynamic('Qualquer método')}</option>
                {(['PIX', 'CREDITO', 'DEBITO', 'DINHEIRO'] as MetodoPgto[]).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">{tDynamic('Data de Validade')}</label>
              <input value={validade} onChange={(e) => setValidade(e.target.value)} type="date" className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 outline-none" />
            </div>
          </div>
          <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={primeiraCompra} onChange={(e) => setPrimeiraCompra(e.target.checked)} className="h-4 w-4 rounded accent-[var(--cor-primaria)]" />
            {tDynamic('Válido exclusivamente no 1º pedido do cliente')}
          </label>
        </div>

        {erro && <p className="text-xs font-bold text-red-500">{erro}</p>}

        <button onClick={salvar} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 font-bold text-white shadow-md shadow-[var(--cor-primaria)]/20 hover:brightness-110">
          <Save size={16} /> Salvar Cupom
        </button>
      </div>
    </div>
  );
}

// ── Banners ───────────────────────────────────────────────────
function BannersTab({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [novo, setNovo] = useState({ imagem_url: '', titulo: '', link_redirecionamento: '' });

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('banners_destaque').select('*').eq('loja_id', lojaId).order('ordem_exibicao');
    setBanners((data as Banner[]) ?? []);
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const criar = async () => {
    if (!novo.imagem_url) return;
    const ordem = banners.length ? Math.max(...banners.map((b) => b.ordem_exibicao)) + 1 : 0;
    await supabase.from('banners_destaque').insert({ loja_id: lojaId, ...novo, ordem_exibicao: ordem });
    setNovo({ imagem_url: '', titulo: '', link_redirecionamento: '' });
    carregar();
  };
  const mover = async (b: Banner, dir: -1 | 1) => {
    const idx = banners.findIndex((x) => x.id === b.id);
    const alvo = banners[idx + dir];
    if (!alvo) return;
    await Promise.all([
      supabase.from('banners_destaque').update({ ordem_exibicao: alvo.ordem_exibicao }).eq('id', b.id),
      supabase.from('banners_destaque').update({ ordem_exibicao: b.ordem_exibicao }).eq('id', alvo.id),
    ]);
    carregar();
  };
  const toggleAtivo = async (b: Banner) => {
    await supabase.from('banners_destaque').update({ is_ativo: !b.is_ativo }).eq('id', b.id);
    carregar();
  };
  const excluir = async (b: Banner) => {
    if (!confirm('Excluir este banner?')) return;
    await supabase.from('banners_destaque').delete().eq('id', b.id);
    carregar();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{tDynamic('Banners do Carrossel da Vitrine')}</h3>
          {banners.map((b, idx) => (
            <div key={b.id} className={`flex items-center gap-3 rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm ${b.is_ativo === false ? 'opacity-50' : ''}`}>
              <img src={getOptimizedImageUrl(b.imagem_url)} className="h-16 w-28 shrink-0 rounded-xl object-cover" alt="" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{b.titulo || '(sem título)'}</p>
                <p className="truncate text-xs text-gray-400">{b.link_redirecionamento || 'Sem link externo'}</p>
              </div>
              <div className="flex flex-col">
                <button disabled={idx === 0} onClick={() => mover(b, -1)} className="text-gray-400 hover:text-gray-600 disabled:opacity-20"><ChevronUp size={16} /></button>
                <button disabled={idx === banners.length - 1} onClick={() => mover(b, 1)} className="text-gray-400 hover:text-gray-600 disabled:opacity-20"><ChevronDown size={16} /></button>
              </div>
              <button onClick={() => toggleAtivo(b)} className="text-xs font-bold text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg">{b.is_ativo === false ? 'Inativo' : 'Ativo'}</button>
              <button onClick={() => excluir(b)} className="rounded-xl border border-red-200 p-2 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
            </div>
          ))}
          {banners.length === 0 && <p className="py-8 text-center text-xs text-gray-400">{tDynamic('Nenhum banner cadastrado no carrossel.')}</p>}
        </div>

        <div className="rounded-3xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-5 shadow-sm space-y-3 h-fit">
          <p className="text-sm font-bold dark:text-white">Adicionar Novo Banner</p>
          <ImageUpload lojaId={lojaId} pasta="banners" value={novo.imagem_url} onChange={(u) => setNovo({ ...novo, imagem_url: u })} aspecto="aspect-[2/1]" />
          <input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} placeholder="Título promocional (opcional)" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-xs outline-none" />
          <input value={novo.link_redirecionamento} onChange={(e) => setNovo({ ...novo, link_redirecionamento: e.target.value })} placeholder="Link de redirecionamento (opcional)" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-xs outline-none" />
          <button onClick={criar} className="w-full rounded-xl bg-[var(--cor-primaria)] py-3 text-xs font-bold text-white shadow-md shadow-[var(--cor-primaria)]/20 hover:brightness-110">Adicionar Banner</button>
        </div>
      </div>
    </div>
  );
}

// ── Cashback ──────────────────────────────────────────────────
function CashbackTab({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [pct, setPct] = useState('0');
  const [pctOriginal, setPctOriginal] = useState('0');
  const [stats, setStats] = useState({ clientesComSaldo: 0, passivoTotal: 0 });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(async () => {
    const [{ data: loja }, { data: saldos }] = await Promise.all([
      supabase.from('lojas').select('cashback_pct').eq('id', lojaId).single(),
      supabase.from('cashback_saldos').select('saldo').eq('loja_id', lojaId).gt('saldo', 0),
    ]);
    const p = String(loja?.cashback_pct ?? 0);
    setPct(p); setPctOriginal(p);
    setStats({
      clientesComSaldo: saldos?.length ?? 0,
      passivoTotal: (saldos ?? []).reduce((s, x) => s + Number(x.saldo), 0),
    });
    setCarregando(false);
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    setSalvando(true); setMsg('');
    const { error } = await supabase.from('lojas').update({ cashback_pct: Number(pct || 0) }).eq('id', lojaId);
    setSalvando(false);
    if (error) return setMsg('Erro ao salvar: ' + error.message);
    setPctOriginal(pct);
    setMsg('Regra de Cashback salva com sucesso!');
    setTimeout(() => setMsg(''), 2500);
  };

  if (carregando) return <p className="py-10 text-center text-xs text-gray-400">{tDynamic('Carregando dados de Cashback…')}</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-3xl border border-[var(--cor-primaria)]/30 bg-[var(--cor-primaria)]/5 p-5">
        <p className="mb-1 flex items-center gap-2 text-sm font-black text-[var(--cor-primaria)]"><Wallet size={16} /> {tDynamic('Como Funciona o Programa de Fidelidade')}</p>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          A cada pedido <b>finalizado</b> feito pelo cardápio online, o cliente ganha automaticamente um % do valor pago em saldo. Na compra seguinte, o saldo acumulado aparece como opção de desconto no checkout, gerando uma taxa de retenção até 4x superior a concorrentes sem programa de pontos.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">{tDynamic('Percentual de Cashback por Pedido')}</span>
          <div className="mt-3 flex items-center gap-3">
            <input type="number" min="0" max="100" step="0.5" value={pct} onChange={(e) => setPct(e.target.value)}
              className="w-32 rounded-2xl border-2 border-[var(--cor-primaria)] bg-green-50 p-3 text-center text-3xl font-black text-[var(--cor-primaria)] outline-none dark:bg-green-900/10" />
            <span className="text-2xl font-black text-gray-400">% de retorno</span>
          </div>
          <p className="mt-2 text-xs text-gray-400">{tDynamic('Dica: 5% a 10% é o valor ideal utilizado pelas maiores redes para garantir a volta do cliente.')}</p>
        </div>

        {msg && <p className={`text-xs font-bold ${msg.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}

        <button onClick={salvar} disabled={salvando || pct === pctOriginal}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-md shadow-[var(--cor-primaria)]/20 disabled:opacity-40">
          <Save size={16} /> {salvando ? 'Salvando…' : 'Salvar Regra de Cashback'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-bold text-gray-400 uppercase">{tDynamic('Clientes com Saldo Ativo')}</p>
          <p className="mt-2 text-3xl font-black dark:text-white">{stats.clientesComSaldo}</p>
          <p className="text-[11px] text-gray-400 mt-1">{tDynamic('Clientes engajados prontos para pedir de novo.')}</p>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-bold text-gray-400 uppercase">{tDynamic('Passivo Total em Aberto')}</p>
          <p className="mt-2 text-3xl font-black text-[var(--cor-primaria)]">{fmt(stats.passivoTotal)}</p>
          <p className="text-[11px] text-gray-400 mt-1">{tDynamic('Valor acumulado por clientes para futuros descontos.')}</p>
        </div>
      </div>
    </div>
  );
}

// ── Recuperação de Vendas ────────────────────────────────────
interface PixPendente {
  id: string; numero: number; identificador_cliente: string; telefone_contato?: string;
  valor_total: number; criado_em: string;
}

function RecuperacaoTab({ lojaId, lojaSlug }: { lojaId: string; lojaSlug: string }) {
  const { tDynamic } = useI18n();
  const [subtab, setSubtab] = useState<'pix' | 'carrinhos'>('pix');
  const [pixPendentes, setPixPendentes] = useState<PixPendente[]>([]);
  const [carrinhos, setCarrinhos] = useState<(CarrinhoAbandonado & { nome?: string | null; telefone?: string })[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerandoCupom, setGerandoCupom] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const corteMinimo = new Date(Date.now() - 15 * 60000).toISOString();
    const janela3d = new Date(Date.now() - 3 * 86400000).toISOString();
    const janela7d = new Date(Date.now() - 7 * 86400000).toISOString();

    const [{ data: pix }, { data: abandonados }] = await Promise.all([
      supabase.from('pedidos')
        .select('id, numero, identificador_cliente, telefone_contato, valor_total, criado_em, pagamentos!inner(metodo, status)')
        .eq('loja_id', lojaId).eq('pagamentos.metodo', 'PIX').eq('pagamentos.status', 'PENDENTE')
        .lte('criado_em', corteMinimo).gte('criado_em', janela3d)
        .order('criado_em', { ascending: false }),
      supabase.from('carrinhos_abandonados').select('*')
        .eq('loja_id', lojaId).eq('status', 'ABERTO').gte('atualizado_em', janela7d)
        .order('atualizado_em', { ascending: false }),
    ]);
    setPixPendentes((pix as unknown as PixPendente[]) ?? []);

    const userIds = [...new Set((abandonados ?? []).map((c) => c.user_id))];
    let mapa = new Map<string, { nome?: string | null; telefone: string }>();
    if (userIds.length > 0) {
      const { data: clientesData } = await supabase.from('clientes').select('user_id, nome, telefone').eq('loja_id', lojaId).in('user_id', userIds);
      mapa = new Map((clientesData ?? []).map((c) => [c.user_id, c]));
    }
    setCarrinhos((abandonados as CarrinhoAbandonado[] ?? []).map((c) => ({ ...c, ...mapa.get(c.user_id) })));
    setCarregando(false);
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const linkCardapio = `${window.location.origin}/${lojaSlug}`;

  const enviarPix = (p: PixPendente) => {
    if (!p.telefone_contato) return;
    const texto = `Oi ${p.identificador_cliente}! Vi que o Pix do seu pedido #${p.numero} (${fmt(Number(p.valor_total))}) não foi concluído. Quer tentar novamente? Acesse por aqui: ${linkCardapio}`;
    window.open(`https://wa.me/${p.telefone_contato.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const enviarCarrinho = (c: CarrinhoAbandonado & { nome?: string | null; telefone?: string }, comCupom?: string) => {
    if (!c.telefone) return;
    const saudacao = c.nome ? `Oi ${c.nome}!` : 'Oi!';
    const textoBase = `${saudacao} Vi que você montou o pedido (${c.itens_resumo}), mas não finalizou. Quer que eu te ajude a concluir? 😉`;
    const textoCupom = comCupom ? `\n\nUse o cupom *${comCupom}* para ganhar 10% OFF na sua compra 🎁` : '';
    window.open(`https://wa.me/${c.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(textoBase + textoCupom + `\n${linkCardapio}`)}`, '_blank');
  };

  const gerarCupomEEnviar = async (c: CarrinhoAbandonado & { nome?: string | null; telefone?: string }) => {
    setGerandoCupom(c.id);
    const codigo = `VOLTA${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from('cupons').insert({
      loja_id: lojaId, codigo, descricao: 'Recuperação de venda — cupom automático',
      tipo: 'PERCENTUAL', valor: 10, limite_usos: 1,
      validade: new Date(Date.now() + 48 * 3600e3).toISOString().slice(0, 10),
    });
    setGerandoCupom(null);
    if (error) return alert('Erro ao gerar cupom: ' + error.message);
    enviarCarrinho(c, codigo);
  };

  if (carregando) return <p className="py-10 text-center text-xs text-gray-400">{tDynamic('Buscando oportunidades de recuperação…')}</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSubtab('pix')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            subtab === 'pix' ? 'bg-[var(--cor-primaria)] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          }`}
        >
          <QrCode size={14} /> Pix Pendentes ({pixPendentes.length})
        </button>
        <button
          onClick={() => setSubtab('carrinhos')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            subtab === 'carrinhos' ? 'bg-[var(--cor-primaria)] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          }`}
        >
          <ShoppingCart size={14} /> Carrinhos Abandonados ({carrinhos.length})
        </button>
      </div>

      {subtab === 'pix' && (
        <div className="space-y-3">
          {pixPendentes.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Pedido #{p.numero} · {p.identificador_cliente}</p>
                <p className="text-xs text-gray-400">{fmt(Number(p.valor_total))}</p>
              </div>
              <button onClick={() => enviarPix(p)} disabled={!p.telefone_contato} className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/40 px-3 py-2 text-xs font-bold text-green-700 dark:text-green-300 hover:bg-green-100">
                <MessageCircle size={14} /> Enviar Lembrete Pix
              </button>
            </div>
          ))}
          {pixPendentes.length === 0 && <p className="py-8 text-center text-xs text-gray-400">{tDynamic('Nenhum Pix pendente sem pagamento nos últimos dias. Excelente!')}</p>}
        </div>
      )}

      {subtab === 'carrinhos' && (
        <div className="space-y-3">
          {carrinhos.map((c) => (
            <div key={c.id} className="rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{c.nome || 'Cliente'} {c.telefone ? `· ${c.telefone}` : ''}</p>
                  <p className="text-xs text-gray-400">{c.itens_resumo}</p>
                  <p className="text-xs font-semibold text-[var(--cor-primaria)] mt-0.5">Valor estimado: {fmt(Number(c.valor_estimado))}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => enviarCarrinho(c)} disabled={!c.telefone} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50">
                  <MessageCircle size={14} /> {tDynamic('Falar no WhatsApp')}
                </button>
                <button onClick={() => gerarCupomEEnviar(c)} disabled={!c.telefone || gerandoCupom === c.id} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] py-2 text-xs font-bold text-white shadow-sm hover:brightness-110">
                  <Gift size={14} /> {gerandoCupom === c.id ? 'Gerando…' : 'Enviar com 10% OFF'}
                </button>
              </div>
            </div>
          ))}
          {carrinhos.length === 0 && <p className="py-8 text-center text-xs text-gray-400">Nenhum carrinho abandonado recente.</p>}
        </div>
      )}
    </div>
  );
}

// ── Meta Pixel & GA4 ──────────────────────────────────────────
function AnunciosTab({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [pixelId, setPixelId] = useState('');
  const [ga4Id, setGa4Id] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.from('lojas').select('meta_pixel_id, ga4_measurement_id').eq('id', lojaId).single()
      .then(({ data }) => {
        if (data) {
          setPixelId(data.meta_pixel_id ?? '');
          setGa4Id(data.ga4_measurement_id ?? '');
        }
      });
  }, [lojaId]);

  const salvar = async () => {
    // Estes valores são injetados dentro de um <script> na vitrine. Sem validação
    // de formato, um id "criativo" vira execução de JS arbitrário na sessão dos
    // clientes (auditoria, achado 05). O banco tem CHECK equivalente.
    const meta = pixelId.trim();
    const ga4 = ga4Id.trim();

    if (meta && !/^[0-9]{15,16}$/.test(meta)) {
      return setMsg('O ID do Meta Pixel deve ter 15 ou 16 dígitos, só números.');
    }
    if (ga4 && !/^G-[A-Z0-9]{8,12}$/.test(ga4)) {
      return setMsg('O ID do GA4 deve estar no formato G-XXXXXXXXXX.');
    }

    setSalvando(true); setMsg('');
    const { error } = await supabase.from('lojas').update({
      meta_pixel_id: meta || null,
      ga4_measurement_id: ga4 || null,
    }).eq('id', lojaId);

    setSalvando(false);
    if (error) return setMsg('Erro ao salvar: ' + error.message);
    setMsg('Pixels salvos com sucesso!');
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-3xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-900/50 p-5 space-y-2">
        <p className="flex items-center gap-2 text-sm font-bold text-blue-800 dark:text-blue-300">
          <Target size={16} /> {tDynamic('Rastreamento Profissional de Anúncios no Instagram & Google')}
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          {tDynamic('Cole abaixo os identificadores dos seus pixels. O cardápio do MiseOn dispara automaticamente os eventos de')} <b>PageView</b>, <b>AddToCart</b> e <b>Purchase</b> para otimizar suas campanhas de tráfego pago sem custo adicional de servidor.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase">Meta Pixel ID (Facebook / Instagram Ads)</label>
          <input
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value)}
            placeholder="Ex: 123456789012345"
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--cor-primaria)]"
          />
          <p className="text-[11px] text-gray-400 mt-1">{tDynamic('Encontrado no Gerenciador de Negócios da Meta em Fontes de Dados → Pixels.')}</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase">Google Analytics 4 (GA4 ID)</label>
          <input
            value={ga4Id}
            onChange={(e) => setGa4Id(e.target.value)}
            placeholder="Ex: G-XXXXXXXXXX"
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--cor-primaria)]"
          />
          <p className="text-[11px] text-gray-400 mt-1">{tDynamic('Encontrado no painel do Google Analytics em Administrador → Fluxos de dados.')}</p>
        </div>

        {msg && <p className={`text-xs font-bold ${msg.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}

        <button onClick={salvar} disabled={salvando} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-md shadow-[var(--cor-primaria)]/20 hover:brightness-110">
          <Save size={16} /> {salvando ? 'Salvando…' : 'Salvar Pixels de Rastreamento'}
        </button>
      </div>
    </div>
  );
}

// ── Disparos WhatsApp ─────────────────────────────────────────
function DisparosTab({ lojaId, lojaSlug }: { lojaId: string; lojaSlug: string }) {
  const { tDynamic } = useI18n();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [segmento, setSegmento] = useState<'todos' | 'vips' | 'inativos'>('todos');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    supabase.from('clientes').select('*').eq('loja_id', lojaId).order('ultimo_pedido', { ascending: false })
      .then(({ data }) => setClientes((data as Cliente[]) ?? []));
  }, [lojaId]);

  const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString();
  const filtrados = clientes.filter((c) => {
    if (segmento === 'vips') return c.total_pedidos >= 5;
    if (segmento === 'inativos') return !c.ultimo_pedido || c.ultimo_pedido < trintaDiasAtras;
    return true;
  });

  const linkCardapio = `${window.location.origin}/${lojaSlug}`;

  const enviarWhatsApp = (c: Cliente) => {
    const texto = mensagem.trim() || `Oi ${c.nome || ''}! Temos novidades no nosso cardápio hoje 😋 Acesse e peça por aqui: ${linkCardapio}`;
    window.open(`https://wa.me/${c.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Megaphone size={18} className="text-[var(--cor-primaria)]" />
          {tDynamic('Central de Disparos Promocionais no WhatsApp')}
        </h3>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-gray-500 uppercase">1. Selecione o Segmento de Clientes</label>
          <div className="flex gap-2">
            {[
              { id: 'todos', label: `Todos os Clientes (${clientes.length})` },
              { id: 'vips', label: `Clientes VIPs (+5 pedidos) (${clientes.filter(c => c.total_pedidos >= 5).length})` },
              { id: 'inativos', label: `Inativos (+30 dias sem pedir) (${clientes.filter(c => !c.ultimo_pedido || c.ultimo_pedido < trintaDiasAtras).length})` },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSegmento(id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  segmento === id ? 'bg-[var(--cor-primaria)] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">2. Modelo de Mensagem Promocional</label>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder={`Oi {nome}! Hoje preparamos uma oferta especial pra você no nosso cardápio 🍔\nPeça online por aqui: ${linkCardapio}`}
            rows={3}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-xs outline-none focus:ring-2 focus:ring-[var(--cor-primaria)]"
          />
        </div>
      </div>

      {/* Lista de Destinatários */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase">Destinatários Selecionados ({filtrados.length})</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">{c.nome || 'Cliente'}</p>
                <p className="text-[11px] text-gray-400">{c.telefone}</p>
              </div>
              <button
                onClick={() => enviarWhatsApp(c)}
                className="flex items-center gap-1 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/40 px-3 py-1.5 text-xs font-bold text-green-700 dark:text-green-300 hover:bg-green-100"
              >
                <MessageCircle size={14} /> Disparar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Central de E-mails Transacionais ─────────────────────────────
function EmailsTab({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [eventoSelecionado, setEventoSelecionado] = useState('pedido-recebido');
  const [emailTeste, setEmailTeste] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const enviarTeste = async () => {
    if (!emailTeste.trim()) return alert('Digite o e-mail de destino do teste.');
    setEnviando(true);
    setFeedback(null);
    try {
      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          loja_id: lojaId,
          evento: eventoSelecionado,
          destinatario: emailTeste.trim(),
          dados: {
            pedido_numero: 142,
            valor: '48.50',
            valorTotal: '48.50',
            metodo: 'Pix',
            itens: [{ nome: 'X-Burger Artesanal', quantidade: 2, preco: '24.25' }],
          },
        },
      });

      if (error) throw error;
      setFeedback('E-mail de teste disparado com sucesso! Verifique a caixa de entrada.');
    } catch (err: any) {
      setFeedback(`Erro ao enviar teste: ${err.message || 'Verifique as variáveis de ambiente SMTP.'}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <h3 className="font-['Sora'] text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail className="text-orange-500" size={20} />
              {tDynamic('Central de E-mails Transacionais & Notificações')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {tDynamic('Modelos de e-mail responsivos com alta entregabilidade anti-spam e layout personalizado com a cor da sua marca.')}
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Engine Ativa
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Selecione o Modelo de E-mail:')}</span>
              <select
                value={eventoSelecionado}
                onChange={(e) => setEventoSelecionado(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3 text-sm font-bold dark:text-white"
              >
                <option value="pedido-recebido">📦 Pedido Recebido & Confirmado</option>
                <option value="pagamento-confirmado">💳 Pagamento Aprovado (Pix/Cartão)</option>
                <option value="pedido-a-caminho">🛵 Pedido em Rota de Entrega</option>
                <option value="carrinho-abandonado">🛒 Recuperação de Carrinho (+45 min)</option>
                <option value="cupom-disponivel">🎁 Oferta de Cupom & Desconto</option>
                <option value="boas-vindas-loja">🎉 Boas-vindas ao Sistema</option>
              </select>
            </label>

            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-4 space-y-3 bg-gray-50 dark:bg-gray-950">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{tDynamic('Disparar E-mail de Teste')}</p>
              <input
                type="email"
                placeholder="Seu e-mail para receber o teste"
                value={emailTeste}
                onChange={(e) => setEmailTeste(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 text-sm dark:text-white"
              />
              <button
                onClick={enviarTeste}
                disabled={enviando}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
              >
                <Send size={14} /> {enviando ? 'Enviando e-mail...' : 'Enviar Teste Agora'}
              </button>
              {feedback && (
                <p className={`text-xs font-bold ${feedback.includes('Erro') ? 'text-red-500' : 'text-emerald-500'}`}>
                  {feedback}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-[#070C18] p-5 text-white space-y-3">
            <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">{tDynamic('Pré-visualização do Modelo')}</p>
            <div className="rounded-xl bg-white text-gray-900 p-4 space-y-2 text-xs shadow-inner">
              <div className="border-b pb-2 flex justify-between font-bold">
                <span>Assunto: Pedido #142 confirmado</span>
                <span className="text-orange-600">MiseOn Transactional</span>
              </div>
              <p className="text-gray-600 leading-relaxed">
                {tDynamic('Olá! Seu pedido')} <b>#142</b> foi recebido com sucesso e entrou na fila de preparo.
              </p>
              <div className="bg-gray-50 p-2 rounded-lg border font-mono">
                2x X-Burger Artesanal — R$ 48,50
              </div>
              <div className="pt-2 text-center">
                <span className="inline-block bg-[#FC5B24] text-white px-4 py-2 rounded-lg font-bold text-[11px]">
                  Acompanhar Pedido
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
