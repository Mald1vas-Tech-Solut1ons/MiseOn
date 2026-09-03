import { useEffect, useState } from 'react';
import { FileText, CheckCircle2, XCircle, Loader2, IdCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';

import { useI18n } from '../../contexts/I18nContext';
interface EntregadorPendente {
  id: string;
  nome: string;
  telefone: string | null;
  veiculo: string | null;
  placa: string | null;
  cnh_numero: string | null;
  cnh_arquivo_url: string | null;
  veiculo_doc_arquivo_url: string | null;
  status_documentos: 'pendente' | 'aprovado' | 'rejeitado';
}

export default function AprovacaoEntregadores({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [itens, setItens] = useState<EntregadorPendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [rejeitando, setRejeitando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  const carregar = async () => {
    setCarregando(true);
    const { data } = await supabase
      .from('entregadores')
      .select('id, nome, telefone, veiculo, placa, cnh_numero, cnh_arquivo_url, veiculo_doc_arquivo_url, status_documentos')
      .eq('loja_id', lojaId)
      .in('status_documentos', ['pendente', 'rejeitado'])
      .not('cnh_arquivo_url', 'is', null);
    setItens((data as EntregadorPendente[]) ?? []);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [lojaId]);

  const abrirDocumento = async (path: string | null) => {
    if (!path) return;
    const { data } = await supabase.storage.from('entregador-docs').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const aprovar = async (id: string) => {
    setProcessando(id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('entregadores').update({
      status_documentos: 'aprovado',
      documentos_revisado_em: new Date().toISOString(),
      documentos_revisado_por: user?.id ?? null,
      motivo_rejeicao: null,
    }).eq('id', id);
    setProcessando(null);
    carregar();
  };

  const confirmarRejeicao = async (id: string) => {
    if (!motivo.trim()) return;
    setProcessando(id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('entregadores').update({
      status_documentos: 'rejeitado',
      documentos_revisado_em: new Date().toISOString(),
      documentos_revisado_por: user?.id ?? null,
      motivo_rejeicao: motivo.trim(),
    }).eq('id', id);
    setProcessando(null);
    setRejeitando(null);
    setMotivo('');
    carregar();
  };

  if (carregando) return null;
  if (itens.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
        <IdCard size={16} /> Entregadores aguardando aprovação de documentos ({itens.length})
      </p>
      <div className="space-y-3">
        {itens.map((e) => (
          <div key={e.id} className="rounded-xl bg-white dark:bg-gray-900 border border-amber-200/60 dark:border-amber-800/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold dark:text-gray-100">{e.nome}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  CNH {e.cnh_numero || '—'} · {e.veiculo || 'Veículo não informado'} {e.placa ? `· ${e.placa}` : ''}
                </p>
              </div>
              {e.status_documentos === 'rejeitado' && (
                <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs opacity-90 font-bold text-red-600 dark:text-red-400">Reenviado</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => abrirDocumento(e.cnh_arquivo_url)} className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200">
                <FileText size={12} /> Ver CNH
              </button>
              <button onClick={() => abrirDocumento(e.veiculo_doc_arquivo_url)} className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200">
                <FileText size={12} /> {tDynamic('Ver doc. veículo')}
              </button>
            </div>

            {rejeitando === e.id ? (
              <div className="mt-3 space-y-2">
                <input value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Motivo da rejeição (o entregador vai ver isso)"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-xs dark:bg-gray-950 dark:text-white" />
                <div className="flex gap-2">
                  <button onClick={() => { setRejeitando(null); setMotivo(''); }} className="flex-1 rounded-lg bg-gray-100 dark:bg-gray-800 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">Cancelar</button>
                  <button onClick={() => confirmarRejeicao(e.id)} disabled={!motivo.trim() || processando === e.id}
                    className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 py-1.5 text-xs font-bold text-white disabled:opacity-50">{tDynamic('Confirmar rejeição')}</button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <button onClick={() => setRejeitando(e.id)} disabled={processando === e.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-500/10 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-50">
                  <XCircle size={14} /> Rejeitar
                </button>
                <button onClick={() => aprovar(e.id)} disabled={processando === e.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50">
                  {processando === e.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Aprovar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
