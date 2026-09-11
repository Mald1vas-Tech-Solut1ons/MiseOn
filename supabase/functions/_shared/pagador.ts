/**
 * Quem é o pagador, para a Efí.
 *
 * Existe porque um campo errado aqui não devolve um erro claro — devolve
 * `4600222 "Recebedor e cliente não podem ser a mesma pessoa"`, que não diz
 * por qual campo, e o checkout inteiro para.
 *
 * Medido em 11/09/2026 disparando cobranças de R$ 7,00 direto na API da Efí
 * com cartão sintético (mesma conta, mesmo CPF, sem split, um campo por vez):
 *
 *   telefone do titular da conta + e-mail neutro -> 4600222
 *   e-mail por pedido + telefone neutro          -> 200, vai ao emissor
 *   os dois como a função mandava                -> 4600222
 *
 * Ou seja: a Efí casa pagador e recebedor PELO TELEFONE, não só pelo CPF. E o
 * `telefone_contato` do pedido é o contato de ENTREGA — num pedido lançado
 * pela própria equipe da loja, é o telefone do dono, que é quem recebe.
 */

/**
 * Número de preenchimento, usado só quando quem compra é da equipe da loja.
 *
 * Nesse caso não existe telefone de pagador para mandar: o do pedido pertence
 * ao recebedor, e a Efí exige o campo (omitir devolve "A propriedade
 * [phone_number] é obrigatória" — medido em 10/09/2026). Cliente de verdade
 * nunca cai aqui: ele manda o telefone dele, que é o que o antifraude quer.
 */
export const TELEFONE_DE_PREENCHIMENTO = '11999999999';

export type OrigemDoTelefone =
  | 'checkout'
  | 'contato-do-pedido'
  | 'neutro-equipe-da-loja'
  | 'neutro-igual-ao-titular'
  | 'neutro-sem-contato';

export function telefoneDoPagador(entrada: {
  /** Telefone digitado no checkout, quando houver. */
  doCheckout?: string | null;
  /** `pedidos.telefone_contato` — contato de entrega. */
  doPedido?: string | null;
  /** O comprador tem vínculo com a loja (dono, gerente, operador)? */
  compradorEhDaLoja: boolean;
  /**
   * `configuracoes_fiscais_plataforma.efi_titular_telefone` — o telefone
   * cadastrado na conta Efí que cobra.
   *
   * Sem esta comparação a proteção era parcial: ela dependia de o comprador
   * estar logado como equipe da loja. O dono comprando com a conta pessoal de
   * cliente dele mesmo — que é como ele testa — continuava mandando o próprio
   * telefone e tomando 4600222. O vínculo com a loja é um palpite sobre quem
   * é a pessoa; isto aqui é a comparação direta que a Efí faz.
   */
  telefoneDoTitularDaConta?: string | null;
}): { numero: string; origem: OrigemDoTelefone } {
  const soDigitos = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '');

  const doTitular = soDigitos(entrada.telefoneDoTitularDaConta);
  const ehDoTitular = (n: string) => !!doTitular && n === doTitular;

  const checkout = soDigitos(entrada.doCheckout);
  if (checkout) {
    return ehDoTitular(checkout)
      ? { numero: TELEFONE_DE_PREENCHIMENTO, origem: 'neutro-igual-ao-titular' }
      : { numero: checkout, origem: 'checkout' };
  }

  if (entrada.compradorEhDaLoja) {
    return { numero: TELEFONE_DE_PREENCHIMENTO, origem: 'neutro-equipe-da-loja' };
  }

  const pedido = soDigitos(entrada.doPedido);
  if (pedido) {
    return ehDoTitular(pedido)
      ? { numero: TELEFONE_DE_PREENCHIMENTO, origem: 'neutro-igual-ao-titular' }
      : { numero: pedido, origem: 'contato-do-pedido' };
  }

  return { numero: TELEFONE_DE_PREENCHIMENTO, origem: 'neutro-sem-contato' };
}
