import { useState } from 'react';
import { ROTULOS } from '../../data/ferramentasData';
import { brl, calcularPrecoCanal, cenariosDoCanal, lerNumero, pct } from '../../lib/ferramentas';
import { BarraSegmentos, BotaoCompartilhar, Campo, Leitura, Numero, PainelResultado } from './ui';
import { CORES_FATIA } from './cores';
import { useTxt } from './useTxt';

const PATH = '/ferramentas/preco-ifood';

/**
 * Referências públicas de 2026 (ver ferramentasData.ts): ponto de partida
 * editável, nunca a taxa do contrato de quem está usando.
 */
const PLANOS = [
  { id: 'basico', rotulo: ROTULOS.planoBasico, comissao: '12', pagamento: '3,2' },
  { id: 'entrega', rotulo: ROTULOS.planoEntrega, comissao: '23', pagamento: '3,5' },
] as const;

const ROTULO_CENARIO = {
  manter: ROTULOS.cenarioManter,
  meio: ROTULOS.cenarioMeio,
  repassar: ROTULOS.cenarioRepassar,
} as const;

export default function CalculadoraPrecoIfood() {
  const tx = useTxt();
  const [preco, setPreco] = useState('');
  const [comissao, setComissao] = useState<string>(PLANOS[1].comissao);
  const [pagamento, setPagamento] = useState<string>(PLANOS[1].pagamento);
  const [fixa, setFixa] = useState('0');
  const [pedidos, setPedidos] = useState('');

  const entrada = {
    precoBalcao: lerNumero(preco),
    comissaoPct: lerNumero(comissao),
    taxaPagamentoPct: lerNumero(pagamento),
    taxaFixa: fixa.trim() ? lerNumero(fixa) : 0,
  };

  const vazio = [preco, comissao, pagamento].some((v) => !v.trim());
  const r = calcularPrecoCanal(entrada);
  const cenarios = pedidos.trim() ? cenariosDoCanal(entrada, lerNumero(pedidos)) : null;

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
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo={tx(ROTULOS.taxaFixa)} valor={fixa} onChange={setFixa} />
          <Campo rotulo={tx(ROTULOS.pedidosMes)} valor={pedidos} onChange={setPedidos} />
        </div>
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

            <BarraSegmentos
              segmentos={[
                {
                  rotulo: tx(ROTULOS.ficaComVoce),
                  valor: brl(r.valor.recebeMesmoPreco),
                  pct: (r.valor.recebeMesmoPreco / entrada.precoBalcao) * 100,
                  cor: CORES_FATIA.voce,
                },
                {
                  rotulo: tx(ROTULOS.ficaNoCanal),
                  valor: brl(r.valor.perdaMesmoPreco),
                  pct: (r.valor.perdaMesmoPreco / entrada.precoBalcao) * 100,
                  cor: CORES_FATIA.canal,
                },
              ]}
            />

            {cenarios && cenarios.ok && (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                <table className="w-full text-left text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr className="bg-gray-100 dark:bg-white/5">
                      <th className="p-2 font-bold">{tx(ROTULOS.cenarios)}</th>
                      <th className="p-2 font-bold">{tx(ROTULOS.colPreco)}</th>
                      <th className="p-2 font-bold">{tx(ROTULOS.colPedido)}</th>
                      <th className="p-2 font-bold">{tx(ROTULOS.colMes)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cenarios.valor.map((c) => (
                      <tr key={c.chave} className="border-t border-gray-200 dark:border-white/10">
                        <td className="p-2 font-semibold">{tx(ROTULO_CENARIO[c.chave])}</td>
                        <td className="p-2">{brl(c.precoApp)}</td>
                        <td className={`p-2 font-bold ${c.diferencaPorPedido < -0.005 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          {brl(c.diferencaPorPedido)}
                        </td>
                        <td className={`p-2 font-bold ${c.diferencaNoMes < -0.005 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          {brl(c.diferencaNoMes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Leitura
              texto={
                cenarios && cenarios.ok
                  ? `Mantendo o preço do balcão nesse canal, a diferença no mês é de ${brl(
                      cenarios.valor.find((c) => c.chave === 'manter')?.diferencaNoMes ?? 0,
                    )} em ${lerNumero(pedidos).toLocaleString('pt-BR')} pedidos.`
                  : `Cobrando o mesmo preço do balcão, ${brl(r.valor.perdaMesmoPreco)} de cada pedido ficam com o aplicativo. Informe os pedidos do mês para ver o tamanho disso.`
              }
            />

            <BotaoCompartilhar
              path={PATH}
              texto={`Balcão ${brl(entrada.precoBalcao)} → no app ${brl(r.valor.precoSugerido)} para receber o mesmo (taxas: ${pct(entrada.comissaoPct + entrada.taxaPagamentoPct)})`}
            />
          </>
        )}
      </PainelResultado>
    </div>
  );
}
