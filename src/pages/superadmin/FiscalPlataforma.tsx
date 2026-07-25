import { useEffect, useRef, useState } from 'react';
import { Receipt, ShieldCheck, UploadCloud, Loader2, Check, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

interface ConfigFiscal {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  inscricao_municipal: string | null;
  cnae_principal: string;
  codigo_servico: string | null;
  item_lista_servico: string | null;
  codigo_tributacao_nacional: string | null;
  codigo_opcao_simples_nacional: number | null;
  aliquota_iss: number | null;
  regime_tributario: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  codigo_ibge: string | null;
  telefone: string | null;
  email: string | null;
  ambiente: 'homologacao' | 'producao';
  habilita_nfse: boolean;
  certificado_status: 'pendente' | 'valido' | 'expirado' | 'erro';
}

export default function FiscalPlataforma() {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [config, setConfig] = useState<ConfigFiscal | null>(null);

  const [senha, setSenha] = useState('');
  const [pfxBase64, setPfxBase64] = useState('');
  const [pfxName, setPfxName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    setCarregando(true);
    const { data } = await supabase.from('configuracoes_fiscais_plataforma').select('*').eq('id', true).maybeSingle();
    setConfig(data as ConfigFiscal);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      alert('Selecione um certificado digital A1 válido (.pfx ou .p12).');
      return;
    }
    setPfxName(file.name);
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') setPfxBase64(reader.result); };
    reader.readAsDataURL(file);
  };

  const set = <K extends keyof ConfigFiscal>(campo: K, valor: ConfigFiscal[K]) => {
    setConfig((c) => c ? { ...c, [campo]: valor } : c);
  };

  const salvar = async () => {
    if (!config) return;
    setErro(''); setSucesso(''); setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-onboarding-plataforma', {
        body: {
          cnpj: config.cnpj, razao_social: config.razao_social, nome_fantasia: config.nome_fantasia,
          inscricao_municipal: config.inscricao_municipal, cnae_principal: config.cnae_principal,
          codigo_servico: config.codigo_servico, item_lista_servico: config.item_lista_servico,
          codigo_tributacao_nacional: config.codigo_tributacao_nacional,
          codigo_opcao_simples_nacional: config.codigo_opcao_simples_nacional,
          aliquota_iss: config.aliquota_iss, regime_tributario: config.regime_tributario,
          logradouro: config.logradouro, numero: config.numero, complemento: config.complemento,
          bairro: config.bairro, cidade: config.cidade, uf: config.uf, cep: config.cep,
          codigo_ibge: config.codigo_ibge, telefone: config.telefone, email: config.email,
          ambiente: config.ambiente, habilita_nfse: config.habilita_nfse,
          certificado_base64: pfxBase64 || undefined,
          senha_certificado: senha || undefined,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Falha ao salvar.');
      setSucesso('Configuração fiscal da plataforma salva.');
      setSenha(''); setPfxBase64(''); setPfxName('');
      carregar();
    } catch (e: any) {
      setErro(e?.message || 'Erro inesperado.');
    }
    setSalvando(false);
  };

  if (carregando || !config) return <div className="p-6 text-gray-400">Carregando…</div>;

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center gap-2">
        <Receipt className="text-emerald-400" size={24} />
        <div>
          <h2 className="text-lg font-bold text-white">Configuração Fiscal da Plataforma</h2>
          <p className="text-xs text-gray-400">Dados da MiseOn (emissora) usados na NFS-e da assinatura dos lojistas.</p>
        </div>
        {config.certificado_status === 'valido' && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
            <Check size={14} /> Certificado configurado
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-5">
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-blue-300 mb-1"><ShieldCheck size={16} /> Certificado protegido</p>
          <p className="text-xs text-blue-200/80 leading-relaxed">
            O certificado e a senha são criptografados (AES-256-GCM) antes de gravar no banco — mesmo padrão usado
            para o certificado das lojas.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">CNPJ</span>
            <input value={config.cnpj} onChange={(e) => set('cnpj', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">Nome fantasia</span>
            <input value={config.nome_fantasia ?? ''} onChange={(e) => set('nome_fantasia', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">Razão social (oficial, do CNPJ)</span>
            <input value={config.razao_social} onChange={(e) => set('razao_social', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
          </label>
        </div>

        <div className="rounded-2xl border border-dashed border-white/10 p-4">
          <p className="text-sm font-bold text-white mb-1">Enquadramento de serviço (CNAE 8219-9/99)</p>
          <p className="mb-4 flex items-center gap-1.5 text-[11px] text-gray-400">
            <Info size={14} /> Manaus exige NFS-e Padrão Nacional desde 01/01/2026 (LC 214/2025), inclusive pra
            MEI. Já pré-preenchido com o código de tributação nacional 170202 ("apoio administrativo",
            equivalente ao antigo item LC116 17.02) e alíquota 5% — confira antes de habilitar produção.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-400 mb-1 block">CNAE principal</span>
              <input value={config.cnae_principal} onChange={(e) => set('cnae_principal', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-400 mb-1 block">Código tributação nacional (cTribNac)</span>
              <input value={config.codigo_tributacao_nacional ?? ''} onChange={(e) => set('codigo_tributacao_nacional', e.target.value)} placeholder="170202"
                className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-400 mb-1 block">Alíquota ISS (%)</span>
              <input value={config.aliquota_iss ?? ''} onChange={(e) => set('aliquota_iss', e.target.value ? Number(e.target.value) : null)} inputMode="decimal"
                className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-400 mb-1 block">Opção Simples Nacional (DPS)</span>
              <select value={config.codigo_opcao_simples_nacional ?? 2} onChange={(e) => set('codigo_opcao_simples_nacional', Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white">
                <option value={1}>Não optante</option>
                <option value={2}>Optante — MEI</option>
                <option value={3}>Optante — ME/EPP</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-400 mb-1 block">Item lista serviço (LC116, referência)</span>
              <input value={config.item_lista_servico ?? ''} onChange={(e) => set('item_lista_servico', e.target.value)} placeholder="17.02"
                className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-400 mb-1 block">Inscrição municipal</span>
              <input value={config.inscricao_municipal ?? ''} onChange={(e) => set('inscricao_municipal', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block md:col-span-2">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">Logradouro</span>
            <input value={config.logradouro ?? ''} onChange={(e) => set('logradouro', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">Número</span>
            <input value={config.numero ?? ''} onChange={(e) => set('numero', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">Bairro</span>
            <input value={config.bairro ?? ''} onChange={(e) => set('bairro', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">Cidade</span>
            <input value={config.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">UF</span>
            <select value={config.uf ?? ''} onChange={(e) => set('uf', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white">
              <option value="">—</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">CEP</span>
            <input value={config.cep ?? ''} onChange={(e) => set('cep', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">Código IBGE do município</span>
            <input value={config.codigo_ibge ?? ''} onChange={(e) => set('codigo_ibge', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">E-mail de contato</span>
            <input value={config.email ?? ''} onChange={(e) => set('email', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-gray-400 mb-1 block">Ambiente</span>
            <select value={config.ambiente} onChange={(e) => set('ambiente', e.target.value as any)}
              className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white">
              <option value="homologacao">Homologação (testes)</option>
              <option value="producao">Produção (nota real)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 p-3 text-sm text-white mt-5">
            <input type="checkbox" checked={config.habilita_nfse} onChange={(e) => set('habilita_nfse', e.target.checked)} className="h-4 w-4" />
            Habilitar emissão automática de NFS-e
          </label>
        </div>

        <div className="rounded-2xl border border-dashed border-white/10 p-4">
          <p className="text-sm font-bold text-white mb-4">Certificado Digital A1</p>
          <div className="grid gap-4 md:grid-cols-2 items-end">
            <div>
              <input type="file" ref={fileRef} accept=".pfx,.p12" className="hidden" onChange={handleFile} />
              <button onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 p-3 text-sm font-semibold text-gray-200 hover:bg-white/5 transition">
                <UploadCloud size={18} /> {pfxName || 'Selecionar arquivo .pfx'}
              </button>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-gray-400 mb-1 block">Senha do certificado</span>
              <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" placeholder="***"
                className="w-full rounded-xl border border-white/10 bg-gray-950 p-3 text-sm text-white" />
            </label>
          </div>
          {config.certificado_status === 'valido' && (
            <p className="mt-3 text-[11px] text-emerald-400 font-semibold">
              Certificado já configurado. Só preencha acima se precisar renovar/atualizar.
            </p>
          )}
        </div>

        {erro && <p className="text-sm font-medium text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{erro}</p>}
        {sucesso && <p className="text-sm font-medium text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">{sucesso}</p>}

        <button onClick={salvar} disabled={salvando}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-gray-900 py-3.5 font-bold shadow-lg disabled:opacity-50 transition hover:scale-[1.01]">
          {salvando ? <Loader2 size={18} className="animate-spin" /> : <Receipt size={18} />}
          {salvando ? 'Salvando…' : 'Salvar Configuração Fiscal'}
        </button>
      </div>
    </div>
  );
}
