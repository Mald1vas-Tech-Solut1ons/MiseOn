import { AlertTriangle, BadgeCheck, Banknote, CreditCard, KeyRound, MapPin, Phone, Ticket } from 'lucide-react';
import { fmt, type BeneficioIfood, type Pedido } from '../../types';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Os dados do pedido do iFood que a homologação exige na comanda.
 *
 * Não é enfeite: cada linha aqui é um critério funcional avaliado por eles —
 * bandeira do cartão, troco, cupom com o patrocinador, CPF para a nota,
 * observação de entrega e código de coleta. Todos existiam no payload e eram
 * descartados na hora de gravar o pedido; ver a migração ifood_comanda_completa.
 *
 * A ordem segue quem olha: primeiro o que muda a AÇÃO de quem está no balcão
 * (aviso, endereço, telefone), depois o que muda o DINHEIRO (pagamento, cupom),
 * e por último o que só é consultado quando pedem (documento).
 */
export function ComandaIfood({ pedido: p }: { pedido: Pedido }) {
  const { tDynamic } = useI18n();

  const beneficios = (p.ifood_beneficios ?? []) as BeneficioIfood[];
  const enderecoExtra = [p.complemento, p.ponto_referencia].filter(Boolean).join(' · ');
  const troco = Number(p.troco_para ?? 0);

  const temAlgo =
    p.ifood_info_extra ||
    enderecoExtra ||
    p.observacao_entrega ||
    p.telefone_contato ||
    p.ifood_cartao_bandeira ||
    troco > 0 ||
    beneficios.length > 0 ||
    p.documento_cliente ||
    p.ifood_codigo_coleta;

  if (!temAlgo) return null;

  return (
    <div className="mx-4 space-y-2 border-t border-gray-100 py-2.5 text-xs dark:border-white/5">
      {/* extraInfo costuma trazer instrução operacional do tipo
          "Pago Online. NÃO LEVAR MÁQUINA" — é a primeira coisa a ler. */}
      {p.ifood_info_extra && (
        <Linha icone={<AlertTriangle size={13} className="text-amber-500" />} destaque>
          {p.ifood_info_extra}
        </Linha>
      )}

      {enderecoExtra && (
        <Linha icone={<MapPin size={13} className="text-blue-500" />}>{enderecoExtra}</Linha>
      )}

      {p.observacao_entrega && (
        <Linha icone={<AlertTriangle size={13} className="text-amber-500" />} destaque>
          {p.observacao_entrega}
        </Linha>
      )}

      {p.telefone_contato && (
        <Linha icone={<Phone size={13} className="text-gray-400" />}>
          {p.telefone_contato}
          {/* O número do iFood é um 0800; o localizador é o ramal do cliente.
              Sem ele, ligar para o 0800 não chega em ninguém. */}
          {p.ifood_localizador && (
            <span className="text-[var(--cor-texto-fraco)]">
              {' · '}
              {tDynamic('localizador')} {p.ifood_localizador}
            </span>
          )}
          {/* O numero que o cliente ve no app. Ele liga dizendo "meu pedido e
              o 9279" — sem isto na tela, ninguem acha o pedido, porque o
              numero do MiseOn e outro. */}
          {p.ifood_display_id && (
            <span className="text-[var(--cor-texto-fraco)]">
              {' · '}
              {tDynamic('nº no iFood')} {p.ifood_display_id}
            </span>
          )}
        </Linha>
      )}

      {p.ifood_cartao_bandeira && (
        <Linha icone={<CreditCard size={13} className="text-gray-400" />}>
          {tDynamic('Cartão')}: <strong className="font-semibold">{p.ifood_cartao_bandeira}</strong>
        </Linha>
      )}

      {troco > 0 && (
        <Linha icone={<Banknote size={13} className="text-emerald-500" />} destaque>
          {tDynamic('Levar troco para')} {fmt(troco)}
          <span className="text-[var(--cor-texto-fraco)]">
            {' · '}
            {tDynamic('troco de')} {fmt(Math.max(troco - Number(p.valor_total ?? 0), 0))}
          </span>
        </Linha>
      )}

      {beneficios.map((b, i) => (
        <Linha key={i} icone={<Ticket size={13} className="text-violet-500" />}>
          {tDynamic('Cupom')} {fmt(Number(b.value ?? 0))}
          {b.campaign?.name ? ` · ${b.campaign.name}` : ''}
          <span className="block text-[11px] text-[var(--cor-texto-fraco)]">{quemBanca(b)}</span>
        </Linha>
      ))}

      {p.ifood_codigo_coleta && (
        <Linha icone={<KeyRound size={13} className="text-blue-500" />}>
          {tDynamic('Código de coleta')}:{' '}
          <strong className="font-['JetBrains_Mono'] font-bold tracking-widest">{p.ifood_codigo_coleta}</strong>
        </Linha>
      )}

      {p.documento_cliente && (
        <Linha icone={<BadgeCheck size={13} className="text-gray-400" />}>
          {tDynamic('CPF/CNPJ na nota')}: {p.documento_cliente}
        </Linha>
      )}
    </div>
  );
}

function Linha({
  icone,
  destaque,
  children,
}: {
  icone: React.ReactNode;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-2 leading-snug ${
        destaque ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-[#AEB9CE]'
      }`}
    >
      <span className="mt-0.5 shrink-0">{icone}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/**
 * Quem paga o cupom decide se ele é receita ou prejuízo.
 *
 * Pela documentação do iFood: IFOOD, EXTERNAL e CHAIN são repasse — o valor
 * volta para a loja. MERCHANT é subsídio da própria loja, ou seja, desconto de
 * verdade no bolso do lojista. Mostrar só "cupom R$ 10" esconde essa diferença.
 */
function quemBanca(b: BeneficioIfood): string {
  const partes = (b.sponsorshipValues ?? []).filter((s) => Number(s.value ?? 0) > 0);
  if (partes.length === 0) return 'Patrocínio não informado pelo iFood';

  return partes
    .map((s) => {
      const nome = (s.name ?? '').toUpperCase();
      const rotulo =
        nome === 'MERCHANT'
          ? 'a loja banca'
          : nome === 'IFOOD'
            ? 'o iFood banca (vira repasse)'
            : nome === 'CHAIN'
              ? 'a rede banca (vira repasse)'
              : nome === 'EXTERNAL'
                ? 'parceiro externo banca (vira repasse)'
                : s.description || nome || 'patrocinador';
      return `${fmt(Number(s.value ?? 0))} — ${rotulo}`;
    })
    .join(' · ');
}
