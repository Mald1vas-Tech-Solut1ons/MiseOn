// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StoreSetupWizard } from './StoreSetupWizard';

const mocks = vi.hoisted(() => ({
  nav: vi.fn(),
  loja: {} as Record<string, unknown>,
  produtos: 1 as number | null,
  horarios: 7 as number | null,
  ifoodSaude: { estado: 'DESCONHECIDO' } as { estado: string } | null,
  whatsappStatus: { status: 'PENDENTE' } as { status: string } | null,
  copiar: vi.fn(),
}));

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ tDynamic: (texto: string) => texto, idioma: 'pt-BR' }),
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mocks.nav,
}));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => ({ select: () => ({ eq: () => {
      if (tabela === 'lojas') return { single: async () => ({ data: mocks.loja }) };
      if (tabela === 'integracao_ifood_saude') return { maybeSingle: async () => ({ data: mocks.ifoodSaude }) };
      return Promise.resolve({ data: null, count: tabela === 'produtos' ? mocks.produtos : mocks.horarios });
    } }) }),
    rpc: async () => ({ data: mocks.whatsappStatus ? [mocks.whatsappStatus] : [] }),
  },
}));

beforeEach(() => {
  localStorage.clear();
  mocks.nav.mockReset();
  mocks.copiar.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copiar } });
  mocks.produtos = 1;
  mocks.horarios = 7;
  mocks.ifoodSaude = { estado: 'DESCONHECIDO' };
  mocks.whatsappStatus = { status: 'PENDENTE' };
  mocks.loja = {
    nome: 'Restaurante de teste', logo_url: '/logo.png', slug: 'restaurante-teste',
    aceita_online: true, efi_payee_code: 'favorecido', efi_titular_documento: 'documento', efi_conta: 'conta',
    ifood_merchant_id: null, whatsapp: null,
  };
});
afterEach(cleanup);

const montar = () => render(<MemoryRouter><StoreSetupWizard lojaId="loja-teste" /></MemoryRouter>);

describe('configuração essencial da loja', () => {
  it('reconhece contagens head:true e conclui sem as integrações opcionais após copiar o link', async () => {
    montar();
    await screen.findByText('4/5 essenciais concluídos');
    expect(screen.queryByText('Configuração essencial concluída!')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Divulgar a loja/ }));
    await screen.findByText('5/5 essenciais concluídos');
    expect(mocks.copiar).toHaveBeenCalledWith(`${window.location.origin}/restaurante-teste`);
    expect(screen.getByText('Configuração essencial concluída!')).toBeTruthy();
    expect(screen.getByText('Conecte sua loja ao iFood')).toBeTruthy();
    expect(screen.getByText('Configure o atendimento automático')).toBeTruthy();
    expect(localStorage.getItem('miseon_link_copiado_confirmado_loja-teste')).toBe('true');
  });

  it('não conclui divulgação com a marca antiga, navegação ou falha ao copiar', async () => {
    localStorage.setItem('miseon_link_copiado_loja-teste', 'true');
    mocks.copiar.mockRejectedValue(new Error('Clipboard não autorizado'));
    montar();
    await screen.findByText('4/5 essenciais concluídos');
    fireEvent.click(screen.getByRole('button', { name: /Identidade da Loja/ }));
    expect(mocks.nav).toHaveBeenCalledWith('/admin/loja');
    expect(localStorage.getItem('miseon_link_copiado_confirmado_loja-teste')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Divulgar a loja/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('4/5 essenciais concluídos')).toBeTruthy();
    expect(localStorage.getItem('miseon_link_copiado_confirmado_loja-teste')).toBeNull();
  });

  it('não conclui produtos e horários quando a contagem está vazia ou indisponível', async () => {
    mocks.produtos = 0;
    mocks.horarios = null;
    montar();
    await screen.findByText('2/5 essenciais concluídos');
    expect(screen.getByText('Cadastre ao menos um item no cardápio')).toBeTruthy();
    expect(screen.getByText('Defina quando a loja abre e fecha')).toBeTruthy();
  });

  it('recusa conta incompleta e bloqueada pelo provedor, como o painel', async () => {
    mocks.loja.cartao_online_bloqueado_em = '2026-09-15T12:00:00Z';
    montar();
    await screen.findByText('3/5 essenciais concluídos');
    expect(screen.getByText('Configure os recebimentos da loja')).toBeTruthy();
  });

  it('sem slug apenas abre as configurações e não declara que divulgou', async () => {
    mocks.loja.slug = '';
    montar();
    await screen.findByText('4/5 essenciais concluídos');
    fireEvent.click(screen.getByRole('button', { name: /Divulgar a loja/ }));
    await waitFor(() => expect(mocks.nav).toHaveBeenCalledWith('/admin/loja'));
    expect(mocks.copiar).not.toHaveBeenCalled();
    expect(localStorage.getItem('miseon_link_copiado_confirmado_loja-teste')).toBeNull();
  });

  it('só conclui integrações opcionais quando a saúde medida está conectada', async () => {
    mocks.loja.ifood_merchant_id = 'merchant-vinculado';
    mocks.ifoodSaude = { estado: 'SEM_PERMISSAO' };
    mocks.whatsappStatus = { status: 'ERRO' };
    montar();
    await screen.findByText('Conecte sua loja ao iFood');
    expect(screen.getByText('Configure o atendimento automático')).toBeTruthy();
    cleanup();

    mocks.ifoodSaude = { estado: 'OK' };
    mocks.whatsappStatus = { status: 'CONECTADO' };
    montar();
    const feitos = await screen.findAllByText('Feito!');
    expect(feitos.length).toBeGreaterThanOrEqual(2);
  });
});
