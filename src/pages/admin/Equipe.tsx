import { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Plus, Trash2, Mail, KeyRound, Pencil, X, Eye, EyeOff, RefreshCw,
  ShieldCheck, Store, Bike, UserRound, Copy, Check, UtensilsCrossed,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { MembroEquipe, TipoContrato } from '../../types';
import type { CtxLoja } from './AdminLayout';
import MiseOnLoader from '../../components/MiseOnLoader';
import AprovacaoEntregadores from '../../components/admin/AprovacaoEntregadores';

import { useI18n } from '../../contexts/I18nContext';
const PAPEL_INFO: Record<string, { label: string; icon: typeof ShieldCheck; classe: string }> = {
  admin:      { label: 'Admin',      icon: ShieldCheck,     classe: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  operador:   { label: 'Balcão',     icon: Store,           classe: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  garcom:     { label: 'Garçom',     icon: UtensilsCrossed, classe: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  entregador: { label: 'Entregador', icon: Bike,            classe: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
};

const CONTRATO_LABEL: Record<TipoContrato, string> = {
  CLT: 'CLT', FREELANCE: 'Freelance', PJ: 'PJ', TEMPORARIO: 'Temporário',
};

const dataBr = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

function gerarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  const rnd = new Uint32Array(10);
  crypto.getRandomValues(rnd);
  for (let i = 0; i < 10; i++) s += chars[rnd[i] % chars.length];
  return s;
}

interface FormAcesso {
  nome: string;
  email: string;
  senha: string;
  telefone: string;
  papel: string;
  tipo_contrato: TipoContrato;
}

const FORM_VAZIO: FormAcesso = { nome: '', email: '', senha: '', telefone: '', papel: 'operador', tipo_contrato: 'CLT' };

export default function Equipe() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');

  // criação de acesso
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<FormAcesso>(FORM_VAZIO);
  const [verSenha, setVerSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [credenciais, setCredenciais] = useState<{ email: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // edição
  const [editando, setEditando] = useState<MembroEquipe | null>(null);
  const [formEdit, setFormEdit] = useState<{ nome: string; telefone: string; papel: string; tipo_contrato: TipoContrato; nova_senha: string }>({ nome: '', telefone: '', papel: 'operador', tipo_contrato: 'CLT', nova_senha: '' });

  // convite por e-mail (opcional)
  const [conviteEmail, setConviteEmail] = useState('');
  const [convitePapel, setConvitePapel] = useState('operador');
  const [enviandoConvite, setEnviandoConvite] = useState(false);
  const [msgConvite, setMsgConvite] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista('');
    const { data, error } = await supabase.functions.invoke('equipe-listar', { body: { loja_id: lojaId } });
    if (error || data?.error) setErroLista(String(data?.error ?? error?.message ?? 'Erro ao carregar a equipe'));
    else setEquipe(data?.equipe ?? []);
    setCarregando(false);
  }, [lojaId]);
  useEffect(() => { carregar(); }, [carregar]);

  const abrirCriacao = () => {
    setForm({ ...FORM_VAZIO, senha: gerarSenha() });
    setMsg(null);
    setCredenciais(null);
    setCriando(true);
  };

  const criarAcesso = async () => {
    setMsg(null);
    if (!form.nome.trim()) return setMsg({ tipo: 'erro', texto: 'Informe o nome do funcionário.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setMsg({ tipo: 'erro', texto: 'Informe um e-mail válido (será o usuário de login).' });
    if (form.senha.length < 6) return setMsg({ tipo: 'erro', texto: 'A senha precisa ter no mínimo 6 caracteres.' });

    setSalvando(true);
    const { data, error } = await supabase.functions.invoke('equipe-convidar', {
      body: {
        acao: 'criar',
        loja_id: lojaId,
        email: form.email.trim().toLowerCase(),
        senha: form.senha,
        nome: form.nome.trim(),
        telefone: form.telefone.trim() || null,
        papel: form.papel,
        tipo_contrato: form.tipo_contrato,
      },
    });
    setSalvando(false);
    if (error || data?.error) return setMsg({ tipo: 'erro', texto: String(data?.error ?? error?.message ?? 'Erro ao criar o acesso') });

    setCredenciais({ email: form.email.trim().toLowerCase(), senha: form.senha });
    setMsg({
      tipo: 'ok',
      texto: data?.conta_existia
        ? 'Este e-mail já tinha conta — o vínculo com a sua loja foi criado (a senha antiga continua valendo).'
        : 'Acesso criado com sucesso! Anote e repasse as credenciais abaixo.',
    });
    carregar();
  };

  const copiarCredenciais = async () => {
    if (!credenciais) return;
    const rota = form.papel === 'entregador' ? '/entregador' : '/admin';
    await navigator.clipboard.writeText(
      `Acesso MiseOn\nLink: ${window.location.origin}${rota}\nUsuário: ${credenciais.email}\nSenha: ${credenciais.senha}`,
    );
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const abrirEdicao = (m: MembroEquipe) => {
    setFormEdit({
      nome: m.nome ?? '',
      telefone: m.telefone ?? '',
      papel: m.papel,
      tipo_contrato: m.tipo_contrato ?? 'CLT',
      nova_senha: '',
    });
    setMsg(null);
    setEditando(m);
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    if (formEdit.nova_senha && formEdit.nova_senha.length < 6) return setMsg({ tipo: 'erro', texto: 'A nova senha precisa ter no mínimo 6 caracteres.' });
    setSalvando(true);
    const { data, error } = await supabase.functions.invoke('equipe-convidar', {
      body: {
        acao: 'atualizar',
        loja_id: lojaId,
        user_id: editando.user_id,
        nome: formEdit.nome.trim() || null,
        telefone: formEdit.telefone.trim() || null,
        papel: formEdit.papel,
        tipo_contrato: formEdit.tipo_contrato,
        nova_senha: formEdit.nova_senha || undefined,
      },
    });
    setSalvando(false);
    if (error || data?.error) return setMsg({ tipo: 'erro', texto: String(data?.error ?? error?.message ?? 'Erro ao salvar') });
    setEditando(null);
    carregar();
  };

  const remover = async (m: MembroEquipe) => {
    if (!confirm(`Remover ${m.nome || m.email} da equipe? A pessoa perde o acesso à loja imediatamente.`)) return;
    const { data, error } = await supabase.functions.invoke('equipe-convidar', {
      body: { loja_id: lojaId, remover_user_id: m.user_id },
    });
    if (error || data?.error) alert('Erro ao remover: ' + String(data?.error ?? error?.message));
    carregar();
  };

  const convidar = async () => {
    if (!conviteEmail.trim()) return;
    setEnviandoConvite(true); setMsgConvite('');
    const { data, error } = await supabase.functions.invoke('equipe-convidar', {
      body: { loja_id: lojaId, email: conviteEmail.trim(), papel: convitePapel },
    });
    setEnviandoConvite(false);
    if (error || data?.error) return setMsgConvite('Erro: ' + String(data?.error ?? error?.message));
    setMsgConvite(`Convite enviado para ${conviteEmail}.`);
    setConviteEmail('');
    carregar();
  };

  const inputCls = 'mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm outline-none focus:border-[var(--cor-primaria)] dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100';

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold dark:text-gray-100">Equipe &amp; Acessos</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{tDynamic('Crie logins com usuário e senha para o painel, balcão e app do entregador.')}</p>
        </div>
        <button onClick={abrirCriacao} className="flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110">
          <Plus size={16} /> Criar acesso
        </button>
      </div>

      <AprovacaoEntregadores lojaId={lojaId} />

      {/* ── Lista de membros ── */}
      {carregando ? (
        <div className="flex h-64 items-center justify-center">
          <MiseOnLoader status="Carregando equipe..." rows={2} />
        </div>
      ) : erroLista ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          {erroLista}
          <button onClick={carregar} className="ml-2 inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={12} /> Tentar de novo</button>
        </div>
      ) : (
        <div className="space-y-2">
          {equipe.map((m) => {
            const papel = PAPEL_INFO[m.papel] ?? PAPEL_INFO.operador;
            const Icone = papel.icon;
            return (
              <div key={m.user_id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      {m.nome ? <span className="text-sm font-black">{m.nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}</span> : <UserRound size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold dark:text-gray-100">
                        {m.nome || m.email}
                        {m.sou_eu && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs opacity-90 font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">você</span>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{m.email}{m.telefone ? ` · ${m.telefone}` : ''}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs opacity-95 font-bold ${papel.classe}`}><Icone size={11} /> {papel.label}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs opacity-95 font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{CONTRATO_LABEL[m.tipo_contrato] ?? m.tipo_contrato}</span>
                        <span className="text-xs opacity-95 text-gray-400">Desde {dataBr(m.criado_em)}</span>
                        <span className="text-xs opacity-95 text-gray-400">· Último acesso: {m.ultimo_acesso ? dataBr(m.ultimo_acesso) : 'nunca entrou'}</span>
                      </div>
                    </div>
                  </div>
                  {!m.sou_eu && (
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => abrirEdicao(m)} title="Editar / redefinir senha" className="rounded-lg border border-gray-200 p-2 text-gray-400 transition hover:text-blue-500 dark:border-gray-700"><Pencil size={14} /></button>
                      <button onClick={() => remover(m)} title="Remover da equipe" className="rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {equipe.length === 0 && <p className="py-6 text-center text-sm text-gray-400">{tDynamic('Só você por enquanto. Crie o primeiro acesso da sua equipe.')}</p>}
        </div>
      )}

      {/* ── Convite por e-mail (opcional) ── */}
      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold dark:text-gray-200"><Mail size={15} /> {tDynamic('Convidar por e-mail (opcional)')}</p>
        <p className="mb-3 text-xs opacity-95 text-gray-400">{tDynamic('A pessoa recebe um link para definir a própria senha. Se o e-mail não chegar, use o botão')} <b>Criar acesso</b> acima — funciona na hora, sem depender de e-mail.</p>
        <div className="flex gap-2">
          <input value={conviteEmail} onChange={(e) => setConviteEmail(e.target.value)} placeholder="email@exemplo.com"
            className="flex-1 rounded-xl border border-gray-300 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
          <select value={convitePapel} onChange={(e) => setConvitePapel(e.target.value)} className="rounded-xl border border-gray-300 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            <option value="admin">Admin</option>
            <option value="operador">Balcão</option>
            <option value="garcom">Garçom</option>
            <option value="entregador">Entregador</option>
          </select>
          <button onClick={convidar} disabled={enviandoConvite}
            className="rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300">
            {enviandoConvite ? 'Enviando…' : 'Convidar'}
          </button>
        </div>
        {msgConvite && <p className={`mt-2 text-xs font-medium ${msgConvite.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>{msgConvite}</p>}
      </div>

      {/* ── Modal: criar acesso ── */}
      {criando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !salvando && setCriando(false)}>
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-black dark:text-gray-100"><KeyRound size={18} className="text-[var(--cor-primaria)]" /> Criar acesso</h3>
              <button onClick={() => setCriando(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {credenciais ? (
              <div>
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/30">
                  <p className="mb-2 text-sm font-bold text-green-700 dark:text-green-400">✅ Acesso criado! Repasse para o funcionário:</p>
                  <p className="font-mono text-sm dark:text-gray-100"><b>Usuário:</b> {credenciais.email}</p>
                  <p className="font-mono text-sm dark:text-gray-100"><b>Senha:</b> {credenciais.senha}</p>
                  <p className="mt-1 font-mono text-xs text-gray-500">Login em: {window.location.origin}{form.papel === 'entregador' ? '/entregador' : '/admin'}</p>
                </div>
                <p className="mt-2 text-xs opacity-95 text-gray-400">{tDynamic('A senha não fica visível depois — copie agora. Se perder, é só redefinir na edição do membro.')}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={copiarCredenciais} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 py-2.5 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    {copiado ? <Check size={15} className="text-green-500" /> : <Copy size={15} />} {copiado ? 'Copiado!' : 'Copiar credenciais'}
                  </button>
                  <button onClick={() => setCriando(false)} className="flex-1 rounded-xl bg-[var(--cor-primaria)] py-2.5 text-sm font-bold text-white">Concluir</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Nome completo *</span>
                  <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex: João da Silva" className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{tDynamic('E-mail (será o usuário de login) *')}</span>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="joao@exemplo.com" className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Senha *</span>
                  <div className="mt-1 flex gap-2">
                    <div className="relative flex-1">
                      <input value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} type={verSenha ? 'text' : 'password'} className={`${inputCls} mt-0 pr-10`} />
                      <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                        {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button type="button" onClick={() => { setForm({ ...form, senha: gerarSenha() }); setVerSenha(true); }} className="rounded-xl border border-gray-300 px-3 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300" title="Gerar senha forte">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Telefone / WhatsApp</span>
                  <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" className={inputCls} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Função *</span>
                    <select value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value })} className={inputCls}>
                      <option value="admin">Admin (tudo)</option>
                      <option value="operador">{tDynamic('Balcão (pedidos)')}</option>
                      <option value="garcom">Garçom (mesas)</option>
                      <option value="entregador">Entregador (app)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{tDynamic('Tipo de contrato')}</span>
                    <select value={form.tipo_contrato} onChange={(e) => setForm({ ...form, tipo_contrato: e.target.value as TipoContrato })} className={inputCls}>
                      <option value="CLT">CLT</option>
                      <option value="FREELANCE">Freelance</option>
                      <option value="PJ">PJ</option>
                      <option value="TEMPORARIO">Temporário</option>
                    </select>
                  </label>
                </div>
                {form.papel === 'entregador' && (
                  <p className="rounded-xl bg-emerald-50 p-3 text-xs opacity-95 font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                    🛵 O cadastro do entregador é criado junto — ele já consegue entrar no app de entregas com este login.
                  </p>
                )}
                {msg && <p className={`text-sm font-semibold ${msg.tipo === 'erro' ? 'text-red-500' : 'text-green-600'}`}>{msg.texto}</p>}
                <button onClick={criarAcesso} disabled={salvando} className="mt-1 w-full rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-md disabled:opacity-50">
                  {salvando ? 'Criando acesso…' : 'Criar login'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: editar membro ── */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !salvando && setEditando(null)}>
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-black dark:text-gray-100">Editar membro</h3>
              <button onClick={() => setEditando(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">{editando.email} · acesso criado em {dataBr(editando.criado_em)}</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Nome</span>
                <input value={formEdit.nome} onChange={(e) => setFormEdit({ ...formEdit, nome: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Telefone</span>
                <input value={formEdit.telefone} onChange={(e) => setFormEdit({ ...formEdit, telefone: e.target.value })} className={inputCls} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Função</span>
                  <select value={formEdit.papel} onChange={(e) => setFormEdit({ ...formEdit, papel: e.target.value })} className={inputCls}>
                    <option value="admin">Admin</option>
                    <option value="operador">Balcão</option>
                    <option value="garcom">Garçom</option>
                    <option value="entregador">Entregador</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{tDynamic('Tipo de contrato')}</span>
                  <select value={formEdit.tipo_contrato} onChange={(e) => setFormEdit({ ...formEdit, tipo_contrato: e.target.value as TipoContrato })} className={inputCls}>
                    <option value="CLT">CLT</option>
                    <option value="FREELANCE">Freelance</option>
                    <option value="PJ">PJ</option>
                    <option value="TEMPORARIO">Temporário</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{tDynamic('Redefinir senha (deixe em branco para manter a atual)')}</span>
                <div className="mt-1 flex gap-2">
                  <input value={formEdit.nova_senha} onChange={(e) => setFormEdit({ ...formEdit, nova_senha: e.target.value })} placeholder="Nova senha" className={`${inputCls} mt-0 flex-1`} />
                  <button type="button" onClick={() => setFormEdit({ ...formEdit, nova_senha: gerarSenha() })} className="rounded-xl border border-gray-300 px-3 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300" title="Gerar senha forte">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </label>
              {msg && <p className={`text-sm font-semibold ${msg.tipo === 'erro' ? 'text-red-500' : 'text-green-600'}`}>{msg.texto}</p>}
              <button onClick={salvarEdicao} disabled={salvando} className="w-full rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-md disabled:opacity-50">
                {salvando ? 'Salvando…' : 'Salvar alterações'}
              </button>
              {formEdit.nova_senha && (
                <p className="text-xs opacity-95 text-gray-400">⚠ Ao salvar, a senha vira <b className="font-mono">{formEdit.nova_senha}</b> — repasse para o funcionário.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
