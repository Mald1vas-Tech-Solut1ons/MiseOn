/**
 * Tradutor de erros técnicos → linguagem de gente.
 *
 * O usuário do MiseOn é leigo: mensagens como "Transição de status inválida"
 * ou "tuple to be updated was already modified" não dizem nada para ele.
 * Este módulo mapeia os erros conhecidos (principalmente os RAISE EXCEPTION
 * das triggers do banco) para um trio Título / Explicação / O que fazer,
 * sempre com uma ação concreta. Erros desconhecidos caem no fallback, que
 * orienta acionar o suporte sem pânico.
 */

export interface ErroTraduzido {
  titulo: string;
  explicacao: string;
  acao: string;
  /** Rota interna sugerida para resolver (ex.: '/admin/estoque') */
  link?: { para: string; rotulo: string };
  /** Mensagem técnica original (exibida recolhida, útil para suporte) */
  tecnico: string;
}

interface Regra {
  match: RegExp;
  titulo: string;
  explicacao: string;
  acao: string;
  link?: { para: string; rotulo: string };
}

const REGRAS: Regra[] = [
  {
    match: /tentativa já registrada/i,
    titulo: 'Esta tentativa já foi registrada',
    explicacao: 'A venda pode ter sido concluída antes de a conexão cair.',
    acao: 'Confira o Painel de Pedidos antes de limpar o carrinho e iniciar outra venda.',
    link: { para: '/admin/pedidos', rotulo: 'Conferir pedidos' },
  },
  {
    match: /preço do catálogo mudou/i,
    titulo: 'O preço mudou',
    explicacao: 'O total do carrinho ficou diferente do catálogo atual.',
    acao: 'Recarregue o PDV e confira o total com o cliente antes de receber.',
  },
  {
    match: /opções obrigatórias|limites de escolha|opção repetida/i,
    titulo: 'Confira as opções do produto',
    explicacao: 'O pedido não foi registrado porque as escolhas precisam ser ajustadas.',
    acao: 'Volte ao carrinho e escolha as opções obrigatórias de cada produto.',
  },
  {
    match: /estoque insuficiente/i,
    titulo: 'Estoque insuficiente',
    explicacao:
      'Este pedido consome ingredientes que estão zerados (ou negativos) no seu estoque. Por segurança, o sistema não confirma a venda para não gerar custo errado no seu financeiro.',
    acao:
      'Abra a tela de Estoque, corrija a quantidade do insumo indicado abaixo e depois confirme o pedido novamente.',
    link: { para: '/admin/estoque', rotulo: 'Abrir Estoque' },
  },
  {
    match: /ainda não foi enviado para a cozinha/i,
    titulo: 'O pedido ainda não está na cozinha',
    explicacao:
      'Só a cozinha pode iniciar o preparo. Antes disso, o balcão precisa enviar o pedido para lá — é assim que o sistema sabe de quem é a vez.',
    acao:
      'No cartão do pedido, toque em "Enviar p/ cozinha". Depois disso a cozinha consegue iniciar o preparo pela tela Cozinha (KDS).',
  },
  {
    match: /tem item de preparo/i,
    titulo: 'Este pedido tem itens que precisam de preparo',
    explicacao:
      'Um ou mais itens deste pedido são feitos na cozinha (não são revenda direta). O sistema bloqueia o atalho "pronto" para a comida não sair sem passar pelo preparo.',
    acao: 'Toque em "Enviar p/ cozinha" no cartão do pedido e aguarde a cozinha marcar como pronto.',
  },
  {
    match: /não está com a cozinha no momento/i,
    titulo: 'Este pedido não está com a cozinha',
    explicacao:
      'A cozinha só consegue mexer em pedidos que foram enviados para ela. Este pedido está com o balcão.',
    acao: 'Se o preparo é necessário, envie o pedido para a cozinha pelo Painel de Pedidos.',
  },
  {
    match: /ainda está com a cozinha/i,
    titulo: 'A cozinha ainda não devolveu este pedido',
    explicacao:
      'O pedido está em preparo. O balcão só consegue entregar depois que a cozinha marcar como pronto — assim nada sai pela metade.',
    acao: 'Aguarde a cozinha marcar "Pronto" na tela Cozinha (KDS). O pedido volta para você automaticamente.',
  },
  {
    match: /só pedidos de entrega saem para rota/i,
    titulo: 'Este pedido não é de entrega',
    explicacao: 'Pedidos de retirada ou mesa não saem para rota de entrega — eles são finalizados direto no balcão.',
    acao: 'Use a opção "Entregar ao cliente" em vez de "Sair p/ entrega".',
  },
  {
    match: /precisa sair para rota antes de finalizar/i,
    titulo: 'Pedido de entrega precisa ir para a rota primeiro',
    explicacao:
      'Este pedido é de entrega: ele precisa ser despachado com um entregador antes de ser finalizado. Isso garante o rastreio da entrega.',
    acao: 'Use "Saiu p/ entrega" no Painel de Pedidos ou organize a rota na tela Entregas.',
    link: { para: '/admin/entregas', rotulo: 'Abrir Entregas' },
  },
  {
    match: /já foi encerrado/i,
    titulo: 'Este pedido já foi encerrado',
    explicacao: 'O pedido já está finalizado ou cancelado — não é possível alterá-lo de novo.',
    acao: 'Atualize a tela. Se o pedido foi encerrado por engano, fale com o suporte.',
  },
  {
    match: /só um admin pode cancelar/i,
    titulo: 'Cancelamento bloqueado para o seu perfil',
    explicacao:
      'A cozinha já começou este pedido (ingredientes comprometidos). Por isso, só um administrador da loja pode cancelar agora.',
    acao: 'Chame um administrador para confirmar o cancelamento na conta dele.',
  },
  {
    match: /transição de status inválida/i,
    titulo: 'Esta etapa do pedido não pode ser pulada',
    explicacao:
      'O pedido segue uma fila: Novo → Aceito → Cozinha → Pronto → Entrega/Finalizado. O sistema bloqueia pulos para nenhuma etapa ser esquecida.',
    acao: 'Atualize a tela e avance o pedido uma etapa por vez. Se o pedido parecer "travado", fale com o suporte.',
  },
  {
    match: /transição de bastão inválida/i,
    titulo: 'O pedido não pode ir para a cozinha agora',
    explicacao: 'Só pedidos já aceitos entram na fila da cozinha, e apenas uma vez.',
    acao: 'Confirme o pedido primeiro ("Aceitar"). Se ele já está na cozinha, é só aguardar o preparo.',
  },
  {
    match: /acesso negado|permission denied|JWT|not authorized/i,
    titulo: 'Sem permissão para esta ação',
    explicacao: 'Sua sessão pode ter expirado ou seu usuário não tem acesso a esta loja.',
    acao: 'Saia da conta e entre novamente. Se continuar, peça ao administrador para conferir seu acesso na tela Equipe.',
  },
  {
    match: /failed to fetch|network|timeout|sem conexão/i,
    titulo: 'Falha de comunicação com o servidor',
    explicacao: 'Sua internet oscilou ou o servidor não respondeu a tempo. Nenhuma informação foi perdida.',
    acao: 'Verifique sua conexão e tente novamente em alguns segundos.',
  },
  {
    match: /duplicate key|já existe|unique/i,
    titulo: 'Registro duplicado',
    explicacao: 'Já existe um registro igual a este cadastrado no sistema.',
    acao: 'Verifique se o item já não estava cadastrado antes de tentar de novo.',
  },
];

export function traduzirErro(err: unknown): ErroTraduzido {
  // supabase-js devolve o texto do RAISE EXCEPTION direto em error.message —
  // não há prefixo técnico para remover. As regras casam em qualquer posição.
  const tecnico = String((err as any)?.message ?? err ?? 'Erro desconhecido');

  const regra = REGRAS.find((r) => r.match.test(tecnico));
  if (regra) {
    return { titulo: regra.titulo, explicacao: regra.explicacao, acao: regra.acao, link: regra.link, tecnico };
  }
  return {
    titulo: 'Algo não saiu como esperado',
    explicacao: 'A operação não foi concluída, mas nada foi salvo pela metade — seus dados estão seguros.',
    acao: 'Tente novamente. Se o erro repetir, anote a mensagem técnica abaixo e fale com o suporte MiseOn.',
    tecnico,
  };
}
