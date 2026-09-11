import { describe, it, expect } from 'vitest';
import { telefoneDoPagador, TELEFONE_DE_PREENCHIMENTO } from './pagador';

// O telefone do dono da conta Efí que processa o cartão. Foi ele, indo no
// payload como se fosse o do pagador, que produziu 4600222 em toda tentativa
// dos pedidos #298, #299 e #300 (11/09/2026).
const TELEFONE_DO_DONO = '(11) 91988-9233';

describe('telefone do pagador', () => {
  it('nunca manda o contato do pedido quando quem compra é da equipe da loja', () => {
    const { numero, origem } = telefoneDoPagador({
      doPedido: TELEFONE_DO_DONO,
      compradorEhDaLoja: true,
    });

    // O caso que quebrava: este número é o do titular da conta que recebe.
    expect(numero).not.toBe('11919889233');
    expect(numero).toBe(TELEFONE_DE_PREENCHIMENTO);
    expect(origem).toBe('neutro-equipe-da-loja');
  });

  it('usa o contato do pedido para cliente de verdade — é o dado certo para o antifraude', () => {
    expect(telefoneDoPagador({
      doPedido: '(11) 95236-5338',
      compradorEhDaLoja: false,
    })).toEqual({ numero: '11952365338', origem: 'contato-do-pedido' });
  });

  it('o que o checkout informar vence tudo, inclusive para a equipe da loja', () => {
    expect(telefoneDoPagador({
      doCheckout: '(11) 98888-7777',
      doPedido: TELEFONE_DO_DONO,
      compradorEhDaLoja: true,
    })).toEqual({ numero: '11988887777', origem: 'checkout' });
  });

  it('neutraliza o telefone do titular mesmo quando o comprador NÃO é da equipe', () => {
    // O caso que a primeira versão da correção deixava passar: o dono compra
    // pela conta de cliente dele mesmo, sem vínculo com a loja, e manda o
    // próprio telefone — que é o cadastrado na conta Efí que cobra.
    expect(telefoneDoPagador({
      doPedido: TELEFONE_DO_DONO,
      compradorEhDaLoja: false,
      telefoneDoTitularDaConta: '11919889233',
    })).toEqual({ numero: TELEFONE_DE_PREENCHIMENTO, origem: 'neutro-igual-ao-titular' });
  });

  it('neutraliza também quando o telefone do titular vem digitado no checkout', () => {
    expect(telefoneDoPagador({
      doCheckout: '11919889233',
      compradorEhDaLoja: false,
      telefoneDoTitularDaConta: '(11) 91988-9233',
    }).origem).toBe('neutro-igual-ao-titular');
  });

  it('não mexe no telefone de quem não é o titular', () => {
    expect(telefoneDoPagador({
      doPedido: '(11) 95236-5338',
      compradorEhDaLoja: false,
      telefoneDoTitularDaConta: '11919889233',
    })).toEqual({ numero: '11952365338', origem: 'contato-do-pedido' });
  });

  it('nunca devolve vazio: a Efí recusa a cobrança sem phone_number', () => {
    // Medido em 10/09/2026: omitir o campo devolve
    // "A propriedade [phone_number] é obrigatória".
    for (const caso of [
      { compradorEhDaLoja: false },
      { doPedido: '', doCheckout: '', compradorEhDaLoja: false },
      { doPedido: 'sem número', compradorEhDaLoja: false },
    ]) {
      expect(telefoneDoPagador(caso).numero).toMatch(/^\d{10,11}$/);
    }
  });
});
