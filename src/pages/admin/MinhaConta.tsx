import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { mensagemDeErro } from '../../lib/edgeFunctionErro';
import { User as UserIcon, Lock, Mail, Phone, ShieldCheck, Loader2, CheckCircle2, AlertCircle, KeyRound, X, RefreshCw, ArrowRight, LogOut } from 'lucide-react';
import MiseOnLoader from '../../components/MiseOnLoader';

import { useI18n } from '../../contexts/I18nContext';
import { useAcessibilidade } from '../../contexts/AcessibilidadeContext';
import { MonitorUp } from 'lucide-react';
export default function MinhaConta() {
  const { tDynamic } = useI18n();
  const { escalaFonte, setEscalaFonte } = useAcessibilidade();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [msgSenha, setMsgSenha] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Encerrar sessao em TODOS os aparelhos.
  //
  // Existe porque a sessao do MiseOn nao expira sozinha: limitar duracao de
  // sessao no servidor e recurso de plano Pro do Supabase, e o projeto esta no
  // Free — conferido pela API deles em 01/09/2026, que responde
  // "User sessions can only be configured on Pro Plans and up".
  //
  // Nao foi implementado um "desloga por inatividade" no lugar DE PROPOSITO: o
  // KDS da cozinha e o painel de TV ficam horas abertos sem ninguem tocar, e um
  // timer desses derrubaria justamente as telas que precisam ficar de pe no
  // meio do servico. Trocaria risco de seguranca por falha de operacao.
  //
  // Isto aqui nao encurta a sessao — da o controle de cortar quando importa:
  // celular perdido, aparelho vendido, funcionario desligado.
  const [saindoDeTodos, setSaindoDeTodos] = useState(false);

  const sairDeTodosOsDispositivos = async () => {
    const ok = window.confirm(
      'Isto encerra a sua sessão em TODOS os aparelhos, inclusive neste. '
      + 'Telas que ficam abertas na operação (KDS da cozinha, painel de TV, PDV) '
      + 'vão precisar entrar de novo. Continuar?',
    );
    if (!ok) return;
    setSaindoDeTodos(true);
    // `scope: 'global'` invalida os refresh tokens da conta no servidor, nao
    // so o token deste navegador — e o que faz um aparelho perdido perder o
    // acesso de verdade.
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    setSaindoDeTodos(false);
    if (error) {
      setMsgSenha({ tipo: 'erro', texto: 'Não foi possível encerrar as sessões: ' + error.message });
      return;
    }
    window.location.href = '/admin/login';
  };

  // Perfil (Metadata)
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [msgPerfil, setMsgPerfil] = useState<{ tipo: 'sucesso' | 'erro' | 'aviso'; texto: string } | null>(null);

  // Modal / Estado de Verificação OTP para troca de E-mail
  const [modalOtpAberto, setModalOtpAberto] = useState(false);
  const [novoEmailPendente, setNovoEmailPendente] = useState('');
  const [codigoOtp, setCodigoOtp] = useState('');
  const [verificandoOtp, setVerificandoOtp] = useState(false);
  const [enviandoOtp, setEnviandoOtp] = useState(false);
  const [msgOtp, setMsgOtp] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setEmail(user?.email || '');
      setNome(user?.user_metadata?.full_name || user?.user_metadata?.nome || '');
      setTelefone(user?.user_metadata?.phone || user?.user_metadata?.telefone || '');
      setLoading(false);
    });
  }, []);

  // ── ALTERAR SENHA COM VERIFICAÇÃO DE SENHA ATUAL ─────────────
  const alterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSenha(null);

    if (!senhaAtual) {
      return setMsgSenha({ tipo: 'erro', texto: 'Informe sua senha atual por segurança.' });
    }
    if (novaSenha.length < 6) {
      return setMsgSenha({ tipo: 'erro', texto: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }
    if (novaSenha !== confirmaSenha) {
      return setMsgSenha({ tipo: 'erro', texto: 'As senhas não coincidem.' });
    }

    setSalvandoSenha(true);

    const { data, error } = await supabase.functions.invoke('conta-atualizar', {
      body: { acao: 'alterar_senha', senha_atual: senhaAtual, nova_senha: novaSenha },
    });

    setSalvandoSenha(false);

    const falha = await mensagemDeErro(error, data, 'Erro ao alterar senha. Verifique se a senha atual está correta.');
    if (falha) {
      setMsgSenha({ tipo: 'erro', texto: falha });
    } else {
      setMsgSenha({ tipo: 'sucesso', texto: 'Senha alterada com sucesso e segurança!' });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmaSenha('');
      setTimeout(() => setMsgSenha(null), 5000);
    }
  };

  // ── SALVAR PERFIL (NOME, TELEFONE) & SOLICITAR OTP SE EMAIL MUDOU ──
  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgPerfil(null);
    setSalvandoPerfil(true);

    // 1. Atualiza metadados (nome, telefone)
    const { error: errMeta } = await supabase.auth.updateUser({
      data: { full_name: nome, nome, telefone, phone: telefone }
    });

    // 2. Se o e-mail foi alterado, solicita código OTP por segurança
    const emailMudou = email.trim().toLowerCase() !== user?.email?.toLowerCase();

    if (emailMudou && email.trim()) {
      setEnviandoOtp(true);
      setNovoEmailPendente(email.trim().toLowerCase());

      const { data: resOtp, error: errOtp } = await supabase.functions.invoke('conta-atualizar', {
        body: { acao: 'solicitar_troca_email', novo_email: email.trim() },
      });

      setEnviandoOtp(false);
      setSalvandoPerfil(false);

      const falhaOtp = await mensagemDeErro(errOtp, resOtp, 'Erro ao solicitar código de verificação para o novo e-mail.');
      if (falhaOtp) {
        setMsgPerfil({ tipo: 'erro', texto: falhaOtp });
        return;
      }

      // Abre o modal de OTP para o usuário digitar o código enviado por e-mail
      setCodigoOtp('');
      setMsgOtp(null);
      setModalOtpAberto(true);
      if (!errMeta) {
        setMsgPerfil({ tipo: 'aviso', texto: 'Nome e telefone salvos. Digite o código enviado para o seu novo e-mail para finalizar a troca.' });
      }
      return;
    }

    setSalvandoPerfil(false);

    if (errMeta) {
      setMsgPerfil({ tipo: 'erro', texto: 'Erro ao atualizar dados: ' + errMeta.message });
    } else {
      setMsgPerfil({ tipo: 'sucesso', texto: 'Dados pessoais atualizados com sucesso!' });
      setTimeout(() => setMsgPerfil(null), 4000);
    }
  };

  // ── CONFIRMAR CÓDIGO OTP E TROCAR E-MAIL ────────────────────
  const confirmarTrocaEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgOtp(null);

    if (!codigoOtp || codigoOtp.trim().length !== 6) {
      return setMsgOtp({ tipo: 'erro', texto: 'Digite o código de 6 dígitos numéricos.' });
    }

    setVerificandoOtp(true);

    const { data, error } = await supabase.functions.invoke('conta-atualizar', {
      body: { acao: 'confirmar_email', novo_email: novoEmailPendente, codigo: codigoOtp.trim() },
    });

    setVerificandoOtp(false);

    const falhaVerificar = await mensagemDeErro(error, data, 'Erro ao verificar código.');
    if (falhaVerificar) {
      setMsgOtp({ tipo: 'erro', texto: falhaVerificar });
    } else {
      setMsgOtp({ tipo: 'sucesso', texto: 'E-mail alterado com sucesso!' });
      setTimeout(async () => {
        setModalOtpAberto(false);
        const { data: { user: updatedUser } } = await supabase.auth.getUser();
        if (updatedUser) {
          setUser(updatedUser);
          setEmail(updatedUser.email || '');
        }
        setMsgPerfil({ tipo: 'sucesso', texto: 'E-mail de login atualizado com sucesso!' });
      }, 1500);
    }
  };

  // Reenviar Código OTP
  const reenviarOtp = async () => {
    setEnviandoOtp(true);
    setMsgOtp(null);

    const { data, error } = await supabase.functions.invoke('conta-atualizar', {
      body: { acao: 'solicitar_troca_email', novo_email: novoEmailPendente },
    });

    setEnviandoOtp(false);

    const falhaReenvio = await mensagemDeErro(error, data, 'Erro ao reenviar código.');
    if (falhaReenvio) {
      setMsgOtp({ tipo: 'erro', texto: falhaReenvio });
    } else {
      setMsgOtp({ tipo: 'sucesso', texto: 'Novo código de 6 dígitos enviado para sua caixa de entrada!' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <MiseOnLoader status="Carregando dados da conta..." rows={2} />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="font-black text-2xl dark:text-gray-100 flex items-center gap-2">
          <UserIcon size={24} className="text-[var(--cor-primaria)]" /> Minha Conta
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {tDynamic('Gerencie seus dados de acesso e segurança como parceiro MiseOn.')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* COLUNA 1: DADOS PESSOAIS */}
        <div className="space-y-6">
          <form onSubmit={salvarPerfil} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <ShieldCheck size={18} className="text-blue-500" /> Dados Pessoais
            </h3>

            {msgPerfil && (
              <div className={`mb-4 rounded-xl p-3 flex items-center gap-2 text-sm font-semibold ${msgPerfil.tipo === 'sucesso' ? 'bg-green-500/10 text-green-500' : msgPerfil.tipo === 'aviso' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                {msgPerfil.tipo === 'sucesso' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                <span>{msgPerfil.texto}</span>
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">{tDynamic('E-mail de Acesso (Login)')}</span>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--cor-primaria)] dark:text-white" 
                  />
                </div>
                <p className="text-xs opacity-90 text-gray-400 mt-1">{tDynamic('Ao alterar o e-mail, enviaremos um código OTP de 6 dígitos para confirmação por segurança.')}</p>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Nome Completo</span>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--cor-primaria)] dark:text-white" 
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Telefone Pessoal</span>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="tel" 
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--cor-primaria)] dark:text-white" 
                  />
                </div>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={salvandoPerfil || enviandoOtp}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all"
            >
              {salvandoPerfil || enviandoOtp ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Salvar Perfil
            </button>
          </form>

          {/* ACESSIBILIDADE WCAG */}
          <div data-tour="tour-acessibilidade" className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <MonitorUp size={18} className="text-[var(--cor-primaria)]" /> {tDynamic('Acessibilidade Visual (WCAG 2.1)')}
            </h3>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {tDynamic('Ajuste o tamanho de todas as letras do sistema de acordo com a sua preferência. O MiseOn adapta toda a interface proporcionalmente sem quebrar telas.')}
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEscalaFonte('padrao')}
                className={`py-2 px-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  escalaFonte === 'padrao' 
                    ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)] font-bold' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider">{tDynamic('Padrão')}</span>
                <span className="text-[10px] opacity-70">100%</span>
              </button>

              <button
                type="button"
                onClick={() => setEscalaFonte('grande')}
                className={`py-2 px-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  escalaFonte === 'grande' 
                    ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)] font-bold' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                <span className="text-sm font-bold uppercase tracking-wider">{tDynamic('Grande')}</span>
                <span className="text-[10px] opacity-70">110%</span>
              </button>

              <button
                type="button"
                onClick={() => setEscalaFonte('maximo')}
                className={`py-2 px-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  escalaFonte === 'maximo' 
                    ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)] font-bold' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                <span className="text-base font-bold uppercase tracking-wider">{tDynamic('Máximo')}</span>
                <span className="text-[10px] opacity-70">120%</span>
              </button>
            </div>
          </div>
        </div>

        {/* COLUNA 2: SEGURANÇA E SENHA */}
        <div className="space-y-6">
          <form onSubmit={alterarSenha} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <Lock size={18} className="text-orange-500" /> {tDynamic('Segurança e Senha')}
            </h3>

            {msgSenha && (
              <div className={`mb-4 rounded-xl p-3 flex items-center gap-2 text-sm font-semibold ${msgSenha.tipo === 'sucesso' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {msgSenha.tipo === 'sucesso' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                <span>{msgSenha.texto}</span>
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Senha Atual *</span>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="password" 
                    required
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    placeholder="Sua senha atual"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 dark:text-white" 
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Nova Senha *</span>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="password" 
                    required
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 dark:text-white" 
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Confirmar Nova Senha *</span>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="password" 
                    required
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 dark:text-white" 
                  />
                </div>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={salvandoSenha || !senhaAtual || !novaSenha || !confirmaSenha}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] text-white py-3 text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-[var(--cor-primaria)]/20"
            >
              {salvandoSenha ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              Atualizar Senha
            </button>
          </form>

          {/* ── Encerrar sessão em todos os aparelhos ── */}
          <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
              <LogOut size={15} /> {tDynamic('Aparelhos conectados')}
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {tDynamic('Sua conta continua conectada em todo aparelho onde você entrou, até sair. Se perdeu um celular, vendeu um tablet ou desligou alguém da equipe, encerre tudo aqui e entre de novo só onde precisa.')}
            </p>
            <button
              type="button"
              onClick={sairDeTodosOsDispositivos}
              disabled={saindoDeTodos}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 transition-all disabled:opacity-60"
            >
              {saindoDeTodos
                ? <Loader2 size={15} className="animate-spin" />
                : <LogOut size={15} />}
              {tDynamic('Desconectar todos os aparelhos')}
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL OTP: CONFIRMAÇÃO DE TROCA DE E-MAIL ── */}
      {modalOtpAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !verificandoOtp && setModalOtpAberto(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-[var(--cor-primaria)]">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold dark:text-gray-100">{tDynamic('Verificação de Segurança')}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{tDynamic('Confirmação de alteração de e-mail')}</p>
                </div>
              </div>
              <button onClick={() => setModalOtpAberto(false)} disabled={verificandoOtp} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 p-4 mb-4 border border-orange-100 dark:border-orange-900/40 text-xs text-orange-900 dark:text-orange-300">
              <p className="font-semibold">{tDynamic('Enviamos um código de 6 dígitos para:')}</p>
              <p className="font-bold text-sm font-mono text-orange-600 dark:text-orange-400 mt-1">{novoEmailPendente}</p>
              <p className="mt-2 text-xs opacity-95 text-orange-700/80 dark:text-orange-400/80">{tDynamic('Verifique sua caixa de entrada e spam. O código é válido por 10 minutos.')}</p>
            </div>

            {msgOtp && (
              <div className={`mb-4 rounded-xl p-3 flex items-center gap-2 text-xs font-semibold ${msgOtp.tipo === 'sucesso' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {msgOtp.tipo === 'sucesso' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                <span>{msgOtp.texto}</span>
              </div>
            )}

            <form onSubmit={confirmarTrocaEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 text-center">{tDynamic('Código de 6 dígitos')}</label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  value={codigoOtp}
                  onChange={(e) => setCodigoOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-[12px] font-mono text-2xl font-bold py-3.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 focus:border-[var(--cor-primaria)] focus:outline-none dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={reenviarOtp}
                  disabled={enviandoOtp || verificandoOtp}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 py-3 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {enviandoOtp ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Reenviar código
                </button>

                <button
                  type="submit"
                  disabled={verificandoOtp || codigoOtp.length !== 6}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] text-white py-3 text-xs font-bold disabled:opacity-50 hover:brightness-110 transition-all shadow-md shadow-[var(--cor-primaria)]/20"
                >
                  {verificandoOtp ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  Confirmar Troca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
