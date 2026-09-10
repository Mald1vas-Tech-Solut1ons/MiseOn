/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EnderecoMixin, { type EnderecoFormData } from './EnderecoMixin';

const enderecoSalvo: EnderecoFormData = {
  cep: '07070-000',
  logradouro: 'Rua do Cliente',
  numero: '265',
  complemento: 'Apto 12',
  bairro: 'Vila Rosália',
  cidade: 'Guarulhos',
  uf: 'SP',
  ponto_referencia: 'Perto da praça',
  sem_numero: false,
};

describe('EnderecoMixin', () => {
  it('hidrata o formulário quando o endereço salvo chega depois da montagem', async () => {
    const onMudanca = vi.fn();
    const view = render(<EnderecoMixin onMudanca={onMudanca} />);

    expect((screen.getByPlaceholderText('Endereço (Rua/Avenida)') as HTMLInputElement).value).toBe('');

    view.rerender(<EnderecoMixin valorInicial={enderecoSalvo} onMudanca={onMudanca} />);

    await waitFor(() => {
      expect((screen.getByPlaceholderText('CEP (Somente números)') as HTMLInputElement).value).toBe('07070-000');
      expect((screen.getByPlaceholderText('Endereço (Rua/Avenida)') as HTMLInputElement).value).toBe('Rua do Cliente');
      expect((screen.getByPlaceholderText('Número') as HTMLInputElement).value).toBe('265');
      expect((screen.getByPlaceholderText('Complemento (Apto, Bloco...)') as HTMLInputElement).value).toBe('Apto 12');
      expect((screen.getByPlaceholderText('Ponto de Referência') as HTMLInputElement).value).toBe('Perto da praça');
    });
  });
});
