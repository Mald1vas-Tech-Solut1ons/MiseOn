import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, ShieldCheck, UploadCloud, Receipt, Loader2, Info } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
interface FiscalOnboardingProps {
  lojaId: string;
  documentoLoja: string;
  nfeHabilitado: boolean;
  nfeAmbiente: 'homologacao' | 'producao';
  nfeRegime: string;
  nfeIe: string;
  nfeIdCsc: string;
  nfeCsc: string;
  onSuccess: () => void;
}

export function FiscalOnboarding({
  documentoLoja, nfeHabilitado, nfeAmbiente, nfeRegime, nfeIe, nfeIdCsc, nfeCsc, onSuccess
}: FiscalOnboardingProps) {
  const { tDynamic } = useI18n();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  
  const [ambiente, setAmbiente] = useState(nfeAmbiente || 'homologacao');
  const [regime, setRegime] = useState(nfeRegime || 'Simples Nacional');
  const [ie, setIe] = useState(nfeIe || '');
  const [razaoSocial, setRazaoSocial] = useState(''); // Opcional, a Focus as vezes acha
  
  const [idCsc, setIdCsc] = useState(nfeIdCsc || '');
  const [csc, setCsc] = useState(nfeCsc || '');
  
  const [senha, setSenha] = useState('');
  const [pfxBase64, setPfxBase64] = useState('');
  const [pfxName, setPfxName] = useState('');
  
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      alert('Selecione um certificado digital A1 válido (.pfx ou .p12).');
      return;
    }

    setPfxName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPfxBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const habilitar = async () => {
    if (!documentoLoja) {
      setErro('Você precisa configurar o CPF ou CNPJ da loja na aba "Identidade" antes de habilitar a emissão fiscal.');
      return;
    }
    if (!ie || !idCsc || !csc) {
      setErro('Preencha a Inscrição Estadual e os dados do CSC (token da SEFAZ).');
      return;
    }
    if (!nfeHabilitado && (!pfxBase64 || !senha)) {
      setErro('Para a primeira habilitação, envie o arquivo do Certificado Digital A1 (.pfx) e a senha.');
      return;
    }

    setErro('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('fiscal-onboarding-empresa', {
        body: {
          cnpj: documentoLoja, // A Focus NFe aceita CPF ou CNPJ neste campo
          inscricao_estadual: ie,
          razao_social: razaoSocial || 'Não informada',
          regime_tributario: regime,
          certificado_base64: pfxBase64,
          senha_certificado: senha,
          id_csc: idCsc,
          csc: csc,
          ambiente: ambiente
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Sucesso
      alert('Emissão fiscal habilitada com sucesso!');
      setSenha('');
      setPfxBase64('');
      setPfxName('');
      onSuccess();
    } catch (err: any) {
      setErro(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="text-emerald-500" size={24} />
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100">{tDynamic('Emissão de NFC-e (Focus NFe)')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tDynamic('Emita cupons fiscais automáticos via PDV.')}</p>
            </div>
          </div>
          {nfeHabilitado && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Check size={14} /> Habilitada
            </span>
          )}
        </div>

        <div className="mb-6 rounded-xl bg-blue-50 p-4 border border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30">
          <p className="flex items-center gap-1.5 text-sm font-bold text-blue-700 dark:text-blue-400 mb-1">
            <ShieldCheck size={16} /> {tDynamic('Política Zero-Trust para o seu Certificado')}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">
            O MiseOn não salva o arquivo do seu Certificado Digital nem a sua senha em nosso banco de dados. 
            Eles são trafegados via criptografia de ponta-a-ponta e armazenados com segurança militar diretamente nos cofres da SEFAZ/Focus NFe. 
            É por isso que, se você precisar atualizar o certificado vencido no futuro, deverá anexar o arquivo novamente.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Ambiente</span>
            <select value={ambiente} onChange={e => setAmbiente(e.target.value as any)}
              className="w-full rounded-xl border p-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
              <option value="homologacao">{tDynamic('Homologação (Sem valor fiscal - testes)')}</option>
              <option value="producao">{tDynamic('Produção (Com valor fiscal real)')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">{tDynamic('Regime Tributário')}</span>
            <select value={regime} onChange={e => setRegime(e.target.value)}
              className="w-full rounded-xl border p-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
              <option value="Simples Nacional">Simples Nacional</option>
              <option value="Regime Normal">Regime Normal (Lucro Presumido/Real)</option>
              <option value="Simples Nacional - Excesso de sublimite">{tDynamic('Simples Nacional (Excesso de Sublimite)')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">{tDynamic('Inscrição Estadual (IE)')}</span>
            <input value={ie} onChange={e => setIe(e.target.value.replace(/\D/g, ''))} placeholder="Apenas números"
              className="w-full rounded-xl border p-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">{tDynamic('Razão Social (Opcional)')}</span>
            <input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Nome registrado na Receita"
              className="w-full rounded-xl border p-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-gray-200 p-4 dark:border-gray-700">
          <p className="text-sm font-bold dark:text-gray-100 mb-4">{tDynamic('Código de Segurança do Contribuinte (CSC)')}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">{tDynamic('ID do Token (CSC)')}</span>
              <input value={idCsc} onChange={e => setIdCsc(e.target.value)} placeholder="Ex: 000001"
                className="w-full rounded-xl border p-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">{tDynamic('Código CSC (Alfanumérico)')}</span>
              <input value={csc} onChange={e => setCsc(e.target.value)} placeholder="Fornecido pela SEFAZ"
                className="w-full rounded-xl border p-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </label>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
            <Info size={14} /> {tDynamic('O CSC é emitido pelo site da SEFAZ do seu estado e é obrigatório para emissão de NFC-e.')}
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-gray-200 p-4 dark:border-gray-700">
          <p className="text-sm font-bold dark:text-gray-100 mb-4">Certificado Digital A1</p>
          <div className="grid gap-4 md:grid-cols-2 items-end">
            <div>
              <input type="file" ref={fileRef} accept=".pfx,.p12" className="hidden" onChange={handleFile} />
              <button 
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition"
              >
                <UploadCloud size={18} /> {pfxName ? pfxName : 'Selecionar arquivo .pfx'}
              </button>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">{tDynamic('Senha do Certificado')}</span>
              <input value={senha} onChange={e => setSenha(e.target.value)} type="password" placeholder="***"
                className="w-full rounded-xl border p-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </label>
          </div>
          {nfeHabilitado && (
            <p className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              {tDynamic('Seu certificado já foi enviado anteriormente. Só preencha acima se precisar renovar/atualizar.')}
            </p>
          )}
        </div>

        {erro && <p className="mt-4 text-sm font-medium text-red-500 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30">{erro}</p>}

        <button 
          onClick={habilitar} 
          disabled={loading}
          className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3.5 font-bold shadow-lg disabled:opacity-50 transition hover:scale-[1.01]"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Receipt size={18} />}
          {loading ? 'Habilitando na Sefaz...' : 'Validar e Habilitar NFC-e'}
        </button>
      </div>
    </div>
  );
}
