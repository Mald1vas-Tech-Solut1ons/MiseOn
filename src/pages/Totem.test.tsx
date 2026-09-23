// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Totem from './Totem';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), invoke: vi.fn(), imprimir: vi.fn(),
  grupos: [] as unknown[],
  /** Catálogo extra por teste (categorias e produtos além do lanche). */
  extra: { cats: [] as unknown[], prods: [] as unknown[] },
}));
vi.mock('../contexts/I18nContext', () => ({ useI18n: () => ({ tDynamic: (s: string) => s }) }));
vi.mock('../lib/cdn', () => ({ getOptimizedImageUrl: (s: string) => s }));
vi.mock('../lib/print', () => ({ imprimir: mocks.imprimir }));
vi.mock('../lib/supabase', () => ({ supabase: {
  rpc: mocks.rpc,
  functions: { invoke: mocks.invoke },
  from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: { id: 'loja-1', nome: 'Loja de teste' } }),
      order: async () => ({ data: table === 'categorias'
        ? [{ id: 'cat-1', nome: 'Lanches' }, ...mocks.extra.cats]
        : [{ id: 'p-1', nome: 'Lanche de teste', preco: 20, categoria_id: 'cat-1', grupos_opcoes: mocks.grupos }, ...mocks.extra.prods] }),
    };
    return query;
  },
} }));

const pedido = { pedido_id: 'pedido-1', numero: 42, senha: 7, valor_total: 24, identificado: true, cashback_pct: 5 };
const cobranca = { data: { qr_imagem: 'data:image/png;base64,dGVzdGU=', copia_e_cola: 'pix-teste' }, error: null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.grupos = [];
  mocks.extra = { cats: [], prods: [] };
  // Sensível ao NOME, não à ordem. O totem também chama fn_nutricao_* ao abrir
  // o cardápio; um mock por ordem fazia essas chamadas consumirem o valor
  // preparado para a criação do pedido, e o teste passava a depender de qual
  // rotina disparasse primeiro.
  mocks.rpc.mockImplementation((nome: string) =>
    Promise.resolve(String(nome).startsWith('fn_nutricao')
      ? { data: [], error: null }
      : { data: pedido, error: null }));
  mocks.invoke.mockResolvedValue(cobranca);
  mocks.imprimir.mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function abrirProduto() {
  render(<MemoryRouter initialEntries={['/totem/demo?k=token-teste']}>
    <Routes><Route path="/totem/:slug" element={<Totem />} /></Routes>
  </MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /Começar pedido/ }));
  fireEvent.click(screen.getByRole('button', { name: /Lanche de teste/ }));
}

