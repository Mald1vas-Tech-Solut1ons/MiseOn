import { useState } from 'react';
import { ROTULOS } from '../../data/ferramentasData';
import { brl, calcularMarkup, lerNumero, pct } from '../../lib/ferramentas';
import { BotaoCompartilhar, Campo, Numero, PainelResultado } from './ui';
import { useTxt } from './useTxt';

const PATH = '/ferramentas/markup-preco-de-venda';

export default function CalculadoraMarkup() {
  const tx = useTxt();
  const [custo, setCusto] = useState('');
  const [fixas, setFixas] = useState('');
  const [variaveis, setVariaveis] = useState('');
  const [lucro, setLucro] = useState('');

  const vazio = [custo, fixas, variaveis, lucro].some((v) => !v.trim());
  const r = calcularMarkup({
    custo: lerNumero(custo),
    despesasFixasPct: lerNumero(fixas),
    despesasVariaveisPct: lerNumero(variaveis),
    lucroPct: lerNumero(lucro),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <Campo rotulo={tx(ROTULOS.custoProduto)} valor={custo} onChange={setCusto} />
        <Campo rotulo={tx(ROTULOS.despesasFixas)} valor={fixas} onChange={setFixas} sufixo="%" />
        <Campo rotulo={tx(ROTULOS.despesasVariaveis)} valor={variaveis} onChange={setVariaveis} sufixo="%" dica={tx(ROTULOS.dicaVariaveis)} />
        <Campo rotulo={tx(ROTULOS.lucroDesejado)} valor={lucro} onChange={setLucro} sufixo="%" />
      </div>

      <PainelResultado vazio={vazio} motivo={r.ok ? undefined : r.motivo}>
        {r.ok && (
          <>
            <Numero destaque rotulo={tx(ROTULOS.precoCalculado)} valor={brl(r.valor.precoVenda)} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Numero rotulo={tx(ROTULOS.markupMultiplicador)} valor={r.valor.markup.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} />
              <Numero rotulo={tx(ROTULOS.cmvResultante)} valor={pct(r.valor.cmvPct)} />
              <Numero rotulo={tx(ROTULOS.lucroUnidade)} valor={brl(r.valor.lucroPorUnidade)} />
            </div>
            <BotaoCompartilhar
              path={PATH}
              texto={`${tx(ROTULOS.custoProduto)}: ${brl(lerNumero(custo))} → ${tx(ROTULOS.precoCalculado)}: ${brl(r.valor.precoVenda)}`}
            />
          </>
        )}
      </PainelResultado>
    </div>
  );
}
