import React, { useState } from 'react';
import { Scale, RefreshCw, X, Check, Utensils, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, type Produto } from '../../types';

interface ModalReposicaoBuffetProps {
  lojaId: string;
  produtosBuffet: Produto[];
  onSucesso: () => void;
  onCancelar: () => void;
}

export function ModalReposicaoBuffet({
  lojaId,
  produtosBuffet,
  onSucesso,
  onCancelar,
}: ModalReposicaoBuffetProps) {
  const [produtoId, setProdutoId] = useState<string>(produtosBuffet[0]?.id || '');
  const [nomeCuba, setNomeCuba] = useState<string>('Cuba Pista Principal');
  const [pesoKgInput, setPesoKgInput] = useState<string>('5.000');
  const [observacao, setObservacao] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>('');

  const produtoSelecionado = produtosBuffet.find((p) => p.id === produtoId) || produtosBuffet[0];

  const confirmarReposicao = async () => {
    setErro('');
    const pesoKg = parseFloat(pesoKgInput.replace(',', '.'));

    if (!produtoId || isNaN(pesoKg) || pesoKg <= 0) {
      setErro('Informe um produto de buffet e um peso válido maior que zero.');
      return;
    }

    setSalvando(true);

    try {
      const { data: userRes } = await supabase.auth.getUser();

      // 1. Inserir registro na tabela reposicoes_buffet
      const { data: repData, error: repError } = await supabase
        .from('reposicoes_buffet')
        .insert({
          loja_id: lojaId,
          produto_id: produtoId,
          nome_cuba: nomeCuba.trim() || 'Cuba de Buffet',
          peso_reposto_kg: pesoKg,
          preparado_por: userRes.user?.id || null,
          observacao: observacao.trim() || null,
        })
        .select()
        .single();

      if (repError) throw repError;

      // 2. Buscar Ficha Técnica (insumos) do produto de buffet
      const { data: fichaInsumos } = await supabase
        .from('fichas_tecnicas')
        .select('insumo_id, quantidade, insumos(nome, unidade_medida, custo_unitario, estoque_atual)')
        .eq('produto_id', produtoId);

      let custoTotalInsumos = 0;

      // 3. Dar baixa proporcional no estoque para cada insumo da Ficha Técnica
      if (fichaInsumos && fichaInsumos.length > 0) {
        for (const f of fichaInsumos) {
          const qtdBase = Number(f.quantidade || 0); // quantidade por kg de prato pronto
          const qtdConsumida = qtdBase * pesoKg;
          const insumo = f.insumos as any;
          const custoInsumo = (insumo?.custo_unitario || 0) * qtdConsumida;
          custoTotalInsumos += custoInsumo;

          // Registrar movimentação de saída do estoque
          await supabase.from('movimentacoes_estoque').insert({
            loja_id: lojaId,
            insumo_id: f.insumo_id,
            tipo_movimentacao: 'SAIDA_MANUAL',
            quantidade: -Math.abs(qtdConsumida),
            custo_unitario: insumo?.custo_unitario || 0,
            motivo: `Reposição de Buffet: ${pesoKg.toFixed(3)}kg de ${produtoSelecionado?.nome || 'Buffet'} (${nomeCuba})`,
          });

          // Atualizar saldo atual do insumo
          if (insumo && insumo.estoque_atual != null) {
            const novoEstoque = Number(insumo.estoque_atual) - qtdConsumida;
            await supabase
              .from('insumos')
              .update({ estoque_atual: novoEstoque })
              .eq('id', f.insumo_id);
          }
        }

        // Atualizar custo estimado na reposição
        await supabase
          .from('reposicoes_buffet')
          .update({ custo_estimado_total: custoTotalInsumos })
          .eq('id', repData.id);
      }

      onSucesso();
    } catch (err: any) {
      console.error('Erro ao registrar reposição de buffet:', err);
      setErro(err.message || 'Falha ao registrar reposição de buffet.');
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
              <h2 className="text-lg font-bold text-slate-100">Registrar Reposição de Cuba de Buffet</h2>
              <p className="text-xs text-slate-400">Dar baixa profissional nos insumos preparados pela cozinha</p>
            </div>
          </div>
          <button
            onClick={onCancelar}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        {erro && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-300 border border-rose-500/30">
            <AlertTriangle size={16} />
            <span>{erro}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Produto / Cuba de Buffet
            </label>
            <select
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            >
              {produtosBuffet.length === 0 && <option value="">Nenhum produto POR_PESO cadastrado</option>}
              {produtosBuffet.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} — {fmt(p.preco_por_quilo || 0)}/kg
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Identificação da Cuba / Pista
              </label>
              <input
                type="text"
                placeholder="Ex: Cuba #01 - Strogonoff"
                value={nomeCuba}
                onChange={(e) => setNomeCuba(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Peso Reposto (kg)
              </label>
              <input
                type="text"
                placeholder="Ex: 5.000"
                value={pesoKgInput}
                onChange={(e) => setPesoKgInput(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-orange-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Observação / Lote da Cozinha (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Preparado no turno da manhã pelo Chef Lucas."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl bg-slate-950 p-4 border border-slate-800/80 text-xs space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Utensils size={14} className="text-amber-400" /> Baixa Automática no Estoque
            </div>
            <p className="text-slate-400">
              O sistema consumirá automaticamente os insumos da Ficha Técnica de{' '}
              <strong className="text-orange-400">{produtoSelecionado?.nome || 'Buffet'}</strong> na
              proporção exata de <strong className="text-emerald-400">{pesoKgInput || '0'} kg</strong>.
            </p>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onCancelar}
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
          >
            Cancelar
          </button>

          <button
            onClick={confirmarReposicao}
            disabled={salvando}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg hover:brightness-110 transition disabled:opacity-50"
          >
            {salvando ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check size={16} />
                <span>Confirmar Reposição na Pista</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