async function irAoPagamento() {
  await abrirProduto();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
  fireEvent.click(screen.getByRole('button', { name: /Ver pedido/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
}

describe('fechamento do totem sem cobrança real', () => {
  it.each(['erro da função', 'resposta sem QR', 'rejeição de rede'])('%s mantém pedido pendente, sem sucesso, e retenta o mesmo pedido', async (caso) => {
    if (caso === 'rejeição de rede') mocks.invoke.mockRejectedValueOnce(new Error('offline'));
    else mocks.invoke.mockResolvedValueOnce(caso === 'erro da função'
      ? { data: null, error: { message: 'Falhou' } }
      : { data: {}, error: null });
    await irAoPagamento();
    fireEvent.click(screen.getByRole('button', { name: 'Pagar com Pix' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Não foi possível gerar o Pix');
    expect(screen.getByText(/Pedido #42/).textContent).toContain('Pagamento pendente');
    expect(screen.queryByText('Pedido enviado!')).toBeNull();
    expect(screen.queryByText(/Você acumulou/)).toBeNull();
    expect(screen.queryByText(/sendo impresso/)).toBeNull();
    expect(mocks.imprimir).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Voltar' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar gerar Pix novamente' }));
    expect(await screen.findByAltText('QR Code do Pix')).toBeTruthy();
    expect(mocks.rpc.mock.calls.filter(([name]) => name === 'fn_totem_criar_pedido')).toHaveLength(1);
    expect(mocks.invoke.mock.calls.map(([, args]) => args.body.pedido_id)).toEqual(['pedido-1', 'pedido-1']);
  });

  it('bloqueia toques repetidos até a criação do pedido e da cobrança terminarem', async () => {
    const criar = deferred<{ data: typeof pedido; error: null }>();
    const cobrar = deferred<typeof cobranca>();
    mocks.rpc.mockImplementation((nome: string) =>
      nome === 'fn_totem_criar_pedido' ? criar.promise : Promise.resolve({ data: [], error: null }));
    mocks.invoke.mockReturnValueOnce(cobrar.promise);
    await irAoPagamento();
    const pagar = screen.getByRole('button', { name: 'Pagar com Pix' });
    act(() => {
      pagar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      pagar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.rpc.mock.calls.filter(([nome]) => nome === 'fn_totem_criar_pedido')).toHaveLength(1);
    expect((screen.getByRole('button', { name: /Preparando pagamento/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Recomeçar' }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => { criar.resolve({ data: pedido, error: null }); });
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Preparando pagamento/ }));
    expect(mocks.rpc.mock.calls.filter(([nome]) => nome === 'fn_totem_criar_pedido')).toHaveLength(1);
    expect((screen.getByRole('button', { name: /Preparando pagamento/ }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { cobrar.resolve(cobranca); });
    expect(await screen.findByAltText('QR Code do Pix')).toBeTruthy();
  });

  it('recomeçar após falha do Pix cancela o pedido conhecido e limpa a sessão', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: { message: 'indisponível' } });
    await irAoPagamento();
    fireEvent.click(screen.getByRole('button', { name: 'Pagar com Pix' }));
    await screen.findByRole('alert');
    // Igual ao supabase-js: a consulta só sai do aparelho quando é consumida.
    // Com um mock ansioso, um `void supabase.rpc(...)` passava aqui e nunca
    // cancelava nada em produção.
    const executou = vi.fn();
    mocks.rpc.mockImplementation((nome: string) => nome === 'fn_totem_cancelar_pedido'
      ? { then: (ok: (v: unknown) => unknown) => { executou(); return Promise.resolve(ok({ data: { cancelado: true }, error: null })); } }
      : Promise.resolve({ data: [], error: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar' }));
    expect(mocks.rpc).toHaveBeenCalledWith('fn_totem_cancelar_pedido', { p_token: 'token-teste', p_pedido_id: 'pedido-1' });
    expect(executou).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Começar pedido/ })).toBeTruthy();
    expect(screen.queryByText(/Pedido #42/)).toBeNull();
  });

  it('somente pagamento confirmado mostra conclusão; falha da impressora não a derruba e a sessão expira com opção de prolongar', async () => {
    await irAoPagamento();
    vi.useFakeTimers();
    mocks.imprimir.mockImplementation(() => { throw new Error('sem impressora'); });
    mocks.invoke.mockResolvedValueOnce(cobranca).mockResolvedValue({ data: { pago: true }, error: null });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pagar com Pix' })); });
    expect(screen.queryByText('Pedido enviado!')).toBeNull();
    expect(mocks.imprimir).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByText('Pedido enviado!')).toBeTruthy();
    expect(mocks.imprimir).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Guarde sua senha. Se precisar do comprovante, peça ajuda no balcão.')).toBeTruthy();
    expect(screen.queryByText(/sendo impresso/)).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(19000); });
    fireEvent.click(screen.getByRole('button', { name: 'Precisa de mais tempo? Toque aqui.' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(19000); });
    expect(screen.getByText('Pedido enviado!')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByRole('button', { name: /Começar pedido/ })).toBeTruthy();
    expect(mocks.rpc.mock.calls.some(([name]) => name === 'fn_totem_cancelar_pedido')).toBe(false);
    expect(mocks.imprimir).toHaveBeenCalledTimes(1);
  });

  it('só conclui grupo obrigatório após atingir mínimo maior que um', async () => {
    mocks.grupos = [{ id: 'g-1', nome: 'Acompanhamentos', min_escolhas: 2, max_escolhas: 3, opcoes: [
      { id: 'o-1', nome: 'Arroz', preco_adicional: 0, disponivel: true },
      { id: 'o-2', nome: 'Feijão', preco_adicional: 0, disponivel: true },
      { id: 'o-3', nome: 'Salada', preco_adicional: 0, disponivel: true },
    ] }];
    await abrirProduto();
    expect(screen.getByText('Faltam escolhas: 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Arroz' }));
    expect(screen.getByText('Faltam escolhas: 1')).toBeTruthy();
    expect(screen.queryByText('Pronto')).toBeNull();
    expect((screen.getByRole('button', { name: 'Escolha Acompanhamentos' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Feijão' }));
    expect(screen.getByText('Pronto')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Adicionar' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Arroz' }));
    expect(screen.getByText('Faltam escolhas: 1')).toBeTruthy();
  });
});

describe('resgate de cashback', () => {
  /** Mock por NOME: a consulta de saldo é mais uma chamada no meio do fluxo. */
  function comSaldo(consulta: { saldo: number; resgate: number; expira_em?: string | null }) {
    mocks.rpc.mockImplementation((nome: string) => Promise.resolve(
      String(nome).startsWith('fn_nutricao') ? { data: [], error: null }
        : nome === 'fn_totem_saldo_cashback' ? { data: consulta, error: null }
          : { data: pedido, error: null }));
  }

  async function identificar() {
    await abrirProduto();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    fireEvent.click(screen.getByRole('button', { name: /Ver pedido/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    for (const d of '11987654321') fireEvent.click(screen.getByRole('button', { name: d }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  }

  const payloadDoPedido = () => mocks.rpc.mock.calls.find(([n]) => n === 'fn_totem_criar_pedido')?.[1].p_payload;

  it('com saldo, oferece o valor do servidor e manda só a intenção', async () => {
    comSaldo({ saldo: 12, resgate: 6, expira_em: '2026-10-07T12:00:00Z' });
    await identificar();
    expect(await screen.findByText('Seu saldo de cashback')).toBeTruthy();
    expect(mocks.rpc).toHaveBeenCalledWith('fn_totem_saldo_cashback', expect.objectContaining({
      p_token: 'token-teste', p_telefone: '11987654321',
      p_itens: [{ produto_id: 'p-1', quantidade: 1, opcoes: [] }],
    }));
    fireEvent.click(screen.getByRole('button', { name: /^Usar/ }));

    // Prévia: 20 do lanche menos os 6 que o servidor calculou.
    expect(screen.getByText(/14,00/)).toBeTruthy();
    expect(screen.getByText(/Cashback usado/)).toBeTruthy();

    mocks.rpc.mockImplementation((nome: string) => Promise.resolve(nome === 'fn_totem_criar_pedido'
      ? { data: { ...pedido, valor_total: 14, cashback_usado: 6, cashback_validade_dias: 15 }, error: null }
      : { data: [], error: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Pagar com Pix' }));
    await screen.findByAltText('QR Code do Pix');
    const payload = payloadDoPedido();
    expect(payload.usar_cashback).toBe(true);
    expect(payload.telefone).toBe('11987654321');
    // Nenhum valor de desconto sai do aparelho.
    expect(JSON.stringify(payload)).not.toMatch(/cashback_usado|desconto|valor/);
  });

  it('guardar para depois cria o pedido sem resgate', async () => {
    comSaldo({ saldo: 12, resgate: 6 });
    await identificar();
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar para depois' }));
    expect(screen.queryByText(/Cashback usado/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pagar com Pix' }));
    await screen.findByAltText('QR Code do Pix');
    expect(payloadDoPedido().usar_cashback).toBeUndefined();
  });

  it('sem saldo resgatável, pula a tela de resgate inteira', async () => {
    comSaldo({ saldo: 3, resgate: 0 });
    await identificar();
    expect(await screen.findByRole('button', { name: 'Pagar com Pix' })).toBeTruthy();
    expect(screen.queryByText('Seu saldo de cashback')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pagar com Pix' }));
    await screen.findByAltText('QR Code do Pix');
    expect(payloadDoPedido().usar_cashback).toBeUndefined();
  });

  it('consulta que falha não trava a fila', async () => {
    mocks.rpc.mockImplementation((nome: string) => nome === 'fn_totem_saldo_cashback'
      ? Promise.reject(new Error('offline'))
      : Promise.resolve(String(nome).startsWith('fn_nutricao') ? { data: [], error: null } : { data: pedido, error: null }));
    await identificar();
    expect(await screen.findByRole('button', { name: 'Pagar com Pix' })).toBeTruthy();
  });
});

describe('oferta do fim do pedido: uma tela, uma pergunta', () => {
  const BEBIDAS = { id: 'cat-beb', nome: 'Bebidas' };
  const DOCES = { id: 'cat-doce', nome: 'Sobremesas' };
  const REFRI = { id: 'p-refri', nome: 'Refri lata', preco: 6, categoria_id: 'cat-beb', grupos_opcoes: [] };
  const PUDIM = { id: 'p-pudim', nome: 'Pudim', preco: 9, categoria_id: 'cat-doce', grupos_opcoes: [] };

  async function comCarrinho(...nomes: string[]) {
    render(<MemoryRouter initialEntries={['/totem/demo?k=token-teste']}>
      <Routes><Route path="/totem/:slug" element={<Totem />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Começar pedido/ }));
    const aba: Record<string, string> = { 'Refri lata': 'Bebidas', Pudim: 'Sobremesas', 'Lanche de teste': 'Lanches' };
    for (const nome of nomes) {
      // Como o cliente faz: troca para a aba da categoria antes de tocar no item.
      fireEvent.click(screen.getByRole('button', { name: new RegExp('^' + aba[nome], 'i') }));
      fireEvent.click(screen.getByRole('button', { name: new RegExp(nome) }));
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    }
    fireEvent.click(screen.getByRole('button', { name: /Ver pedido/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  }

  it('sem bebida no carrinho, oferece bebida (e não sobremesa)', async () => {
    mocks.extra = { cats: [BEBIDAS, DOCES], prods: [REFRI, PUDIM] };
    await comCarrinho('Lanche de teste');
    expect(screen.getByText('Vai uma bebida?')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Refri lata/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Pudim/ })).toBeNull();
  });

  it('com bebida e sem sobremesa, oferece sobremesa', async () => {
    mocks.extra = { cats: [BEBIDAS, DOCES], prods: [REFRI, PUDIM] };
    await comCarrinho('Lanche de teste', 'Refri lata');
    expect(screen.getByText('Vai uma sobremesa?')).toBeTruthy();
  });

  it('com as duas no carrinho, pula direto para a identificação', async () => {
    mocks.extra = { cats: [BEBIDAS, DOCES], prods: [REFRI, PUDIM] };
    await comCarrinho('Lanche de teste', 'Refri lata', 'Pudim');
    expect(screen.queryByText(/Vai uma/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Pular' })).toBeTruthy();
  });

  it('quem aceita a bebida não recebe uma segunda oferta', async () => {
    mocks.extra = { cats: [BEBIDAS, DOCES], prods: [REFRI, PUDIM] };
    await comCarrinho('Lanche de teste');
    fireEvent.click(screen.getByRole('button', { name: /Refri lata/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    fireEvent.click(screen.getByRole('button', { name: /Ver pedido/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.queryByText('Vai uma sobremesa?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Pular' })).toBeTruthy();
  });

  it('loja sem bebida cadastrada segue oferecendo a sobremesa', async () => {
    mocks.extra = { cats: [DOCES], prods: [PUDIM] };
    await comCarrinho('Lanche de teste');
    expect(screen.getByText('Vai uma sobremesa?')).toBeTruthy();
  });
});
