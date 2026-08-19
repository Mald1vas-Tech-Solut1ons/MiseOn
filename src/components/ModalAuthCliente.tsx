import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, Mail, Lock } from 'lucide-react';

import { useI18n } from '../contexts/I18nContext';

export default function ModalAuthCliente({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { tDynamic } = useI18n();
  const [modo, setModo] = useState<'LOGIN' | 'CADASTRO' | 'MAGIC_LINK'>('LOGIN');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus email input when modal opens
      setTimeout(() => {
        emailRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setCarregando(true);

    if (modo === 'CADASTRO') {
      const { error } = await supabase.auth.signUp({ email, password: senha });
      if (error) setErro(error.message);
      else setSucesso(tDynamic('Conta criada! Verifique seu e-mail para confirmar (se necessário) ou faça login.'));
    } else if (modo === 'MAGIC_LINK') {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) setErro(error.message);
      else setSucesso(tDynamic('Enviamos um link de acesso mágico para o seu e-mail!'));
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setErro(tDynamic('E-mail ou senha inválidos.'));
      else onClose(); // sucesso, fecha o modal e o Cardapio.tsx pega o user
    }
    setCarregando(false);
  };

  const entrarComGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  };

  // Portal no body: fixed dentro de ancestral com transform seria posicionado errado.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 sm:p-8 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {modo === 'LOGIN' ? tDynamic('Acesse sua conta') : modo === 'CADASTRO' ? tDynamic('Crie sua conta') : tDynamic('Acesso rápido')}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {modo === 'LOGIN' ? tDynamic('Bem-vindo de volta! Faça login para continuar.') : modo === 'CADASTRO' ? tDynamic('Cadastre-se para comprar mais rápido.') : tDynamic('Receba um link mágico por e-mail para entrar na hora.')}
        </p>

        {erro && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{erro}</div>}
        {sucesso && <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-600 dark:bg-green-500/10 dark:text-green-400">{sucesso}</div>}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-gray-400" size={18} />
            <input
              ref={emailRef}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tDynamic('Seu e-mail')}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:focus:border-blue-500"
            />
          </div>
          {modo !== 'MAGIC_LINK' && (
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
              <input
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={tDynamic('Sua senha')}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:focus:border-blue-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {carregando ? tDynamic('Aguarde...') : modo === 'LOGIN' ? tDynamic('Entrar') : modo === 'CADASTRO' ? tDynamic('Cadastrar') : tDynamic('Enviar Link Mágico')}
          </button>
        </form>

        {modo === 'LOGIN' && (
          <button
            onClick={() => { setModo('MAGIC_LINK'); setErro(''); setSucesso(''); }}
            className="mt-4 w-full text-center text-sm font-medium text-[var(--cor-primaria)] hover:underline"
          >
            {tDynamic('Esqueci a senha ou acessar sem senha')}
          </button>
        )}

        <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
          {tDynamic('OU')}
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
        </div>

        <button
          onClick={entrarComGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 dark:border-gray-800 py-3.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {tDynamic('Continuar com Google')}
        </button>

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {modo === 'LOGIN' ? tDynamic('Ainda não tem conta? ') : tDynamic('Já tem uma conta? ')}
          <button
            onClick={() => { setModo(modo === 'LOGIN' ? 'CADASTRO' : 'LOGIN'); setErro(''); setSucesso(''); }}
            className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {modo === 'LOGIN' ? tDynamic('Criar agora') : tDynamic('Faça login')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
