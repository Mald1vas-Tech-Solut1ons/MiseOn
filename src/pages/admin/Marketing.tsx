import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, X, Save, ChevronUp, ChevronDown, MessageCircle, Search, Wallet, QrCode, ShoppingCart, Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Cupom, Banner, TaxaEntrega, HorarioFuncionamento, MetodoPgto, Cliente, CarrinhoAbandonado, fmt } from '../../types';
import ImageUpload from '../../components/ImageUpload';
import CrmClientes from '../../components/admin/CrmClientes';
import type { CtxLoja } from './AdminLayout';

type Tab = 'cupons' | 'banners' | 'taxas' | 'horarios' | 'clientes' | 'crm' | 'cashback' | 'recuperacao';
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function Marketing() {
  const { lojaId, lojaSlug } = useOutletContext<CtxLoja>();
  const [tab, setTab] = useState<Tab>('cupons');

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(['cupons', 'banners', 'taxas', 'horarios', 'clientes', 'crm', 'cashback', 'recuperacao'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-sm'}`}>
            {{ cupons: 'Cupons', banners: 'Banners', taxas: 'Taxas de entrega', horarios: 'Horários', clientes: 'Clientes Base', crm: 'CRM & RFM Inteligente', cashback: 'Cashback', recuperacao: 'Recuperação de vendas' }[t]}
          </button>
        ))}
      </div>

      {tab === 'cupons' && <CuponsTab lojaId={lojaId} />}
      {tab === 'banners' && <BannersTab lojaId={lojaId} />}
      {tab === 'taxas' && <TaxasTab lojaId={lojaId} />}
      {tab === 'horarios' && <HorariosTab lojaId={lojaId} />}
      {tab === 'clientes' && <ClientesTab lojaId={lojaId} />}
      {tab === 'crm' && <CrmClientes />}
      {tab === 'cashback' && <CashbackTab lojaId={lojaId} />}
      {tab === 'recuperacao' && <RecuperacaoTab lojaId={lojaId} lojaSlug={lojaSlug} />}
    </div>
  );
}

