import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import MiseOnLogo from '../../components/MiseOnLogo';
import { supabase } from '../../lib/supabase';

export default function SuperAdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro(error.message.includes('Invalid login credentials')
        ? 'E-mail ou senha incorretos.'
        : error.message);
      return;
    }
    nav('/superadmin/tenants');
  };

  const esqueciSenha = async () => {
    if (!email) return setErro('Digite seu e-mail acima para receber o link de redefinição.');
    setErro('');
    setSucesso('');
    setCarregando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha?portal=superadmin`,
    });
    setCarregando(false);
    if (error) {
      setErro('Não foi possível enviar o link. Verifique o e-mail e tente de novo.');
      return;
    }
    setSucesso('Te enviamos um link para redefinir a senha. Verifique sua caixa de entrada.');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl dark:border dark:border-gray-800 dark:bg-gray-900">
        <div className="p-8 pb-6 text-center">
          <div className="mb-6 flex justify-center">
            <MiseOnLogo size={160} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Painel SuperAdmin</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Acesso restrito à equipe MiseOn</p>
        </div>

        <div className="px-8 pb-8">
          {erro && (
            <div className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{erro}</p>
            </div>
          )}

          {sucesso && (
            <div className="mb-5 flex items-start gap-2 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <p>{sucesso}</p>
            </div>
          )}

          <form onSubmit={entrar}>
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--cor-primaria)] focus:bg-white focus:ring-4 focus:ring-[var(--cor-primaria)]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-900"
                />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  type="password"
                  required
                  placeholder="Sua senha"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--cor-primaria)] focus:bg-white focus:ring-4 focus:ring-[var(--cor-primaria)]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-900"
                />
              </div>
            </div>

            <button
              disabled={carregando}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-[var(--cor-primaria)] py-3.5 font-bold text-white shadow-lg shadow-[var(--cor-primaria)]/30 transition-all hover:opacity-90 disabled:opacity-50"
            >
              {carregando ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={esqueciSenha}
              disabled={carregando}
              className="text-sm font-semibold text-[var(--cor-primaria)] hover:underline disabled:opacity-50"
            >
              Esqueci minha senha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
