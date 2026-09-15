import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { callbackInicial, emRecuperacao, interpretarCallback } from '../lib/authCallback';

export default function AuthRecoveryRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const atual = interpretarCallback(new URL(window.location.href));
    const destino = `/redefinir-senha?portal=${callbackInicial.portal}`;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && location.pathname !== '/redefinir-senha') {
        navigate(destino, { replace: true });
      }
    });
    if ((atual.recovery || emRecuperacao()) && location.pathname !== '/redefinir-senha') {
      navigate(destino + window.location.hash, { replace: true });
    }
    // Erros OAuth permanecem no fluxo de entrada; nunca viram recuperação.
    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);
  return null;
}