// ── Cupons ────────────────────────────────────────────────────
function CuponsTab({ lojaId }: { lojaId: string }) {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [editando, setEditando] = useState<Cupom | 'novo' | null>(null);

  const carregar = async () => {
    const { data } = await supabase.from('cupons').select('*').eq('loja_id', lojaId).order('codigo');
    setCupons((data as Cupom[]) ?? []);
  };
  useEffect(() => { setTimeout(carregar, 0); }, [lojaId]);

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
    <div className="space-y-2">
      <button onClick={() => setEditando('novo')}
        className="mb-1 flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--cor-primaria)] py-2.5 text-sm font-semibold text-white">
        <Plus size={15} /> Novo cupom
      </button>
      {cupons.map((c) => (
        <div key={c.id} className={`rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm ${c.ativo === false ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between">
            <p className="font-bold">{c.codigo}</p>
            <span className="text-sm font-semibold text-[var(--cor-primaria)]">
              {c.tipo === 'FIXO' ? fmt(Number(c.valor)) : `${c.valor}%`}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {c.descricao || (c.apenas_primeiro_pedido ? 'Só na 1ª compra' : 'Uso geral')}
            {c.pedido_minimo > 0 && ` · mín. ${fmt(Number(c.pedido_minimo))}`}
            {c.metodo_exigido && ` · só ${c.metodo_exigido}`}
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setEditando(c)} className="flex-1 rounded-lg border py-1.5 text-xs font-medium">Editar</button>
            <button onClick={() => toggleAtivo(c)} className="flex-1 rounded-lg border py-1.5 text-xs font-medium">{c.ativo === false ? 'Ativar' : 'Inativar'}</button>
            <button onClick={() => excluir(c)} className="rounded-lg border border-red-200 px-3 text-red-500"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {cupons.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum cupom cadastrado.</p>}

      {editando && (
        <CupomModal lojaId={lojaId} cupom={editando === 'novo' ? null : editando}
          onClose={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

function CupomModal({ lojaId, cupom, onClose, onSalvo }: { lojaId: string; cupom: Cupom | null; onClose: () => void; onSalvo: () => void }) {
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
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="sheet w-full max-w-lg rounded-t-3xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{cupom ? 'Editar cupom' : 'Novo cupom'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código (ex: BEMVINDO10)" className="w-full rounded-xl border p-2.5 uppercase" />
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (opcional)" className="w-full rounded-xl border p-2.5" />
          <div className="grid grid-cols-2 gap-2">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="rounded-xl border p-2.5">
              <option value="FIXO">Valor fixo (R$)</option>
              <option value="PERCENTUAL">Percentual (%)</option>
            </select>
            <input value={valor} onChange={(e) => setValor(e.target.value)} type="number" placeholder="Valor" className="rounded-xl border p-2.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={pedidoMinimo} onChange={(e) => setPedidoMinimo(e.target.value)} type="number" placeholder="Pedido mínimo R$" className="rounded-xl border p-2.5" />
            <input value={limiteUsos} onChange={(e) => setLimiteUsos(e.target.value)} type="number" placeholder="Limite de usos" className="rounded-xl border p-2.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={metodo} onChange={(e) => setMetodo(e.target.value as any)} className="rounded-xl border p-2.5">
              <option value="">Qualquer método</option>
              {(['PIX', 'CREDITO', 'DEBITO', 'DINHEIRO'] as MetodoPgto[]).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input value={validade} onChange={(e) => setValidade(e.target.value)} type="date" className="rounded-xl border p-2.5" />
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={primeiraCompra} onChange={(e) => setPrimeiraCompra(e.target.checked)} /> Válido só na 1ª compra do cliente
          </label>
        </div>
        {erro && <p className="mt-2 text-sm font-medium text-red-500">{erro}</p>}
        <button onClick={salvar} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 font-semibold text-white">
          <Save size={16} /> Salvar
        </button>
      </div>
    </div>
  );
}

// ── Banners ───────────────────────────────────────────────────
function BannersTab({ lojaId }: { lojaId: string }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [novo, setNovo] = useState({ imagem_url: '', titulo: '', link_redirecionamento: '' });

  const carregar = async () => {
    const { data } = await supabase.from('banners_destaque').select('*').eq('loja_id', lojaId).order('ordem_exibicao');
    setBanners((data as Banner[]) ?? []);
  };
  useEffect(() => { setTimeout(carregar, 0); }, [lojaId]);

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
    <div className="space-y-2">
      {banners.map((b, idx) => (
        <div key={b.id} className={`flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-2.5 shadow-sm ${b.is_ativo === false ? 'opacity-50' : ''}`}>
          <img src={b.imagem_url} className="h-12 w-20 shrink-0 rounded-lg object-cover" alt="" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{b.titulo || '(sem título)'}</p>
            <p className="truncate text-xs text-gray-400">{b.link_redirecionamento || '—'}</p>
          </div>
          <div className="flex flex-col">
            <button disabled={idx === 0} onClick={() => mover(b, -1)} className="text-gray-400 disabled:opacity-20"><ChevronUp size={14} /></button>
            <button disabled={idx === banners.length - 1} onClick={() => mover(b, 1)} className="text-gray-400 disabled:opacity-20"><ChevronDown size={14} /></button>
          </div>
          <button onClick={() => toggleAtivo(b)} className="text-xs font-medium text-gray-500 dark:text-gray-400">{b.is_ativo === false ? 'Inativo' : 'Ativo'}</button>
          <button onClick={() => excluir(b)} className="rounded-lg border border-red-200 p-1.5 text-red-500"><Trash2 size={14} /></button>
        </div>
      ))}

      <div className="space-y-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
        <p className="text-sm font-semibold">Novo banner</p>
        <ImageUpload lojaId={lojaId} pasta="banners" value={novo.imagem_url} onChange={(u) => setNovo({ ...novo, imagem_url: u })} aspecto="aspect-[2/1]" />
        <input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} placeholder="Título (opcional)" className="w-full rounded-lg border p-2 text-sm" />
        <input value={novo.link_redirecionamento} onChange={(e) => setNovo({ ...novo, link_redirecionamento: e.target.value })} placeholder="Link ao clicar (opcional)" className="w-full rounded-lg border p-2 text-sm" />
        <button onClick={criar} className="w-full rounded-lg bg-[var(--cor-primaria)] py-2 text-sm font-semibold text-white">Adicionar</button>
      </div>
    </div>
  );
}

// ── Taxas de entrega ──────────────────────────────────────────
function TaxasTab({ lojaId }: { lojaId: string }) {
  const [taxas, setTaxas] = useState<TaxaEntrega[]>([]);
  const [novo, setNovo] = useState({ bairro: '', valor: '' });

  const carregar = async () => {
    const { data } = await supabase.from('taxas_entrega').select('*').eq('loja_id', lojaId).order('bairro');
    setTaxas((data as TaxaEntrega[]) ?? []);
  };
  useEffect(() => { setTimeout(carregar, 0); }, [lojaId]);

  const criar = async () => {
    if (!novo.bairro || !novo.valor) return;
    await supabase.from('taxas_entrega').insert({ loja_id: lojaId, bairro: novo.bairro, valor: Number(novo.valor) });
    setNovo({ bairro: '', valor: '' });
    carregar();
  };
  const atualizarValor = async (t: TaxaEntrega, valor: string) => {
    if (!valor || Number(valor) === Number(t.valor)) return;
    await supabase.from('taxas_entrega').update({ valor: Number(valor) }).eq('id', t.id);
    carregar();
  };
  const toggleAtivo = async (t: TaxaEntrega) => {
    await supabase.from('taxas_entrega').update({ ativo: !t.ativo }).eq('id', t.id);
    carregar();
  };
  const excluir = async (t: TaxaEntrega) => {
    if (!confirm(`Excluir a taxa do bairro "${t.bairro}"?`)) return;
    await supabase.from('taxas_entrega').delete().eq('id', t.id);
    carregar();
  };

  return (
    <div className="space-y-2">
      {taxas.map((t) => (
        <div key={t.id} className={`flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-2.5 shadow-sm ${t.ativo === false ? 'opacity-50' : ''}`}>
          <p className="flex-1 text-sm font-medium">{t.bairro}</p>
          <div className="flex items-center gap-1 text-sm">
            R$ <input defaultValue={t.valor} onBlur={(e) => atualizarValor(t, e.target.value)} type="number"
              className="w-16 rounded-lg border p-1 text-sm" />
          </div>
          <button onClick={() => toggleAtivo(t)} className="text-xs font-medium text-gray-500 dark:text-gray-400">{t.ativo === false ? 'Inativa' : 'Ativa'}</button>
          <button onClick={() => excluir(t)} className="rounded-lg border border-red-200 p-1.5 text-red-500"><Trash2 size={14} /></button>
        </div>
      ))}

      <div className="flex gap-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-2.5 shadow-sm">
        <input value={novo.bairro} onChange={(e) => setNovo({ ...novo, bairro: e.target.value })} placeholder="Bairro" className="flex-1 rounded-lg border p-2 text-sm" />
        <input value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} type="number" placeholder="R$" className="w-20 rounded-lg border p-2 text-sm" />
        <button onClick={criar} className="rounded-lg bg-[var(--cor-primaria)] px-4 text-sm font-semibold text-white">Add</button>
      </div>
    </div>
  );
}

// ── Horários de funcionamento ─────────────────────────────────
function HorariosTab({ lojaId }: { lojaId: string }) {
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>([]);

  const carregar = async () => {
    const { data } = await supabase.from('horarios_funcionamento').select('*').eq('loja_id', lojaId).order('dia_semana');
    setHorarios((data as HorarioFuncionamento[]) ?? []);
  };
  useEffect(() => { setTimeout(carregar, 0); }, [lojaId]);

  const addIntervalo = async (dia: number) => {
    await supabase.from('horarios_funcionamento').insert({ loja_id: lojaId, dia_semana: dia, abre: '08:00', fecha: '18:00' });
    carregar();
  };
  const atualizar = async (h: HorarioFuncionamento, campo: 'abre' | 'fecha', valor: string) => {
    await supabase.from('horarios_funcionamento').update({ [campo]: valor }).eq('id', h.id);
    carregar();
  };
  const excluir = async (h: HorarioFuncionamento) => {
    await supabase.from('horarios_funcionamento').delete().eq('id', h.id);
    carregar();
  };

  return (
    <div className="space-y-3">
      {DIAS.map((nome, dia) => {
        const doDia = horarios.filter((h) => h.dia_semana === dia);
        return (
          <div key={dia} className="rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{nome}</p>
              <button onClick={() => addIntervalo(dia)} className="flex items-center gap-1 text-xs font-medium text-[var(--cor-primaria)]">
                <Plus size={12} /> Intervalo
              </button>
            </div>
            {doDia.length === 0 && <p className="mt-1 text-xs text-gray-400">Fechado</p>}
            {doDia.map((h) => (
              <div key={h.id} className="mt-1.5 flex items-center gap-2">
                <input defaultValue={h.abre?.slice(0, 5)} onBlur={(e) => atualizar(h, 'abre', e.target.value)} type="time" className="rounded-lg border p-1.5 text-xs" />
                <span className="text-xs text-gray-400">até</span>
                <input defaultValue={h.fecha?.slice(0, 5)} onBlur={(e) => atualizar(h, 'fecha', e.target.value)} type="time" className="rounded-lg border p-1.5 text-xs" />
                <button onClick={() => excluir(h)} className="text-red-400"><X size={14} /></button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Clientes (CRM) ────────────────────────────────────────────
function ClientesTab({ lojaId }: { lojaId: string }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clientes').select('*').eq('loja_id', lojaId).order('ultimo_pedido', { ascending: false });
      setClientes((data as Cliente[]) ?? []);
      setCarregando(false);
    })();
  }, [lojaId]);

  const enviarMensagem = (c: Cliente) => {
    const texto = mensagem.trim() || `Oi ${c.nome ?? ''}! Temos novidades no cardápio, dá uma olhada 😉`;
    window.open(`https://wa.me/${c.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const visiveis = clientes.filter((c) =>
    !busca || c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca));

  if (carregando) return <p className="py-10 text-center text-sm text-gray-400">Carregando…</p>;

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Toda pessoa que fez login pra pedir vira um contato aqui — use pra reativar quem sumiu ou avisar de promoção.
      </p>

      <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)}
        placeholder="Mensagem padrão pra usar no botão de WhatsApp (opcional — se vazio, manda uma saudação genérica)"
        rows={2} className="mb-3 w-full rounded-xl border p-2.5 text-sm" />

      <div className="mb-3 flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 px-3 py-2 shadow-sm">
        <Search size={16} className="text-gray-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone…"
          className="w-full bg-transparent text-sm outline-none" />
      </div>

      <div className="space-y-2">
        {visiveis.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.nome || '(sem nome)'}</p>
              <p className="truncate text-xs text-gray-400">{c.telefone}{c.email ? ` · ${c.email}` : ''}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {c.total_pedidos} pedido(s){c.ultimo_pedido ? ` · último em ${new Date(c.ultimo_pedido).toLocaleDateString('pt-BR')}` : ''}
              </p>
            </div>
            <button onClick={() => enviarMensagem(c)} className="shrink-0 rounded-lg border p-2 text-green-600">
              <MessageCircle size={16} />
            </button>
          </div>
        ))}
        {visiveis.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum cliente ainda.</p>}
      </div>
    </div>
  );
}

