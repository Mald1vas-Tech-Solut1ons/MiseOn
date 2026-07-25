import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, UploadCloud, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CtxEntregador } from './EntregadorLayout';

type StatusDocs = 'pendente' | 'aprovado' | 'rejeitado';

const STATUS_INFO: Record<StatusDocs, { label: string; cor: string; icone: ReactNode }> = {
  pendente: { label: 'Aguardando aprovação da loja', cor: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icone: <Clock size={16} /> },
  aprovado: { label: 'Documentos aprovados', cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icone: <CheckCircle2 size={16} /> },
  rejeitado: { label: 'Documentos rejeitados — reenvie', cor: 'text-red-400 bg-red-500/10 border-red-500/20', icone: <XCircle size={16} /> },
};

export default function EntregadorDocumentos() {
  const ctx = useOutletContext<CtxEntregador>();
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [statusDocs, setStatusDocs] = useState<StatusDocs>('pendente');
  const [motivoRejeicao, setMotivoRejeicao] = useState<string | null>(null);
  const [cnhNumero, setCnhNumero] = useState('');
  const [cnhArquivoPath, setCnhArquivoPath] = useState<string | null>(null);
  const [veiculoArquivoPath, setVeiculoArquivoPath] = useState<string | null>(null);
  const [placa, setPlaca] = useState('');
  const [veiculo, setVeiculo] = useState('');

  const [novoCnhArquivo, setNovoCnhArquivo] = useState<File | null>(null);
  const [novoVeiculoArquivo, setNovoVeiculoArquivo] = useState<File | null>(null);
  const cnhRef = useRef<HTMLInputElement>(null);
  const veiculoRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    setCarregando(true);
    const { data } = await supabase
      .from('entregadores')
      .select('cnh_numero, cnh_arquivo_url, veiculo_doc_arquivo_url, status_documentos, motivo_rejeicao, veiculo, placa')
      .eq('id', ctx.entregadorId)
      .maybeSingle();
    if (data) {
      setCnhNumero(data.cnh_numero ?? '');
      setCnhArquivoPath(data.cnh_arquivo_url);
      setVeiculoArquivoPath(data.veiculo_doc_arquivo_url);
      setStatusDocs((data.status_documentos as StatusDocs) ?? 'pendente');
      setMotivoRejeicao(data.motivo_rejeicao);
      setVeiculo(data.veiculo ?? '');
      setPlaca(data.placa ?? '');
    }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [ctx.entregadorId]);

  const enviar = async () => {
    if (!cnhNumero.trim()) return setErro('Informe o número da CNH.');
    if (!novoCnhArquivo && !cnhArquivoPath) return setErro('Envie a foto/PDF da CNH.');
    if (!novoVeiculoArquivo && !veiculoArquivoPath) return setErro('Envie a foto/PDF do documento do veículo.');

    setErro(''); setSucesso(''); setEnviando(true);
    try {
      let cnhPath = cnhArquivoPath;
      let veiculoPath = veiculoArquivoPath;

      if (novoCnhArquivo) {
        const ext = novoCnhArquivo.name.split('.').pop();
        const caminho = `${ctx.lojaId}/${ctx.user.id}/cnh.${ext}`;
        const { error } = await supabase.storage.from('entregador-docs').upload(caminho, novoCnhArquivo, { upsert: true });
        if (error) throw error;
        cnhPath = caminho;
      }
      if (novoVeiculoArquivo) {
        const ext = novoVeiculoArquivo.name.split('.').pop();
        const caminho = `${ctx.lojaId}/${ctx.user.id}/veiculo.${ext}`;
        const { error } = await supabase.storage.from('entregador-docs').upload(caminho, novoVeiculoArquivo, { upsert: true });
        if (error) throw error;
        veiculoPath = caminho;
      }

      const { error: updErr } = await supabase.from('entregadores').update({
        cnh_numero: cnhNumero.trim(),
        cnh_arquivo_url: cnhPath,
        veiculo_doc_arquivo_url: veiculoPath,
        veiculo: veiculo.trim() || null,
        placa: placa.trim() || null,
        status_documentos: 'pendente',
        documentos_enviados_em: new Date().toISOString(),
        motivo_rejeicao: null,
      }).eq('id', ctx.entregadorId);
      if (updErr) throw updErr;

      setSucesso('Documentos enviados! A loja vai revisar e aprovar seu cadastro.');
      setNovoCnhArquivo(null); setNovoVeiculoArquivo(null);
      carregar();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao enviar documentos.');
    }
    setEnviando(false);
  };

  if (carregando) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 size={28} className="animate-spin text-orange-500" />
    </div>
  );

  const info = STATUS_INFO[statusDocs];

  return (
    <div className="p-4 space-y-5 pb-20">
      <div>
        <h1 className="text-lg font-bold text-white">Meus documentos</h1>
        <p className="text-sm text-gray-400 mt-1">CNH e documento do veículo, exigidos para rodar entregas.</p>
      </div>

      <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${info.cor}`}>
        {info.icone} {info.label}
      </div>
      {statusDocs === 'rejeitado' && motivoRejeicao && (
        <p className="text-xs text-red-300 -mt-3 px-1">Motivo: {motivoRejeicao}</p>
      )}

      {erro && <p className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{erro}</p>}
      {sucesso && <p className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400">{sucesso}</p>}

      <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">CNH</p>
        <input value={cnhNumero} onChange={(e) => setCnhNumero(e.target.value)} placeholder="Número da CNH"
          className="w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm text-white" />
        <input type="file" ref={cnhRef} accept="image/*,.pdf" className="hidden" onChange={(e) => setNovoCnhArquivo(e.target.files?.[0] ?? null)} />
        <button onClick={() => cnhRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 p-3 text-sm font-semibold text-gray-300 hover:bg-gray-800">
          <UploadCloud size={18} /> {novoCnhArquivo ? novoCnhArquivo.name : cnhArquivoPath ? 'Trocar arquivo da CNH' : 'Enviar foto/PDF da CNH'}
        </button>
      </div>

      <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Veículo</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={veiculo} onChange={(e) => setVeiculo(e.target.value)} placeholder="Modelo (ex: Honda CG 160)"
            className="rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm text-white" />
          <input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="Placa"
            className="rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm text-white" />
        </div>
        <input type="file" ref={veiculoRef} accept="image/*,.pdf" className="hidden" onChange={(e) => setNovoVeiculoArquivo(e.target.files?.[0] ?? null)} />
        <button onClick={() => veiculoRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 p-3 text-sm font-semibold text-gray-300 hover:bg-gray-800">
          <FileText size={18} /> {novoVeiculoArquivo ? novoVeiculoArquivo.name : veiculoArquivoPath ? 'Trocar documento do veículo (CRLV)' : 'Enviar documento do veículo (CRLV)'}
        </button>
      </div>

      <button onClick={enviar} disabled={enviando}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 py-4 font-bold text-white shadow-lg disabled:opacity-50">
        {enviando ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
        {enviando ? 'Enviando...' : 'Enviar para aprovação'}
      </button>
    </div>
  );
}
