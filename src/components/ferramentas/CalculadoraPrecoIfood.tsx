import { useState } from 'react';
import { ROTULOS } from '../../data/ferramentasData';
import { brl, calcularPrecoCanal, lerNumero, pct } from '../../lib/ferramentas';
import { BotaoCompartilhar, Campo, Numero, PainelResultado } from './ui';
import { useTxt } from './useTxt';

const PATH = '/ferramentas/preco-ifood';

/**
 * Referências públicas de 2026 (ver ferramentasData.ts). São ponto de partida
 * editável, não a taxa do contrato de quem está usando.
 */
const PLANOS = [
  { id: 'basico', rotulo: ROTULOS.planoBasico, comissao: '12', pagamento: '3,2' },
  { id: 'entrega', rotulo: ROTULOS.planoEntrega, comissao: '23', pagamento: '3,5' },
] as const;

export default function CalculadoraPrecoIfood() {
  const tx = useTxt();
  const [preco, setPreco] = useState('');
  const [comissao, setComissao] = useState<string>(PLANOS[1].comissao);
  const [pagamento, setPagamento] = useState<string>(PLANOS[1].pagamento);
  const [fixa, setFixa] = useState('0');

  const vazio = [preco, comissao, pagamento].some((v) => !v.trim());
  const r = calcularPrecoCanal({
    precoBalcao: lerNumero(preco),
    comissaoPct: lerNumero(comissao),
    taxaPagamentoPct: lerNumero(pagamento),
    taxaFixa: fixa.trim() ? lerNumero(fixa) : 0,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <div>
          <div className="flex gap-2">
            {PLANOS.map((p) => {
              const ativo = comissao === p.comissao && pagamento === p.pagamento;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => {
                    setComissao(p.comissao);
                    setPagamento(p.pagamento);
                  }}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    ativo
                      ? 'border-[#FC5B24] bg-[#FC5B24]/10 text-[#FC5B24]'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  {tx(p.rotulo)}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">{tx(ROTULOS.confiraContrato)}</p>
        </div>
        <Campo rotulo={tx(ROTULOS.precoBalcao)} valor={preco} onChange={setPreco} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo={tx(ROTULOS.comissao)} valor={comissao} onChange={setComissao} sufixo="%" />
          <Campo rotulo={tx(ROTULOS.taxaPagamento)} valor={pagamento} onChange={setPagamento} sufixo="%" />
        </div>
        <Campo rotulo={tx(ROTULOS.taxaFixa)} valor={fixa} onChange={setFixa} />
      </div>

      <PainelResultado vazio={vazio} motivo={r.ok ? undefined : r.motivo}>
        {r.ok && (
          <>
            <Numero
              destaque
              rotulo={tx(ROTULOS.precoSugerido)}
              valor={brl(r.valor.precoSugerido)}
              nota={`+${pct(r.valor.aumentoPct)} ${tx(ROTULOS.aumento)}`}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Numero rotulo={tx(ROTULOS.recebeMesmoPreco)} valor={brl(r.valor.recebeMesmoPreco)} />
              <Numero rotulo={tx(ROTULOS.ficaNoCanal)} valor={brl(r.valor.perdaMesmoPreco)} />
            </div>
            <BotaoCompartilhar
              path={PATH}
              texto={`${tx(ROTULOS.precoBalcao)}: ${brl(lerNumero(preco))} → ${tx(ROTULOS.precoSugerido)}: ${brl(r.valor.precoSugerido)}`}
            />
          </>
        )}
      </PainelResultado>
    </div>
  );
}
