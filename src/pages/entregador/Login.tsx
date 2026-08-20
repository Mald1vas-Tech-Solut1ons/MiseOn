import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Mail, Lock, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

import { useI18n } from '../../contexts/I18nContext';
export default function EntregadorLogin() {
  const { tDynamic } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setErro('Preencha e-mail e senha.');
    setLoading(true);
    setErro('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        setErro('Credenciais inválidas. Verifique seu e-mail e senha.');
        setLoading(false);
        return;
      }

      if (data.user) {
        // Verifica se é entregador
        const { data: ent } = await supabase.from('entregadores').select('id, ativo').eq('user_id', data.user.id).maybeSingle();
        if (!ent) {
          await supabase.auth.signOut();
          setErro('Esta conta não está cadastrada como entregador em nenhuma loja.');
          setLoading(false);
          return;
        }
        if (!ent.ativo) {
          await supabase.auth.signOut();
          setErro('Sua conta de entregador está desativada. Fale com o restaurante.');
          setLoading(false);
          return;
        }

        navigate('/entregador');
      }
    } catch {
      setErro('Ocorreu um erro ao conectar.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-6 text-gray-100 font-sans">
      <div className="w-full max-w-sm rounded-3xl bg-gray-900 border border-gray-800 p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 ring-1 ring-inset ring-orange-500/20">
            <Bike size={32} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">MiseOn <span className="text-orange-500">Logistics</span></h1>
          <p className="mt-2 text-sm font-medium text-gray-400">O app do entregador de alta performance.</p>
        </div>

        {erro && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm font-bold text-red-400">
            <AlertTriangle size={18} className="shrink-0" />
            <p>{erro}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-400 uppercase tracking-wide">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-xl border border-gray-800 bg-gray-950 py-3.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-400 uppercase tracking-wide">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha de acesso"
                className="w-full rounded-xl border border-gray-800 bg-gray-950 py-3.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-orange-500 disabled:opacity-50 shadow-[0_0_20px_rgba(234,88,12,0.3)]"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Entrar no App'}
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] font-medium text-gray-600">
          {tDynamic('Você precisa ser convidado por um restaurante Parceiro MiseOn para ter acesso ao app.')}
        </p>
      </div>
    </div>
  );
}
