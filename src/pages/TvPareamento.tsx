import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Monitor, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useI18n } from '../contexts/I18nContext';

type Pareamento = {
  codigo: string;
  segredo: string;
  expira_em: string;
};

type Consulta = {
  status: 'PENDENTE' | 'AUTORIZADO' | 'EXPIRADO' | 'REVOGADO';
  slug: string | null;
  modo: 'AUTO' | 'CARDAPIO' | 'SENHAS' | null;
  sessao_token: string | null;
};

const CHAVE_PENDENTE = 'miseon_tv_pareamento_pendente';

function pendenteSalvo(): Pareamento | null {
  try {
    const valor = JSON.parse(sessionStorage.getItem(CHAVE_PENDENTE) ?? 'null') as Pareamento | null;
    return valor && new Date(valor.expira_em).getTime() > Date.now() ? valor : null;
  } catch {
    return null;
  }
}

export default function TvPareamento() {
  const { tDynamic } = useI18n();
  const navigate = useNavigate();
  const iniciou = useRef(false);
  const [pareamento, setPareamento] = useState<Pareamento | null>(() => pendenteSalvo());
  const [estado, setEstado] = useState<'CRIANDO' | 'AGUARDANDO' | 'EXPIRADO' | 'ERRO'>(pareamento ? 'AGUARDANDO' : 'CRIANDO');
  const [erro, setErro] = useState('');

  const criar = useCallback(async () => {
    setEstado('CRIANDO');
    setErro('');
    const { data, error } = await supabase.rpc('fn_tv_pareamento_criar');
    const novo = (data as Pareamento[] | null)?.[0];
    if (error || !novo) {
      setErro('Não foi possível gerar o código. Confira a internet e tente novamente.');
      setEstado('ERRO');
      return;
    }
    sessionStorage.setItem(CHAVE_PENDENTE, JSON.stringify(novo));
    setPareamento(novo);
    setEstado('AGUARDANDO');
  }, []);

  useEffect(() => {
    if (pareamento || iniciou.current) return;
    iniciou.current = true;
    criar();
  }, [criar, pareamento]);

  useEffect(() => {
    if (!pareamento || estado !== 'AGUARDANDO') return;
    let ativo = true;

    const consultar = async () => {
      const { data, error } = await supabase.rpc('fn_tv_pareamento_consultar', {
        p_codigo: pareamento.codigo,
        p_segredo: pareamento.segredo,
      });
      if (!ativo) return;
      if (error) {
        setErro('A conexão com o MiseOn foi interrompida. Tentaremos novamente.');
        return;
      }

      const resposta = (data as Consulta[] | null)?.[0];
      if (!resposta) return;
      setErro('');
      if (resposta.status === 'AUTORIZADO' && resposta.slug && resposta.modo && resposta.sessao_token) {
        sessionStorage.removeItem(CHAVE_PENDENTE);
        const params = new URLSearchParams({
          modo: resposta.modo.toLowerCase(),
          sessao: resposta.sessao_token,
        });
        navigate(`/tv/${resposta.slug}?${params.toString()}`, { replace: true });
      } else if (resposta.status === 'EXPIRADO' || resposta.status === 'REVOGADO') {
        sessionStorage.removeItem(CHAVE_PENDENTE);
        setEstado('EXPIRADO');
      }
    };

    consultar();
    const timer = window.setInterval(consultar, 3_000);
    return () => {
      ativo = false;
      window.clearInterval(timer);
    };
  }, [estado, navigate, pareamento]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-6 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#0d1b2e] p-7 text-center shadow-2xl sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
          <Monitor size={36} />
        </div>
        <h1 className="mt-5 text-3xl font-black sm:text-4xl">{tDynamic('Conectar esta TV ao MiseOn')}</h1>

        {estado === 'CRIANDO' && (
          <div className="mt-10 flex items-center justify-center gap-3 text-lg text-slate-300">
            <Loader2 className="animate-spin" /> {tDynamic('Gerando código seguro…')}
          </div>
        )}

        {estado === 'AGUARDANDO' && pareamento && (
          <>
            <p className="mt-4 text-base text-slate-300">{tDynamic('Na área administrativa, abra')} <strong>Loja → TV</strong> {tDynamic('e informe:')}</p>
            <div className="my-8 font-mono text-5xl font-black tracking-[0.22em] text-orange-400 sm:text-7xl" aria-label={`Código ${pareamento.codigo.split('').join(' ')}`}>
              {pareamento.codigo}
            </div>
            <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
              <Wifi size={18} className="text-emerald-400" /> {tDynamic('Aguardando autorização do administrador…')}
            </div>
            <p className="mt-4 text-sm text-slate-500">{tDynamic('O código expira em 10 minutos. Esta TV nunca recebe o login administrativo.')}</p>
          </>
        )}

        {(estado === 'EXPIRADO' || estado === 'ERRO') && (
          <>
            <p className="mt-8 text-lg font-bold text-amber-300">
              {estado === 'EXPIRADO' ? 'Este código expirou ou foi revogado.' : erro}
            </p>
            <button type="button" onClick={criar} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-500 px-5 font-black text-slate-950 hover:bg-orange-400">
              <RefreshCw size={19} /> {tDynamic('Gerar novo código')}
            </button>
          </>
        )}

        {erro && estado === 'AGUARDANDO' && <p className="mt-4 text-sm font-bold text-amber-300">{erro}</p>}
        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} /> {tDynamic('Pareamento temporário e isolado por loja')}</p>
      </section>
    </main>
  );
}
