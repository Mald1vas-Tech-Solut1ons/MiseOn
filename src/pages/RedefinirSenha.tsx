import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { KeyRound, AlertCircle, CheckCircle2, ShieldCheck, Mail } from 'lucide-react';
import MiseOnLogo from '../components/MiseOnLogo';
import { supabase } from '../lib/supabase';
import LanguageToggle from '../components/LanguageToggle';
import { useI18n } from '../contexts/I18nContext';

type Estado = 'verificando' | 'formulario' | 'invalido' | 'sucesso';

/**
 * Destino do "voltar para o login" depois de trocar a senha. O portal vem
 * na própria URL do link de recuperação (§ superadmin/admin Login.tsx),
 * porque nesse ponto o usuário só tem uma sessão de recuperação — não dá
 * para inferir de onde ele veio.
 */
const LOGIN_POR_PORTAL: Record<string, string> = {
  superadmin: '/superadmin/login',
  admin: '/admin/login',
};

export default function RedefinirSenha() {
  const { tDynamic } = useI18n();
  const [params] = useSearchParams();
  const portal = params.get('portal') ?? 'admin';
  const loginUrl = LOGIN_POR_PORTAL[portal] ?? '/admin/login';

  const [estado, setEstado] = useState<Estado>('verificando');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Re-envio direto na tela de link expirado
  const [emailResend, setEmailResend] = useState('');
  const [resendEnviando, setResendEnviando] = useState(false);
  const [resendSucesso, setResendSucesso] = useState('');
  const [resendErro, setResendErro] = useState('');

  // O Supabase processa o token do e-mail (na URL) sozinho ao carregar o
  // cliente e dispara PASSWORD_RECOVERY quando a sessão temporária de troca
  // de senha fica pronta. Sem esse evento em alguns segundos, o link já
  // era — expirado, usado, ou adulterado.
  useEffect(() => {
    // 1. Detectar erro de token de e-mail expirado ou invalido na URL (hash/search)
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes('error') || search.includes('error') || params.get('erro') === 'expirado') {
      setEstado('invalido');
      return;
    }

    const { data: assinatura } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY' || evento === 'SIGNED_IN') setEstado('formulario');
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setEstado('formulario');
    });

    const espera = setTimeout(() => {
      setEstado((atual) => (atual === 'verificando' ? 'invalido' : atual));
    }, 4000);

    return () => {
      assinatura.subscription.unsubscribe();
      clearTimeout(espera);
    };
  }, [params]);

  const redefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha !== confirmarSenha) return setErro('As senhas não coincidem.');

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) return setErro('Não foi possível trocar a senha. Tente pedir um novo link.');

    // A sessão de recuperação não deve virar uma sessão normal logada —
    // o usuário entra de novo pela tela de login, com a senha nova.
    await supabase.auth.signOut();
    setEstado('sucesso');
  };

  const enviarNovoLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailResend) return setResendErro('Digite seu e-mail para receber o link.');

    setResendErro('');
    setResendSucesso('');
    setResendEnviando(true);

    const { error } = await supabase.auth.resetPasswordForEmail(emailResend, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setResendEnviando(false);

    if (error) {
      setResendErro('Erro ao enviar o e-mail. Verifique se o e-mail está correto.');
      return;
    }

    setResendSucesso(`Enviamos um novo link de redefinição para ${emailResend}. Verifique sua caixa de entrada!`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl dark:border dark:border-gray-800 dark:bg-gray-900">
        <div className="p-4 pb-0 flex justify-end">
          <LanguageToggle variant="pill" />
        </div>
        <div className="p-8 pb-6 text-center">
          <div className="mb-6 flex justify-center">
            <MiseOnLogo size={160} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {tDynamic('Redefinir senha')}
          </h1>
        </div>

        <div className="px-8 pb-8">
          {estado === 'verificando' && (
            <div className="flex flex-col items-center gap-3 py-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--cor-primaria)]" />
              {tDynamic('Confirmando seu link…')}
            </div>
          )}

          {estado === 'invalido' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle size={32} className="text-red-500" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tDynamic('Este link expirou, já foi usado, ou não é válido.')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tDynamic('Informe seu e-mail abaixo para receber um novo link de redefinição instantâneo:')}
              </p>

              {resendErro && (
                <div className="w-full text-left flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p>{resendErro}</p>
                </div>
              )}

              {resendSucesso && (
                <div className="w-full text-left flex items-start gap-2 rounded-xl bg-green-50 p-3 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <p>{resendSucesso}</p>
                </div>
              )}

              <form onSubmit={enviarNovoLink} className="w-full mt-2 text-left space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    required
                    value={emailResend}
                    onChange={(e) => setEmailResend(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--cor-primaria)] focus:bg-white focus:ring-4 focus:ring-[var(--cor-primaria)]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resendEnviando}
                  className="flex w-full items-center justify-center rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-md shadow-[var(--cor-primaria)]/30 transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {resendEnviando ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    tDynamic('Enviar novo link por e-mail')
                  )}
                </button>
              </form>

              <div className="mt-4 pt-2 border-t border-gray-100 dark:border-gray-800 w-full">
                <Link
                  to={loginUrl}
                  className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:underline"
                >
                  {tDynamic('← Voltar para o login')}
                </Link>
              </div>
            </div>
          )}

          {estado === 'sucesso' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <ShieldCheck size={32} className="text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tDynamic('Senha alterada com sucesso.')}
              </p>
              <Link
                to={loginUrl}
                className="mt-2 rounded-xl bg-[var(--cor-primaria)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                {tDynamic('Entrar com a senha nova')}
              </Link>
            </div>
          )}

          {estado === 'formulario' && (
            <form onSubmit={redefinir}>
              <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
                {tDynamic('Escolha uma senha nova para sua conta.')}
              </p>

              {erro && (
                <div className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>{erro}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    type="password"
                    required
                    minLength={8}
                    autoFocus
                    placeholder="Senha nova (mínimo 8 caracteres)"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--cor-primaria)] focus:bg-white focus:ring-4 focus:ring-[var(--cor-primaria)]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-900"
                  />
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    type="password"
                    required
                    minLength={8}
                    placeholder="Confirme a senha nova"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--cor-primaria)] focus:bg-white focus:ring-4 focus:ring-[var(--cor-primaria)]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-900"
                  />
                </div>
              </div>

              <button
                disabled={salvando}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-[var(--cor-primaria)] py-3.5 font-bold text-white shadow-lg shadow-[var(--cor-primaria)]/30 transition-all hover:opacity-90 disabled:opacity-50"
              >
                {salvando ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <CheckCircle2 size={18} className="mr-2" />
                    Salvar senha nova
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
