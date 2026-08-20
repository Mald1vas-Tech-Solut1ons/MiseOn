/**
 * Aba "Rastreio 3D" do Estoque: carrega TODOS os itens da loja (por setor) e
 * as receitas checáveis, e entrega ao renderizador WebGL. Concentra aqui os
 * estados de carregando/erro/vazio para que o Rastreio3D só precise desenhar.
 */

import { useEffect, useState } from 'react';
import { Boxes, AlertTriangle, ScanLine } from 'lucide-react';
import { Rastreio3D } from './Rastreio3D';
import { carregarRastreio, type SetorRastreio } from './carregarRastreio';
import { carregarDadosReceitas, type DadosReceitas } from './receitas';

import { useI18n } from '../../../contexts/I18nContext';
export function EstoqueRastreio3D({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [setores, setSetores] = useState<SetorRastreio[] | null>(null);
  const [dadosReceitas, setDadosReceitas] = useState<DadosReceitas | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setSetores(null);
    setErro(null);
    Promise.all([
      carregarRastreio(lojaId),
      // Receitas são complemento: se falhar, o rastreio continua sem o seletor.
      carregarDadosReceitas(lojaId).catch(() => null),
    ])
      .then(([s, r]) => {
        if (!vivo) return;
        setSetores(s);
        setDadosReceitas(r);
      })
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : String(e)));
    return () => { vivo = false; };
  }, [lojaId]);

  if (erro) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:bg-red-900/20 dark:border-red-900/50 flex items-start gap-3">
        <AlertTriangle className="text-red-500 shrink-0" size={20} />
        <div>
          <p className="font-bold text-red-800 dark:text-red-300">{tDynamic('Não foi possível montar o rastreio')}</p>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">{erro}</p>
        </div>
      </div>
    );
  }

  if (!setores) {
    return (
      <div className="h-[620px] rounded-2xl bg-gray-100 dark:bg-gray-800/40 animate-pulse flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{tDynamic('Rastreando o estoque por setor…')}</p>
      </div>
    );
  }

  const totalItens = setores.reduce((acc, s) => acc + s.itens.length, 0);
  const totalInvestido = setores.reduce((acc, s) => acc + s.totalInvestido, 0);
  const totalAlertas = setores.reduce((acc, s) => acc + s.alertas, 0);

  if (totalItens === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-10 text-center">
        <Boxes className="mx-auto text-gray-400 mb-3" size={32} />
        <p className="font-bold dark:text-gray-200">{tDynamic('Nenhum item ativo no estoque')}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
          O rastreio aparece quando houver insumos cadastrados. Registre itens em
          "Matérias-Primas" para vê-los por setor, da compra ao uso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold dark:text-gray-100 flex items-center gap-2">
            <ScanLine size={18} className="text-cyan-500" /> {tDynamic('Rastreio 3D do estoque')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Todos os itens por setor (❄️ geladeira, 🗄️ armário, 🥫 dispensa): o valor da compra
            subdividido até a unidade de uso. ⚠️ marca etapa humana (rendimento declarado).
            Selecione uma receita para checar os ingredientes.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400">
            {tDynamic('Investido em estoque')}
          </p>
          <p className="text-lg font-black text-green-700 dark:text-green-400">
            {totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          {totalAlertas > 0 && (
            <p className="text-[11px] font-bold text-red-500">{totalAlertas} itens pedem atenção</p>
          )}
        </div>
      </div>

      <Rastreio3D setores={setores} dadosReceitas={dadosReceitas} altura={620} />
    </div>
  );
}

export default EstoqueRastreio3D;
