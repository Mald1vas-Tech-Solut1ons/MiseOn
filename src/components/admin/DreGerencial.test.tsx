// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DreGerencial from './DreGerencial';

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ tDynamic: (texto: string) => texto }),
}));

describe('DRE demonstrativa', () => {
  it('não apresenta o cenário fixo como resultado real da loja', () => {
    render(<DreGerencial />);

    expect(screen.getByRole('alert').textContent).toContain('Dados demonstrativos');
    expect(screen.queryByText(/tempo real/i)).toBeNull();
    expect(screen.queryByText(/Lucro Líquido/i)).toBeNull();
    expect(screen.queryByText(/EBITDA/i)).toBeNull();
    expect(screen.getAllByText(/Resultado operacional demonstrativo/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /formação do resultado operacional/i })).toBeTruthy();
  });
});
