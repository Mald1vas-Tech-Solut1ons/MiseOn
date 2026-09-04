import { useState } from 'react';
import MiseOnLogo from '../../components/MiseOnLogo';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

import { useI18n } from '../../contexts/I18nContext';
export default function Login() {
  const { tDynamic } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [modo, setModo] = useState<'SENHA' | 'MAGIC_LINK' | 'REDEFINIR'>('SENHA');

  const tratarErro = (error: any) => {
    if (error.message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (error.message.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
    return 'Ocorreu um erro ao tentar entrar. Tente novamente.';
  };

  const entrarComSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(''); setSucesso(''); setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    
    if (error) {
      setErro(tratarErro(error));
      return;
    }
    // /admin decide o destino por papel: admin cai no Dashboard (inicio),
    // operador/entregador são redirecionados para a operação.
    nav('/admin');
  };

  const enviarMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setErro('Digite seu e-mail para receber o link.');
    
    setErro(''); setSucesso(''); setCarregando(true);
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` }
    });
    setCarregando(false);

    if (error) {
      setErro('Erro ao enviar o link. Verifique se o e-mail está correto.');
      return;
    }
    setSucesso('Te enviamos um link mágico! Verifique sua caixa de entrada e clique nele para entrar sem senha.');
  };

  const enviarRedefinicaoSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setErro('Digite seu e-mail para receber o link de redefinição de senha.');
    
    setErro(''); setSucesso(''); setCarregando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setCarregando(false);

    if (error) {
      setErro('Erro ao enviar o e-mail. Verifique se o e-mail está correto.');
      return;
    }
    setSucesso('Enviamos o e-mail de redefinição de senha! Abra sua caixa de entrada e clique no botão para criar sua senha nova.');
  };

  const entrarComGoogle = async () => {
    setCarregando(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-gray-900 dark:border-gray-800 shadow-xl dark:bg-gray-900 dark:border dark:border-gray-800">
        
        <div className="p-8 pb-6 text-center">
          <div className="flex justify-center mb-6">
            <Link to="/" className="inline-block transition hover:scale-105 active:scale-95">
              <MiseOnLogo size={160} />
            </Link>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{tDynamic('Bem-vindo de volta')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tDynamic('Entre para gerenciar sua operação')}</p>
        </div>

        <div className="px-8 pb-8">
          {erro && (
            <div className="mb-6 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{erro}</p>
            </div>
          )}

          {sucesso && (
            <div className="mb-6 flex items-start gap-2 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <p>{sucesso}</p>
            </div>
          )}

          <button
            type="button"
            onClick={entrarComGoogle}
            disabled={carregando}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 dark:border-gray-800 py-3 font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4c-7.5 0-13.9 4.3-17.7 10.7z" /><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.9 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.9 39.6 16.4 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.7l6.6 5.6C41.5 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" /></svg>
            {tDynamic('Entrar com Google')}
          </button>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-200 dark:border-gray-800"></div>
            <span className="bg-white dark:bg-gray-900 dark:border-gray-800 px-3 text-xs font-medium uppercase text-gray-400 dark:bg-gray-900 dark:text-gray-500 dark:text-gray-400">ou usando e-mail</span>
            <div className="flex-1 border-t border-gray-200 dark:border-gray-800"></div>
          </div>

          <form onSubmit={modo === 'SENHA' ? entrarComSenha : modo === 'MAGIC_LINK' ? enviarMagicLink : enviarRedefinicaoSenha}>
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--cor-primaria)] focus:bg-white dark:bg-gray-900 dark:border-gray-800 focus:ring-4 focus:ring-[var(--cor-primaria)]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-900"
                />
              </div>

              {modo === 'SENHA' && (
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    type="password"
                    required
                    placeholder="Sua senha"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--cor-primaria)] focus:bg-white dark:bg-gray-900 dark:border-gray-800 focus:ring-4 focus:ring-[var(--cor-primaria)]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-900"
                  />
                </div>
              )}
            </div>

            <button
              disabled={carregando}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-[var(--cor-primaria)] py-3.5 font-bold text-white shadow-lg shadow-[var(--cor-primaria)]/30 transition-all hover:opacity-90 disabled:opacity-50"
            >
              {carregando ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                modo === 'SENHA' ? 'Entrar no Painel' : modo === 'MAGIC_LINK' ? 'Enviar Link Mágico' : 'Enviar E-mail de Redefinição'
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm font-semibold">
            {modo !== 'REDEFINIR' && (
              <button 
                type="button"
                onClick={() => { setModo('REDEFINIR'); setErro(''); setSucesso(''); }}
                className="text-[var(--cor-primaria)] hover:underline"
              >
                {tDynamic('Esqueceu a senha? Redefinir senha por e-mail')}
              </button>
            )}

            {modo !== 'MAGIC_LINK' && (
              <button 
                type="button"
                onClick={() => { setModo('MAGIC_LINK'); setErro(''); setSucesso(''); }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:underline text-xs"
              >
                {tDynamic('Entrar sem senha via Link Mágico')}
              </button>
            )}

            {modo !== 'SENHA' && (
              <button 
                type="button"
                onClick={() => { setModo('SENHA'); setErro(''); setSucesso(''); }}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-300 hover:underline pt-2 text-xs"
              >
                ← Voltar para login com e-mail e senha
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
