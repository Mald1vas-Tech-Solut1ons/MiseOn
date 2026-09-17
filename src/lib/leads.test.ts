import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { linhaLead, normalizarSegmento, whatsappDoLead } from './leads';

describe('leads', () => {
  it('só entrega ao banco segmentos que o CHECK aceita', () => {
    expect(normalizarSegmento('pizzaria')).toBe('pizzaria');
    expect(normalizarSegmento(' Hamburgueria ')).toBe('hamburgueria');
    expect(normalizarSegmento('cafeteria')).toBe('outro');
    expect(normalizarSegmento('food_hall')).toBe('outro');
    expect(normalizarSegmento(null)).toBe('outro');
  });

  it('guarda o segmento recusado na mensagem em vez de perdê-lo', () => {
    const l = linhaLead({ nome: ' Ana ', whatsapp: '11 9999', segmento: 'rede_franquia', mensagem: 'quero totem', origem: 'kiosk' });
    expect(l.nome).toBe('Ana');
    expect(l.segmento).toBe('outro');
    expect(l.mensagem).toBe('[segmento informado: rede_franquia] quero totem');
  });

  it('manda só as colunas que existem em public.leads', () => {
    const l = linhaLead({ nome: 'Ana', whatsapp: '11', origem: 'contato' });
    expect(Object.keys(l).sort()).toEqual(['cidade', 'email', 'mensagem', 'nome', 'origem', 'segmento', 'whatsapp']);
    expect(l.email).toBeNull();
    expect(l.mensagem).toBeNull();
  });

  it('o WhatsApp de socorro leva os dados preenchidos', () => {
    const url = whatsappDoLead({ nome: 'Ana', whatsapp: '11 9999', cidade: 'Guarulhos', origem: 'x' });
    expect(url).toContain('wa.me/');
    expect(decodeURIComponent(url)).toContain('Nome: Ana');
    expect(decodeURIComponent(url)).toContain('Cidade: Guarulhos');
  });
});
