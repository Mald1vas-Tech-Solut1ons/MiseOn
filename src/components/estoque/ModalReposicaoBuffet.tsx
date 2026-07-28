import React, { useState, useEffect } from 'react';
import { Scale, RefreshCw, X, Check, Utensils, AlertTriangle, ArchiveRestore, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { type Insumo, type ReposicaoBuffet } from '../../types';

interface ModalReposicaoBuffetProps {
  lojaId: string;
  preparosAtivos: Insumo[];
  onSucesso: () => void;
  onCancelar: () => void;
}

export function ModalReposicaoBuffet({
  lojaId,
  preparosAtivos,
  onSucesso,
  onCancelar,
}: ModalReposicaoBuffetProps) {
  const [aba, setAba] = useState<'ENVIAR' | 'RECOLHER'>('ENVIAR');
  const [preparoId, setPreparoId] = useState<string>(preparosAtivos[0]?.id || '');
  const [nomeCuba, setNomeCuba] = useState<string>('Cuba Pista Principal');
  const [pesoKgInput, setPesoKgInput] = useState<string>('5.000');
  
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>('');
  
  const [cubasNaPista, setCubasNaPista] = useState<ReposicaoBuffet[]>([]);
  const [carregandoCubas, setCarregandoCubas] = useState(false);
  
  // Para fechamento:
  const [cubaSendoFechada, setCubaSendoFechada] = useState<ReposicaoBuffet | null>(null);
  const [sobraLimpaKg, setSobraLimpaKg] = useState<string>('0.000');
  const [reaproveitarSobra, setReaproveitarSobra] = useState(false);

  const preparoSelecionado = preparosAtivos.find((p) => p.id === preparoId) || preparosAtivos[0];

  useEffect(() => {
    if (aba === 'RECOLHER') carregarCubasAtivas();
  }, [aba, lojaId]);

  const carregarCubasAtivas = async () => {
    setCarregandoCubas(true);
    const { data } = await supabase
      .from('reposicoes_buffet')
      .select('*, preparo:insumos(*)')
      .eq('loja_id', lojaId)
      .eq('status', 'NA_PISTA')
      .order('criado_em', { ascending: false });
    if (data) setCubasNaPista(data as any[]);
    setCarregandoCubas(false);
  };

  const confirmarEnvio = async () => {
    setErro('');
    const pesoKg = parseFloat(pesoKgInput.replace(',', '.'));

    if (!preparoId || isNaN(pesoKg) || pesoKg <= 0) {
      setErro('Informe um prato pronto válido e um peso maior que zero.');
      return;
    }
    if (preparoSelecionado && Number(preparoSelecionado.quantidade_atual) < pesoKg) {
      setErro(`Estoque insuficiente! Você tem apenas ${preparoSelecionado.quantidade_atual} ${preparoSelecionado.unidade_medida} prontos.`);
      return;
    }

    setSalvando(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();

      const { error: repError } = await supabase
        .from('reposicoes_buffet')
        .insert({
          loja_id: lojaId,
          preparo_id: preparoId,
          nome_cuba: nomeCuba.trim() || 'Cuba de Buffet',
          peso_reposto_kg: pesoKg,
          status: 'NA_PISTA',
          preparado_por: userRes.user?.id || null,
        })
        .select()
        .single();
      if (repError) throw repError;

      await supabase.from('movimentacoes_estoque').insert({
        loja_id: lojaId,
        insumo_id: preparoId,
        tipo: 'SAIDA',
        quantidade: -pesoKg,
        motivo: `Enviado para a Pista (${nomeCuba})`,
      });

      await supabase.from('insumos')
        .update({ quantidade_atual: Number(preparoSelecionado.quantidade_atual) - pesoKg })
        .eq('id', preparoId);

      onSucesso();
    } catch (err: any) {
      setErro(err.message || 'Falha ao registrar envio para a pista.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarRecolhimento = async () => {
    if (!cubaSendoFechada) return;
    setErro('');
    const sobra = parseFloat(sobraLimpaKg.replace(',', '.'));
    if (isNaN(sobra) || sobra < 0) {
      setErro('Peso de sobra inválido.');
      return;
    }

    setSalvando(true);
    try {
      // 1. Atualizar a reposição para FECHADO e salvar a sobra limpa
      await supabase.from('reposicoes_buffet')
        .update({ status: 'FECHADO', peso_sobra_limpa_kg: sobra })
        .eq('id', cubaSendoFechada.id);

      // 2. Se for reaproveitar, gera uma ENTRADA devolvendo ao estoque de Preparos.
      // Se NÃO for reaproveitar, o alimento vai pro lixo (Sobra Limpa vira perda financeira).
      // Como a saída já foi dada na totalidade quando foi pra pista, se jogou fora, já está fora do estoque.
      // Porém, podemos registrar uma PERDA contábil para o relatório. (Isso é opcional, pois a saída já cobriu o CMV).
      
      if (reaproveitarSobra && sobra > 0) {
        await supabase.from('movimentacoes_estoque').insert({
          loja_id: lojaId,
          insumo_id: cubaSendoFechada.preparo_id,
          tipo: 'ENTRADA',
          quantidade: sobra,
          motivo: `Retorno de Pista (Reaproveitamento de Sobra Limpa)`,
        });
        const prepAtual = preparosAtivos.find(p => p.id === cubaSendoFechada.preparo_id);
        if (prepAtual) {
           await supabase.from('insumos')
             .update({ quantidade_atual: Number(prepAtual.quantidade_atual) + sobra })
             .eq('id', prepAtual.id);
        }
      }

      setCubaSendoFechada(null);
      await carregarCubasAtivas();
    } catch (err: any) {
      setErro(err.message || 'Falha ao recolher cuba.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-400 border border-orange-500/20">
              <Scale size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">KDS Buffet (Pista)</h2>
              <p className="text-xs text-slate-400">Transferências e apuração de sobras limpas</p>
            </div>
          </div>
          <button onClick={onCancelar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition">
            <X size={20} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex bg-slate-950 p-1 rounded-xl shadow-inner">
           <button onClick={() => setAba('ENVIAR')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${aba === 'ENVIAR' ? 'bg-slate-800 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>Enviar p/ Pista</button>
           <button onClick={() => setAba('RECOLHER')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${aba === 'RECOLHER' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>Recolher (Sobra Limpa)</button>
        </div>

        {erro && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-300 border border-rose-500/30">
            <AlertTriangle size={16} />
            <span>{erro}</span>
          </div>
        )}

        {aba === 'ENVIAR' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Prato Pronto (Cozinha)</label>
              <select value={preparoId} onChange={(e) => setPreparoId(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-orange-500 focus:outline-none">
                {preparosAtivos.length === 0 && <option value="">Nenhuma receita base produzida</option>}
                {preparosAtivos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} — Estoque: {p.quantidade_atual} {p.unidade_medida}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Local / Cuba</label>
                <input type="text" placeholder="Ex: Cuba #01 Quente" value={nomeCuba} onChange={(e) => setNomeCuba(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Peso (kg/L/un)</label>
                <input type="text" placeholder="Ex: 5.000" value={pesoKgInput} onChange={(e) => setPesoKgInput(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-orange-500 focus:outline-none font-mono" />
              </div>
            </div>
            <div className="rounded-xl bg-slate-950 p-4 border border-slate-800/80 text-xs space-y-1">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Utensils size={14} className="text-amber-400" /> Transferência Limpa
              </div>
              <p className="text-slate-400">Isso abaterá <b>{pesoKgInput || 0} {preparoSelecionado?.unidade_medida}</b> do estoque da cozinha. O alimento passa a estar "Na Pista".</p>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button onClick={onCancelar} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition">Cancelar</button>
              <button onClick={confirmarEnvio} disabled={salvando} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg hover:brightness-110 transition disabled:opacity-50">
                {salvando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Check size={16} /><span>Confirmar Envio Pista</span></>}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
            {!cubaSendoFechada ? (
               <>
                 <p className="text-xs text-slate-400 mb-2">Cubas atualmente na pista. Ao final do turno, recolha e pese a sobra.</p>
                 {carregandoCubas ? (
                    <div className="text-center p-4 text-slate-500"><RefreshCw className="h-5 w-5 animate-spin mx-auto" /></div>
                 ) : cubasNaPista.length === 0 ? (
                    <div className="text-center p-8 bg-slate-950 rounded-2xl border border-slate-800">
                      <Utensils size={24} className="mx-auto text-slate-600 mb-2" />
                      <p className="text-sm text-slate-400">Nenhuma cuba ativa na pista.</p>
                    </div>
                 ) : (
                   <div className="max-h-64 overflow-y-auto space-y-2 pr-1 hide-scrollbar">
                     {cubasNaPista.map(cuba => (
                       <div key={cuba.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                         <div>
                           <p className="text-sm font-bold text-slate-200">{cuba.preparo?.nome}</p>
                           <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Clock size={10} /> Enviado às {new Date(cuba.criado_em).toLocaleTimeString('pt-BR')} · {cuba.peso_reposto_kg} {cuba.preparo?.unidade_medida}</p>
                         </div>
                         <button onClick={() => setCubaSendoFechada(cuba)} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                           Recolher
                         </button>
                       </div>
                     ))}
                   </div>
                 )}
               </>
            ) : (
               <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30">
                 <h3 className="font-bold text-slate-200 flex items-center gap-2 mb-4"><ArchiveRestore size={18} className="text-blue-400" /> Fechamento de Cuba</h3>
                 
                 <div className="mb-4">
                   <p className="text-sm text-slate-300"><b>Item:</b> {cubaSendoFechada.preparo?.nome}</p>
                   <p className="text-xs text-slate-500">Enviado: {cubaSendoFechada.peso_reposto_kg} {cubaSendoFechada.preparo?.unidade_medida}</p>
                 </div>
                 
                 <div className="space-y-4">
                   <div>
                     <label className="block text-xs font-medium text-slate-400 mb-1">Peso da Sobra Limpa ({cubaSendoFechada.preparo?.unidade_medida})</label>
                     <input type="text" value={sobraLimpaKg} onChange={(e) => setSobraLimpaKg(e.target.value)} className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none font-mono" />
                   </div>
                   
                   <label className="flex items-center gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800 cursor-pointer">
                     <input type="checkbox" checked={reaproveitarSobra} onChange={(e) => setReaproveitarSobra(e.target.checked)} className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0 focus:ring-offset-0" />
                     <div>
                       <p className="text-xs font-bold text-slate-200">Reaproveitar no Estoque</p>
                       <p className="text-[10px] text-slate-500">Se marcado, o peso da sobra voltará para o estoque da cozinha. Senão, será descartado.</p>
                     </div>
                   </label>
                 </div>
                 
                 <div className="flex items-center justify-end gap-3 pt-5">
                   <button onClick={() => setCubaSendoFechada(null)} className="text-xs text-slate-400 hover:text-slate-200 font-semibold">Voltar</button>
                   <button onClick={confirmarRecolhimento} disabled={salvando} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-blue-500 transition disabled:opacity-50">
                     {salvando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <span>Encerrar Cuba</span>}
                   </button>
                 </div>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
