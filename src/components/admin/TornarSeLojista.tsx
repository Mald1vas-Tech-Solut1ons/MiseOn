/**
 * "Torne-se um lojista" — a primeira tela de quem entra sem loja.
 *
 * UMA TELA, DOIS CAMPOS. Até 22/09/2026 esta tela pedia CNPJ, razão social,
 * endereço completo e e-mail de cobrança antes de a pessoa ver qualquer coisa
 * do sistema — para um teste grátis, sem cartão. Uma lead real entrou com
 * Google, deu de cara com isso e foi embora sem deixar rastro.
 *
 * Agora: nome da loja + tipo de negócio criam a loja na hora. O dado fiscal
 * é pedido na tela de Assinatura, quando a pessoa decide pagar — é só ali
 * que existe nota a emitir. O que foi digitado fica salvo no servidor, e cada
 * passo vira evento para o funil do superadmin (`lib/onboarding.ts`).
 */
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, UtensilsCrossed, Bike } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import MiseOnLogo from '../MiseOnLogo';
import { useI18n } from '../../contexts/I18nContext';
import { carregarRascunhoOnboarding, registrarOnboarding } from '../../lib/onboarding';

const SEGMENTOS: { valor: string; rotulo: string }[] = [
  { valor: 'lanchonete', rotulo: 'Lanchonete' },
  { valor: 'hamburgueria', rotulo: 'Hamburgueria' },
  { valor: 'pizzaria', rotulo: 'Pizzaria' },
  { valor: 'restaurante_a_la_carte', rotulo: 'Restaurante à la carte' },
  { valor: 'restaurante_por_kg', rotulo: 'Restaurante por quilo' },
  { valor: 'outro', rotulo: 'Outro' },
];

interface Props {
  emailUsuario: string;
  onCriada: () => void;
}

export default function TornarSeLojista({ emailUsuario, onCriada }: Props) {
  const { tDynamic } = useI18n();
  const [nomeLoja, setNomeLoja] = useState('');
  const [segmento, setSegmento] = useState('');
  const [atendeSalao, setAtendeSalao] = useState(false);
  const [fazEntregas, setFazEntregas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const registrouEtapa = useRef(false);

  // Abriu a tela + devolve o que a pessoa já tinha digitado numa visita anterior.
  useEffect(() => {
    registrarOnboarding('abriu', 'loja');
    let vivo = true;
    carregarRascunhoOnboarding().then((r) => {
      if (!vivo) return;
      if (r.nomeLoja) setNomeLoja((v) => v || r.nomeLoja!);
      if (r.segmento) setSegmento((v) => v || r.segmento!);
      if (r.atendeSalao) setAtendeSalao(true);
      if (r.fazEntregas) setFazEntregas(true);
    });
    return () => { vivo = false; };
  }, []);

  const rascunho = () => ({ nomeLoja: nomeLoja.trim(), segmento, atendeSalao, fazEntregas });

  /** Guarda o que foi digitado ao sair do campo — é o que a retomada devolve. */
  const salvarRascunho = () => {
    if (!nomeLoja.trim() && !segmento) return;
    registrarOnboarding('etapa', registrouEtapa.current ? 'loja' : 'loja_preenchendo', undefined, rascunho());
    registrouEtapa.current = true;
  };

  const criarLoja = async () => {
    const falta = !nomeLoja.trim() ? 'Informe o nome da sua loja.'
      : !segmento ? 'Escolha o tipo do seu negócio.' : '';
    if (falta) {
      setErro(falta);
      registrarOnboarding('erro_validacao', 'loja', falta, rascunho());
      return;
    }
    setErro('');
    setEnviando(true);
    registrarOnboarding('etapa', 'criando', undefined, rascunho());
    try {
      const { data, error } = await supabase.functions.invoke('saas-tornar-se-lojista', {
        body: {
          nome_loja: nomeLoja.trim(),
          segmento_negocio: segmento,
          atende_salao_garcom: atendeSalao,
          faz_entregas: fazEntregas,
          email_cobranca: emailUsuario,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Falha ao criar sua loja.');
      registrarOnboarding('loja_criada', 'concluido');
      onCriada();
    } catch (e) {
      const msg = (e as Error)?.message || 'Erro inesperado ao criar sua loja.';
      setErro(msg);
      registrarOnboarding('erro_criar', 'criando', msg, rascunho());
      setEnviando(false);
    }
  };

  const chip = (ativo: boolean) =>
    `rounded-xl border p-3 text-sm font-semibold transition-colors ${ativo
      ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]'
      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#0B1120] p-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <MiseOnLogo size={110} className="mb-3" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{tDynamic('Vamos abrir sua loja no MiseOn')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tDynamic('30 dias grátis, sem cartão. Leva menos de um minuto.')}
          </p>
        </div>

        {erro && <p role="alert" className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-center text-sm font-medium text-red-600 dark:text-red-400">{tDynamic(erro)}</p>}

        <label htmlFor="nome-loja" className="text-sm font-bold text-gray-700 dark:text-gray-300">{tDynamic('Nome da sua loja')}</label>
        <input id="nome-loja" value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)} onBlur={salvarRascunho}
          placeholder={tDynamic('Ex.: Lanche do Paulista')} autoComplete="organization"
          className="mt-1.5 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-base dark:text-white" />

        <p className="mt-5 text-sm font-bold text-gray-700 dark:text-gray-300">{tDynamic('Qual o tipo do seu negócio?')}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {SEGMENTOS.map((s) => (
            <button key={s.valor} type="button" aria-pressed={segmento === s.valor}
              onClick={() => { setSegmento(s.valor); registrarOnboarding('etapa', 'segmento', s.valor, { ...rascunho(), segmento: s.valor }); }}
              className={chip(segmento === s.valor)}>{tDynamic(s.rotulo)}</button>
          ))}
        </div>

        <p className="mt-5 text-sm font-bold text-gray-700 dark:text-gray-300">{tDynamic('Como você atende? (opcional)')}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={atendeSalao} onClick={() => setAtendeSalao((v) => !v)}
            className={`flex items-center justify-center gap-2 ${chip(atendeSalao)}`}>
            <UtensilsCrossed size={16} /> {tDynamic('Salão com garçom')}</button>
          <button type="button" aria-pressed={fazEntregas} onClick={() => setFazEntregas((v) => !v)}
            className={`flex items-center justify-center gap-2 ${chip(fazEntregas)}`}>
            <Bike size={16} /> {tDynamic('Faço entregas')}</button>
        </div>

        <button type="button" onClick={criarLoja} disabled={enviando}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 text-base font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50">
          {enviando ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {enviando ? tDynamic('Criando sua loja…') : tDynamic('Criar minha loja grátis')}
        </button>
        <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
          {tDynamic('Ao criar, você começa o teste grátis de 30 dias. Sem cobrança automática: no fim, você escolhe se quer assinar. Os dados para nota fiscal só são pedidos na hora de assinar.')}
        </p>
      </div>
    </div>
  );
}
