import { useState } from 'react';
import { ROTULOS } from '../../data/ferramentasData';
import { brl, calcularCmvPeriodo, calcularCmvPrato, lerNumero, pct, pontoDeCmv } from '../../lib/ferramentas';
import { BarraSegmentos, BotaoCompartilhar, Campo, Leitura, Numero, PainelResultado } from './ui';
import { CORES_FATIA } from './cores';
import { useTxt } from './useTxt';

const PATH = '/ferramentas/calculadora-cmv';

export default function CalculadoraCmv() {
  const tx = useTxt();
  const [aba, setAba] = useState<'mes' | 'prato'>('mes');

  const [ei, setEi] = useState('');
  const [compras, setCompras] = useState('');
  const [ef, setEf] = useState('');
  const [fat, setFat] = useState('');
  const [meta, setMeta] = useState('');

  const [custo, setCusto] = useState('');
  const [preco, setPreco] = useState('');

  const vazioMes = [ei, compras, ef, fat].some((v) => !v.trim());
  const mes = calcularCmvPeriodo({
    estoqueInicial: lerNumero(ei),
    compras: lerNumero(compras),
    estoqueFinal: lerNumero(ef),
    faturamento: lerNumero(fat),
  });
  const metaNum = lerNumero(meta);
  const temMeta = Number.isFinite(metaNum) && metaNum > 0;

  const vazioPrato = [custo, preco].some((v) => !v.trim());
  const prato = calcularCmvPrato(lerNumero(custo), lerNumero(preco));

  const botaoAba = (id: 'mes' | 'prato', rotulo: string) => (
    <button
      type="button"
      onClick={() => setAba(id)}
      aria-pressed={aba === id}
      className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        aba === id ? 'bg-[#004198] text-white shadow' : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/10'
      }`}
    >
      {rotulo}
    </button>
  );

  return (
    <div>
      <div className="mb-5 flex gap-2 rounded-2xl border border-gray-200 bg-white p-1.5 dark:border-white/10 dark:bg-white/5">
        {botaoAba('mes', tx(ROTULOS.abaMes))}
        {botaoAba('prato', tx(ROTULOS.abaPrato))}
      </div>

      {aba === 'mes' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <Campo rotulo={tx(ROTULOS.estoqueInicial)} valor={ei} onChange={setEi} />
            <Campo rotulo={tx(ROTULOS.compras)} valor={compras} onChange={setCompras} />
            <Campo rotulo={tx(ROTULOS.estoqueFinal)} valor={ef} onChange={setEf} />
            <Campo rotulo={tx(ROTULOS.faturamento)} valor={fat} onChange={setFat} />
            <Campo rotulo={tx(ROTULOS.metaCmv)} valor={meta} onChange={setMeta} sufixo="%" />
          </div>

          <PainelResultado vazio={vazioMes} motivo={mes.ok ? undefined : mes.motivo}>
            {mes.ok && (
              <>
                <Numero
                  destaque
                  rotulo={tx(ROTULOS.cmvPct)}
                  valor={pct(mes.valor.cmvPct)}
                  nota={
                    temMeta
                      ? `${pct(Math.abs(mes.valor.cmvPct - metaNum))} ${
                          mes.valor.cmvPct > metaNum ? tx(ROTULOS.acimaMeta) : tx(ROTULOS.dentroMeta)
                        }`
                      : undefined
                  }
                />

                <BarraSegmentos
                  segmentos={[
                    { rotulo: tx(ROTULOS.cmvReais), valor: brl(mes.valor.cmv), pct: mes.valor.cmvPct, cor: CORES_FATIA.custo },
                    {
                      rotulo: tx(ROTULOS.restanteFaturamento),
                      valor: brl(mes.valor.margemBruta),
                      pct: Math.max(0, 100 - mes.valor.cmvPct),
                      cor: CORES_FATIA.sobra,
                    },
                  ]}
                  marcador={temMeta ? { pct: metaNum, rotulo: tx(ROTULOS.marcadorMeta) } : undefined}
                />

                <Numero rotulo={tx(ROTULOS.pontoDeCmv)} valor={brl(pontoDeCmv(lerNumero(fat)))} />

                <Leitura
                  texto={
                    temMeta && mes.valor.cmvPct > metaNum
                      ? `${pct(mes.valor.cmvPct - metaNum)} acima da sua meta equivalem a ${brl(
                          (mes.valor.cmvPct - metaNum) * pontoDeCmv(lerNumero(fat)),
                        )} neste mês.`
                      : `Cada ponto de CMV vale ${brl(pontoDeCmv(lerNumero(fat)))} no seu faturamento atual.`
                  }
                />

                <BotaoCompartilhar
                  path={PATH}
                  texto={`CMV: ${pct(mes.valor.cmvPct)} — ${brl(mes.valor.cmv)} sobre ${brl(lerNumero(fat))}`}
                />
              </>
            )}
          </PainelResultado>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <Campo rotulo={tx(ROTULOS.custoIngredientes)} valor={custo} onChange={setCusto} />
            <Campo rotulo={tx(ROTULOS.precoVenda)} valor={preco} onChange={setPreco} />
          </div>
          <PainelResultado vazio={vazioPrato} motivo={prato.ok ? undefined : prato.motivo}>
            {prato.ok && (
              <>
                <Numero destaque rotulo={tx(ROTULOS.cmvPct)} valor={pct(prato.valor.cmvPct)} />
                <BarraSegmentos
                  segmentos={[
                    { rotulo: tx(ROTULOS.custoParte), valor: brl(lerNumero(custo)), pct: prato.valor.cmvPct, cor: CORES_FATIA.custo },
                    {
                      rotulo: tx(ROTULOS.sobraUnidade),
                      valor: brl(prato.valor.sobraPorUnidade),
                      pct: Math.max(0, 100 - prato.valor.cmvPct),
                      cor: CORES_FATIA.sobra,
                    },
                  ]}
                />
                <Leitura
                  texto={`De cada ${brl(lerNumero(preco))} vendidos, ${brl(lerNumero(custo))} já estavam no prato antes de pagar aluguel, equipe e taxas.`}
                />
                <BotaoCompartilhar
                  path={PATH}
                  texto={`CMV do prato: ${pct(prato.valor.cmvPct)} — ${brl(lerNumero(custo))} de ${brl(lerNumero(preco))}`}
                />
              </>
            )}
          </PainelResultado>
        </div>
      )}
    </div>
  );
}
