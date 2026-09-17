import { useState } from 'react';
import { ROTULOS } from '../../data/ferramentasData';
import { brl, calcularCmvPeriodo, calcularCmvPrato, lerNumero, pct } from '../../lib/ferramentas';
import { BotaoCompartilhar, Campo, Numero, PainelResultado } from './ui';
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

  const vazioPrato = [custo, preco].some((v) => !v.trim());
  const prato = calcularCmvPrato(lerNumero(custo), lerNumero(preco));

  const aba_ = (id: 'mes' | 'prato', rotulo: string) => (
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
        {aba_('mes', tx(ROTULOS.abaMes))}
        {aba_('prato', tx(ROTULOS.abaPrato))}
      </div>

      {aba === 'mes' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-4">
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
                    Number.isFinite(metaNum) && metaNum > 0
                      ? `${pct(Math.abs(mes.valor.cmvPct - metaNum))} ${
                          mes.valor.cmvPct > metaNum ? tx(ROTULOS.acimaMeta) : tx(ROTULOS.dentroMeta)
                        }`
                      : undefined
                  }
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Numero rotulo={tx(ROTULOS.cmvReais)} valor={brl(mes.valor.cmv)} />
                  <Numero rotulo={tx(ROTULOS.margemBruta)} valor={brl(mes.valor.margemBruta)} />
                </div>
                <BotaoCompartilhar
                  path={PATH}
                  texto={`${tx(ROTULOS.cmvPct)}: ${pct(mes.valor.cmvPct)} (${brl(mes.valor.cmv)} / ${brl(lerNumero(fat))})`}
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
                <Numero rotulo={tx(ROTULOS.sobraUnidade)} valor={brl(prato.valor.sobraPorUnidade)} />
                <BotaoCompartilhar
                  path={PATH}
                  texto={`${tx(ROTULOS.abaPrato)}: ${pct(prato.valor.cmvPct)} (${brl(lerNumero(custo))} / ${brl(lerNumero(preco))})`}
                />
              </>
            )}
          </PainelResultado>
        </div>
      )}
    </div>
  );
}
