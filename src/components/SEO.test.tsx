// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SEO from './SEO';

vi.mock('../lib/cookieConsent', () => ({
  temPermissao: () => false,
  EVENT_COOKIE_UPDATED: 'miseon-cookie-updated',
}));

describe('SEO em navegação SPA', () => {
  it('remove o schema da rota anterior quando a página atual não possui schema', () => {
    const { rerender } = render(
      <SEO title="Página A" description="Descrição A" canonicalUrl="https://miseon.app.br/a" schemaJson={{ '@type': 'FAQPage' }} />,
    );
    expect(document.getElementById('seo-json-ld')).toBeTruthy();

    rerender(<SEO title="Página B" description="Descrição B" canonicalUrl="https://miseon.app.br/b" />);
    expect(document.getElementById('seo-json-ld')).toBeNull();
    expect(document.title).toBe('Página B');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://miseon.app.br/b');
  });
});
