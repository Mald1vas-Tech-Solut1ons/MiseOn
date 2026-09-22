// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TornarSeLojista from './TornarSeLojista';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), consumidos: [] as string[] }));
vi.mock('../../contexts/I18nContext', () => ({ useI18n: () => ({ tDynamic: (s: string) => s }) }));
vi.mock('../MiseOnLogo', () => ({ default: () => null }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.consumidos = [];
  // Igual ao supabase-js: a consulta só sai quando alguém consome (.then).
  mocks.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => ({
    then: (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => {
      mocks.consumidos.push(nome === 'fn_onboarding_registrar' ? `${args.p_evento}:${args.p_etapa ?? ''}` : nome);
      const valor = nome === 'fn_onboarding_meu_rascunho'
        ? { data: { nomeLoja: 'Lanche da Vila', segmento: 'pizzaria' }, error: null }
        : { data: null, error: null };
      return Promise.resolve(valor).then(ok, falha);
    },
  }));
  mocks.invoke.mockResolvedValue({ data: { ok: true, loja_id: 'l-1', slug: 'x' }, error: null });
});
afterEach(cleanup);

describe('cadastro de loja em uma tela', () => {
  it('não pede dado fiscal e manda só o essencial', async () => {
    const criada = vi.fn();
    render(<TornarSeLojista emailUsuario="dono@exemplo.com" onCriada={criada} />);
    expect(screen.queryByPlaceholderText(/CNPJ|CPF/)).toBeNull();
    expect(screen.queryByPlaceholderText(/Razão social/)).toBeNull();

    fireEvent.change(screen.getByLabelText('Nome da sua loja'), { target: { value: 'Pastel do Zé' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lanchonete' }));
    fireEvent.click(screen.getByRole('button', { name: /Criar minha loja grátis/ }));

    await waitFor(() => expect(criada).toHaveBeenCalled());
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body).toMatchObject({ nome_loja: 'Pastel do Zé', segmento_negocio: 'lanchonete', email_cobranca: 'dono@exemplo.com' });
    expect(body.cpf_cnpj).toBeUndefined();
    expect(mocks.consumidos).toContain('abriu:loja');
    expect(mocks.consumidos).toContain('loja_criada:concluido');
  });

  it('quem volta encontra o que já tinha digitado', async () => {
    render(<TornarSeLojista emailUsuario="dono@exemplo.com" onCriada={vi.fn()} />);
    await waitFor(() => expect((screen.getByLabelText('Nome da sua loja') as HTMLInputElement).value).toBe('Lanche da Vila'));
    expect(screen.getByRole('button', { name: 'Pizzaria' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('campo faltando e falha do servidor viram evento com o motivo', async () => {
    mocks.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => ({
      then: (ok: (v: unknown) => unknown) => {
        mocks.consumidos.push(nome === 'fn_onboarding_registrar' ? `${args.p_evento}:${args.p_detalhe ?? ''}` : nome);
        return Promise.resolve({ data: {}, error: null }).then(ok);
      },
    }));
    mocks.invoke.mockResolvedValueOnce({ data: { error: 'Esta conta já está vinculada a uma loja.' }, error: null });
    render(<TornarSeLojista emailUsuario="dono@exemplo.com" onCriada={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Criar minha loja grátis/ }));
    expect(screen.getByRole('alert').textContent).toContain('Informe o nome da sua loja.');
    expect(mocks.consumidos).toContain('erro_validacao:Informe o nome da sua loja.');

    fireEvent.change(screen.getByLabelText('Nome da sua loja'), { target: { value: 'Pastel do Zé' } });
    fireEvent.click(screen.getByRole('button', { name: 'Outro' }));
    fireEvent.click(screen.getByRole('button', { name: /Criar minha loja grátis/ }));
    await waitFor(() => expect(mocks.consumidos).toContain('erro_criar:Esta conta já está vinculada a uma loja.'));
  });
});
