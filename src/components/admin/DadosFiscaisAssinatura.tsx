/**
 * Dados do tomador da nota fiscal da assinatura.
 *
 * Moravam no primeiro passo do cadastro — e foram o muro onde uma lead real
 * parou em 22/09/2026. Agora são pedidos aqui, na hora de assinar, que é o
 * único momento em que existe nota a emitir. Pagamento fica travado até o
 * cadastro estar completo: a NFS-e e o cartão anual (a Efí exige endereço)
 * dependem dele.
 */
import { useEffect, useState } from 'react';
import { Building2, User, FileText, Pencil, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';
import { cadastroFiscalCompleto, soDigitos, type CadastroFiscal as Cadastro } from '../../lib/cadastroFiscal';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

interface Props {
  lojaId: string;
  emailPadrao: string;
  onMudou: (completo: boolean) => void;
}

export default function DadosFiscaisAssinatura({ lojaId, emailPadrao, onMudou }: Props) {
  const { tDynamic } = useI18n();
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [c, setC] = useState<Cadastro>({
    tipo_pessoa: 'PJ', cpf_cnpj: '', razao_social_ou_nome: '', logradouro: '', numero: '',
    complemento: '', bairro: '', cidade: '', uf: '', cep: '', email_cobranca: emailPadrao,
  });

  useEffect(() => {
    let vivo = true;
    supabase.from('assinatura_dados_cadastro')
      .select('tipo_pessoa, cpf_cnpj, razao_social_ou_nome, logradouro, numero, complemento, bairro, cidade, uf, cep, email_cobranca')
      .eq('loja_id', lojaId).maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        if (data) setC((a) => ({ ...a, ...data, tipo_pessoa: data.tipo_pessoa ?? 'PJ', email_cobranca: data.email_cobranca || emailPadrao }));
        const completo = cadastroFiscalCompleto(data as Cadastro | null);
        setEditando(!completo);
        onMudou(completo);
        setCarregando(false);
      }, () => { if (vivo) { setEditando(true); onMudou(false); setCarregando(false); } });
    return () => { vivo = false; };
    // onMudou é callback do pai; recarregar só quando a loja muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaId]);

  const campo = (k: keyof Cadastro) => ({
    value: (c[k] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setC((a) => ({ ...a, [k]: e.target.value })),
  });

  const salvar = async () => {
    const pronto: Cadastro = {
      ...c,
      cpf_cnpj: soDigitos(c.cpf_cnpj ?? ''),
      cep: soDigitos(c.cep ?? ''),
      uf: (c.uf ?? '').toUpperCase(),
      email_cobranca: (c.email_cobranca ?? '').trim().toLowerCase(),
    };
    if (!cadastroFiscalCompleto(pronto)) {
      setErro(tDynamic('Preencha CPF ou CNPJ, nome ou razão social, endereço com CEP e o e-mail de cobrança.'));
      return;
    }
    setSalvando(true); setErro('');
    const { error } = await supabase.from('assinatura_dados_cadastro')
      .upsert({ loja_id: lojaId, ...pronto }, { onConflict: 'loja_id' })
      .select('loja_id').single();
    setSalvando(false);
    if (error) { setErro(tDynamic('Não foi possível salvar. Tente de novo.')); return; }
    setC(pronto);
    setEditando(false);
    onMudou(true);
  };

  const input = 'w-full rounded-xl border border-gray-300 p-3 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100';

  if (carregando) return null;

  if (!editando) {
    return (
      <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-sm">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <FileText size={16} className="shrink-0" />
          <span>{tDynamic('Nota fiscal para')} <b>{c.razao_social_ou_nome}</b> · {c.cpf_cnpj}</span>
        </div>
        <button type="button" onClick={() => { setEditando(true); onMudou(false); }}
          className="flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--cor-primaria)]"><Pencil size={14} /> {tDynamic('Editar')}</button>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3 rounded-2xl border-2 border-[var(--cor-primaria)]/40 bg-[var(--cor-primaria)]/5 p-4">
      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{tDynamic('Dados para a nota fiscal')}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{tDynamic('Precisamos disto para emitir a nota da sua assinatura. É pedido uma vez só.')}</p>
      {erro && <p role="alert" className="text-xs font-semibold text-red-600">{erro}</p>}
      <div className="flex gap-2">
        {(['PJ', 'PF'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setC((a) => ({ ...a, tipo_pessoa: t }))}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border p-2.5 text-sm font-semibold ${c.tipo_pessoa === t ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]' : 'border-gray-200 dark:border-gray-800 text-gray-500'}`}>
            {t === 'PJ' ? <><Building2 size={14} /> {tDynamic('Pessoa Jurídica')}</> : <><User size={14} /> {tDynamic('Pessoa Física')}</>}
          </button>
        ))}
      </div>
      <input {...campo('cpf_cnpj')} inputMode="numeric" placeholder={c.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'} className={input} />
      <input {...campo('razao_social_ou_nome')} placeholder={tDynamic(c.tipo_pessoa === 'PJ' ? 'Razão social' : 'Nome completo')} className={input} />
      <div className="grid grid-cols-3 gap-2">
        <input {...campo('logradouro')} placeholder={tDynamic('Rua')} className={`col-span-2 ${input}`} />
        <input {...campo('numero')} placeholder={tDynamic('Nº')} className={input} />
      </div>
      <input {...campo('complemento')} placeholder={tDynamic('Complemento (opcional)')} className={input} />
      <div className="grid grid-cols-3 gap-2">
        <input {...campo('bairro')} placeholder={tDynamic('Bairro')} className={input} />
        <input {...campo('cidade')} placeholder={tDynamic('Cidade')} className={input} />
        <select {...campo('uf')} className={input}>
          <option value="">UF</option>
          {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input {...campo('cep')} inputMode="numeric" placeholder="CEP" className={input} />
        <input {...campo('email_cobranca')} type="email" placeholder={tDynamic('E-mail de cobrança')} className={input} />
      </div>
      <button type="button" onClick={salvar} disabled={salvando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white disabled:opacity-50">
        {salvando && <Loader2 size={16} className="animate-spin" />} {tDynamic('Salvar e continuar para o pagamento')}
      </button>
    </div>
  );
}
