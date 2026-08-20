import { useState } from 'react';
import { Store, Building2, User, CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import MiseOnLogo from '../MiseOnLogo';

import { useI18n } from '../../contexts/I18nContext';
const SEGMENTOS: { valor: string; rotulo: string }[] = [
  { valor: 'lanchonete', rotulo: 'Lanchonete' },
  { valor: 'restaurante_a_la_carte', rotulo: 'Restaurante à la carte' },
  { valor: 'restaurante_por_kg', rotulo: 'Restaurante por quilo' },
  { valor: 'pizzaria', rotulo: 'Pizzaria' },
  { valor: 'hamburgueria', rotulo: 'Hamburgueria' },
  { valor: 'outro', rotulo: 'Outro' },
];

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

interface Props {
  emailUsuario: string;
  onCriada: () => void;
}

export default function TornarSeLojista({ emailUsuario, onCriada }: Props) {
  const { tDynamic } = useI18n();
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  // Etapa 1 — loja + dados fiscais do tomador
  const [nomeLoja, setNomeLoja] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<'PF' | 'PJ'>('PJ');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [razaoSocialOuNome, setRazaoSocialOuNome] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [cep, setCep] = useState('');
  const [emailCobranca, setEmailCobranca] = useState(emailUsuario);

  // Etapa 2 — perfil de negócio
  const [segmentoNegocio, setSegmentoNegocio] = useState('');
  const [qtdFuncionarios, setQtdFuncionarios] = useState('');
  const [atendeSalaoGarcom, setAtendeSalaoGarcom] = useState(false);
  const [fazEntregas, setFazEntregas] = useState(false);
  const [modeloEntrega, setModeloEntrega] = useState<'fixo' | 'freelancer' | ''>('');

  // Etapa 3 — confirmação do trial
  const [aceiteTrial, setAceiteTrial] = useState(false);

  const validarEtapa1 = () => {
    if (!nomeLoja.trim()) return 'Informe o nome da sua loja.';
    if (!cpfCnpj.trim()) return tipoPessoa === 'PJ' ? 'Informe o CNPJ.' : 'Informe o CPF.';
    if (!razaoSocialOuNome.trim()) return tipoPessoa === 'PJ' ? 'Informe a razão social.' : 'Informe seu nome completo.';
    if (!emailCobranca.trim()) return 'Informe o e-mail de cobrança.';
    return '';
  };

  const irParaEtapa2 = () => {
    const msg = validarEtapa1();
    if (msg) return setErro(msg);
    setErro('');
    setEtapa(2);
  };

  const irParaEtapa3 = () => {
    if (!segmentoNegocio) return setErro('Selecione o segmento do seu negócio.');
    setErro('');
    setEtapa(3);
  };

  const criarLoja = async () => {
    if (!aceiteTrial) return setErro('Confirme que deseja iniciar o teste grátis de 30 dias.');
    setErro('');
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('saas-tornar-se-lojista', {
        body: {
          nome_loja: nomeLoja.trim(),
          tipo_pessoa: tipoPessoa,
          cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
          razao_social_ou_nome: razaoSocialOuNome.trim(),
          logradouro: logradouro.trim() || null,
          numero: numero.trim() || null,
          complemento: complemento.trim() || null,
          bairro: bairro.trim() || null,
          cidade: cidade.trim() || null,
          uf: uf || null,
          cep: cep.replace(/\D/g, '') || null,
          email_cobranca: emailCobranca.trim(),
          segmento_negocio: segmentoNegocio,
          qtd_funcionarios: qtdFuncionarios ? Number(qtdFuncionarios) : null,
          atende_salao_garcom: atendeSalaoGarcom,
          faz_entregas: fazEntregas,
          modelo_entrega: fazEntregas ? (modeloEntrega || null) : null,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Falha ao criar sua loja.');
      onCriada();
    } catch (e: any) {
      setErro(e?.message || 'Erro inesperado ao criar sua loja.');
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#0B1120] p-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <MiseOnLogo size={120} className="mb-3" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{tDynamic('Torne-se um lojista MiseOn')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            30 dias grátis, sem cartão. Só pedimos os dados abaixo pra deixar sua nota fiscal certinha desde o início.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1.5 w-10 rounded-full transition-colors ${etapa >= n ? 'bg-[var(--cor-primaria)]' : 'bg-gray-200 dark:bg-gray-800'}`} />
          ))}
        </div>

        {erro && <p className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-center text-sm font-medium text-red-600 dark:text-red-400">{erro}</p>}

        {etapa === 1 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300"><Store size={16} /> Sua loja</div>
            <input value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)} placeholder="Nome da sua loja"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />

            <div className="mt-4 flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300"><Building2 size={16} /> {tDynamic('Dados para a nota fiscal')}</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setTipoPessoa('PJ')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-sm font-semibold transition-colors ${tipoPessoa === 'PJ' ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]' : 'border-gray-200 dark:border-gray-800 text-gray-500'}`}>
                <Building2 size={14} /> {tDynamic('Pessoa Jurídica')}
              </button>
              <button type="button" onClick={() => setTipoPessoa('PF')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-sm font-semibold transition-colors ${tipoPessoa === 'PF' ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]' : 'border-gray-200 dark:border-gray-800 text-gray-500'}`}>
                <User size={14} /> Pessoa Física
              </button>
            </div>
            <input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder={tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />
            <input value={razaoSocialOuNome} onChange={(e) => setRazaoSocialOuNome(e.target.value)} placeholder={tipoPessoa === 'PJ' ? 'Razão social' : 'Nome completo'}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />
            <div className="grid grid-cols-3 gap-2">
              <input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} placeholder="Rua"
                className="col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />
              <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Nº"
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />
            </div>
            <input value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Complemento (opcional)"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />
            <div className="grid grid-cols-3 gap-2">
              <input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro"
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />
              <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade"
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />
              <select value={uf} onChange={(e) => setUf(e.target.value)}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm text-gray-700 dark:text-gray-300">
                <option value="">UF</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="CEP"
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />
              <input value={emailCobranca} onChange={(e) => setEmailCobranca(e.target.value)} placeholder="E-mail de cobrança" type="email"
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />
            </div>

            <button onClick={irParaEtapa2}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90">
              Continuar <ArrowRight size={16} />
            </button>
          </div>
        )}

        {etapa === 2 && (
          <div className="space-y-3">
            <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{tDynamic('Conte um pouco do seu negócio')}</div>
            <select value={segmentoNegocio} onChange={(e) => setSegmentoNegocio(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm text-gray-700 dark:text-gray-300">
              <option value="">{tDynamic('Qual o segmento do seu negócio?')}</option>
              {SEGMENTOS.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
            </select>
            <input value={qtdFuncionarios} onChange={(e) => setQtdFuncionarios(e.target.value.replace(/\D/g, ''))} placeholder="Quantidade de funcionários" inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm dark:text-white" />

            <label className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-sm dark:text-gray-300">
              <input type="checkbox" checked={atendeSalaoGarcom} onChange={(e) => setAtendeSalaoGarcom(e.target.checked)} className="h-4 w-4" />
              {tDynamic('Atendo no salão com garçom')}
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-sm dark:text-gray-300">
              <input type="checkbox" checked={fazEntregas} onChange={(e) => setFazEntregas(e.target.checked)} className="h-4 w-4" />
              Faço entregas
            </label>

            {fazEntregas && (
              <div className="flex gap-2 pl-2">
                <button type="button" onClick={() => setModeloEntrega('fixo')}
                  className={`flex-1 rounded-xl border p-2.5 text-sm font-semibold transition-colors ${modeloEntrega === 'fixo' ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]' : 'border-gray-200 dark:border-gray-800 text-gray-500'}`}>
                  Entregador fixo
                </button>
                <button type="button" onClick={() => setModeloEntrega('freelancer')}
                  className={`flex-1 rounded-xl border p-2.5 text-sm font-semibold transition-colors ${modeloEntrega === 'freelancer' ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]' : 'border-gray-200 dark:border-gray-800 text-gray-500'}`}>
                  Freelancer
                </button>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button onClick={() => setEtapa(1)} className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
                <ArrowLeft size={16} /> Voltar
              </button>
              <button onClick={irParaEtapa3}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90">
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-4 text-sm text-emerald-800 dark:text-emerald-300">
              {tDynamic('Seu período de teste começa agora:')} <b>30 dias grátis, sem necessidade de cartão de crédito.</b> Ao final, você
              escolhe se quer assinar mensal ou anual — sem compromisso automático.
            </div>
            <label className="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-sm dark:text-gray-300">
              <input type="checkbox" checked={aceiteTrial} onChange={(e) => setAceiteTrial(e.target.checked)} className="mt-0.5 h-4 w-4" />
              {tDynamic('Quero iniciar meu teste grátis de 30 dias na MiseOn.')}
            </label>

            <div className="flex gap-2">
              <button onClick={() => setEtapa(2)} disabled={enviando} className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300 disabled:opacity-50">
                <ArrowLeft size={16} /> Voltar
              </button>
              <button onClick={criarLoja} disabled={enviando}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50">
                {enviando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {enviando ? 'Criando sua loja...' : 'Criar minha loja'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
