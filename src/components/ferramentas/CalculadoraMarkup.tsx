import { useState } from 'react';
import { ROTULOS } from '../../data/ferramentasData';
import { brl, calcularMarkup, calcularPrecoCanal, composicaoDoPreco, lerNumero, pct } from '../../lib/ferramentas';
import { BarraSegmentos, BotaoCompartilhar, Campo, Leitura, Numero, PainelResultado } from './ui';
import { CORES_FATIA } from './cores';
import { useTxt } from './useTxt';

const PATH = '/ferramentas/markup-preco-de-venda';

/** Mesma referência pública de 2026 usada na calculadora do canal. */
const CANAL_PADRAO = { comissaoPct: 23, taxaPagamentoPct: 3.5, taxaFixa: 0 };

const ROTULO_FATIA = {
  custo: ROTULOS.custoParte,
  fixas: ROTULOS.fixasParte,
  variaveis: ROTULOS.variaveisParte,
  lucro: ROTULOS.lucroParte,
} as const;

export default function CalculadoraMarkup() {
  const tx = useTxt();
  const [custo, setCusto] = useState('');
  const [fixas, setFixas] = useState('');
  const [variaveis, setVariaveis] = useState('');
  const [lucro, setLucro] = useState('');

  const entrada = {
    custo: lerNumero(custo),
    despesasFixasPct: lerNumero(fixas),
    despesasVariaveisPct: lerNumero(variaveis),
    lucroPct: lerNumero(lucro),
  };

  const vazio = [custo, fixas, variaveis, lucro].some((v) => !v.trim());
  const r = calcularMarkup(entrada);
  const noCanal = r.ok ? calcularPrecoCanal({ precoBalcao: r.valor.precoVenda, ...CANAL_PADRAO }) : null;

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

            <BarraSegmentos
              segmentos={composicaoDoPreco(entrada, r.valor.precoVenda).map((f) => ({
                rotulo: tx(ROTULO_FATIA[f.chave]),
                valor: brl(f.valor),
                pct: f.pctDoPreco,
                cor: CORES_FATIA[f.chave],
              }))}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <Numero rotulo={tx(ROTULOS.markupMultiplicador)} valor={r.valor.markup.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} />
              <Numero rotulo={tx(ROTULOS.cmvResultante)} valor={pct(r.valor.cmvPct)} />
              <Numero rotulo={tx(ROTULOS.lucroUnidade)} valor={brl(r.valor.lucroPorUnidade)} />
            </div>

            {noCanal && noCanal.ok && (
              <Numero
                rotulo={tx(ROTULOS.precoSugerido)}
                valor={brl(noCanal.valor.precoSugerido)}
                nota={tx(ROTULOS.confiraContrato)}
              />
            )}

            <Leitura
              texto={`Markup ${r.valor.markup.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}× sobre o custo: de cada ${brl(
                r.valor.precoVenda,
              )} vendidos, ${brl(r.valor.lucroPorUnidade)} são lucro — o resto paga produto, loja e taxas.`}
            />

            <BotaoCompartilhar
              path={PATH}
              texto={`Custo ${brl(entrada.custo)} → preço ${brl(r.valor.precoVenda)} (markup ${r.valor.markup.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×)`}
            />
          </>
        )}
      </PainelResultado>
    </div>
  );
}