// ── Cashback ──────────────────────────────────────────────────
function CashbackTab({ lojaId }: { lojaId: string }) {
  const [pct, setPct] = useState('0');
  const [pctOriginal, setPctOriginal] = useState('0');
  const [stats, setStats] = useState({ clientesComSaldo: 0, passivoTotal: 0 });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = async () => {
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
  };
  useEffect(() => { setTimeout(carregar, 0); }, [lojaId]);

  const salvar = async () => {
    setSalvando(true); setMsg('');
    const { error } = await supabase.from('lojas').update({ cashback_pct: Number(pct || 0) }).eq('id', lojaId);
    setSalvando(false);
    if (error) return setMsg('Erro ao salvar: ' + error.message);
    setPctOriginal(pct);
    setMsg('Salvo!');
    setTimeout(() => setMsg(''), 2500);
  };

  if (carregando) return <p className="py-10 text-center text-sm text-gray-400">Carregando…</p>;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 rounded-2xl border border-[var(--cor-primaria)]/30 bg-[var(--cor-primaria)]/5 p-4">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-[var(--cor-primaria)]"><Wallet size={15} /> Como funciona</p>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          A cada pedido <b>finalizado</b> feito pelo cardápio online, o cliente ganha de volta um % em saldo — que
          ele pode usar como desconto na próxima compra, direto no checkout. É um dos motivos mais fortes pra ele
          voltar a comprar com você em vez de procurar outro lugar.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Cashback por pedido</span>
          <div className="mt-2 flex items-center gap-2">
            <input type="number" min="0" max="100" step="0.5" value={pct} onChange={(e) => setPct(e.target.value)}
              className="w-28 rounded-xl border-2 border-[var(--cor-primaria)] bg-green-50 p-3 text-center text-2xl font-black text-[var(--cor-primaria)] outline-none dark:bg-green-900/10" />
            <span className="text-xl font-bold text-gray-400">%</span>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">0% desliga o cashback (o saldo que os clientes já têm continua valendo).</p>
        </label>

        {msg && <p className={`mt-3 text-sm font-semibold ${msg.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}
        <button onClick={salvar} disabled={salvando || pct === pctOriginal}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white disabled:opacity-40">
          <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-semibold text-gray-400">Clientes com saldo</p>
          <p className="mt-1 text-xl font-black dark:text-gray-100">{stats.clientesComSaldo}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] font-semibold text-gray-400">Passivo em aberto</p>
          <p className="mt-1 text-xl font-black dark:text-gray-100">{fmt(stats.passivoTotal)}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        "Passivo em aberto" é quanto você já prometeu de volta aos seus clientes — é dinheiro que vai sair como
        desconto quando eles voltarem a comprar. Não é uma cobrança, é só pra você acompanhar o tamanho do compromisso.
      </p>
    </div>
  );
}

// ── Recuperação de vendas ────────────────────────────────────
interface PixPendente {
  id: string; numero: number; identificador_cliente: string; telefone_contato?: string;
  valor_total: number; criado_em: string;
}

function RecuperacaoTab({ lojaId, lojaSlug }: { lojaId: string; lojaSlug: string }) {
  const [subtab, setSubtab] = useState<'pix' | 'carrinhos'>('pix');
  const [pixPendentes, setPixPendentes] = useState<PixPendente[]>([]);
  const [carrinhos, setCarrinhos] = useState<(CarrinhoAbandonado & { nome?: string | null; telefone?: string })[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerandoCupom, setGerandoCupom] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    const corteMinimo = new Date(Date.now() - 15 * 60000).toISOString(); // pelo menos 15min parado, não incomoda quem tá no meio do pagamento
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
  };
  useEffect(() => { setTimeout(carregar, 0); }, [lojaId]);

  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const linkCardapio = `${window.location.origin}/${lojaSlug}`;
  const tempoDecorrido = (iso: string) => {

    const min = Math.floor((agora - new Date(iso).getTime()) / 60000);
    if (min < 60) return `${min}min atrás`;
    if (min < 1440) return `${Math.floor(min / 60)}h atrás`;
    return `${Math.floor(min / 1440)}d atrás`;
  };

  const enviarPix = (p: PixPendente) => {
    if (!p.telefone_contato) return;
    const texto = `Oi ${p.identificador_cliente}! Vi que seu Pix do pedido #${p.numero} (${fmt(Number(p.valor_total))}) não caiu — o código expira rapidinho. Bora tentar de novo? ${linkCardapio}`;
    window.open(`https://wa.me/${p.telefone_contato.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const enviarCarrinho = (c: CarrinhoAbandonado & { nome?: string | null; telefone?: string }, comCupom?: string) => {
    if (!c.telefone) return;
    const saudacao = c.nome ? `Oi ${c.nome}!` : 'Oi!';
    const textoBase = `${saudacao} Vi que você tava montando um pedido aqui (${c.itens_resumo}) e não finalizou. Ainda dá tempo! 😉`;
    const textoCupom = comCupom ? `\n\nUsa o cupom *${comCupom}* e ganha 10% de desconto nessa compra 🎁` : '';
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

  if (carregando) return <p className="py-10 text-center text-sm text-gray-400">Carregando…</p>;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setSubtab('pix')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ${subtab === 'pix' ? 'bg-[var(--cor-primaria)] text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
          <QrCode size={13} /> Pix não pago ({pixPendentes.length})
        </button>
        <button onClick={() => setSubtab('carrinhos')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ${subtab === 'carrinhos' ? 'bg-[var(--cor-primaria)] text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
          <ShoppingCart size={13} /> Carrinhos abandonados ({carrinhos.length})
        </button>
      </div>

      {subtab === 'pix' && (
        <div className="space-y-2">
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Pedidos onde o cliente gerou o Pix mas não pagou — o QR já expirou, mas ele ainda pode voltar e tentar de novo.
          </p>
          {pixPendentes.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold dark:text-gray-100">#{p.numero} · {p.identificador_cliente}</p>
                <p className="text-xs text-gray-400">{fmt(Number(p.valor_total))} · {tempoDecorrido(p.criado_em)}</p>
              </div>
              <button onClick={() => enviarPix(p)} disabled={!p.telefone_contato} className="shrink-0 rounded-lg border p-2 text-green-600 disabled:opacity-30">
                <MessageCircle size={16} />
              </button>
            </div>
          ))}
          {pixPendentes.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum Pix parado nos últimos dias — ótimo sinal! 🎉</p>}
        </div>
      )}

      {subtab === 'carrinhos' && (
        <div className="space-y-2">
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Clientes que abriram o checkout, montaram o pedido, mas não finalizaram. Chame de volta — com ou sem cupom.
          </p>
          {carrinhos.map((c) => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold dark:text-gray-100">{c.nome || 'Cliente'} {c.telefone ? `· ${c.telefone}` : ''}</p>
                  <p className="truncate text-xs text-gray-400">{c.itens_resumo}</p>
                  <p className="text-xs text-gray-400">{fmt(Number(c.valor_estimado))} · {tempoDecorrido(c.atualizado_em)}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => enviarCarrinho(c)} disabled={!c.telefone}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold text-green-600 disabled:opacity-30">
                  <MessageCircle size={13} /> Mensagem simples
                </button>
                <button onClick={() => gerarCupomEEnviar(c)} disabled={!c.telefone || gerandoCupom === c.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--cor-primaria)]/10 py-2 text-xs font-bold text-[var(--cor-primaria)] disabled:opacity-30">
                  <Gift size={13} /> {gerandoCupom === c.id ? 'Gerando…' : 'Enviar com cupom 10%'}
                </button>
              </div>
            </div>
          ))}
          {carrinhos.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum carrinho abandonado recente.</p>}
        </div>
      )}
    </div>
  );
}
