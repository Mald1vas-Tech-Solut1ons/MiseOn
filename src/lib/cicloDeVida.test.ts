import { describe, it, expect } from 'vitest';
import { sugerirValidade, ehPerecivel, avaliarValidade, recomendarModo } from './cicloDeVida';
import { CATALOGO } from './catalogoInsumos';

const COMPRA = '2026-08-04T18:43:08Z';

describe('validade sugerida pelo gênero', () => {
  it('propõe prazo curto para o que estraga rápido', () => {
    const s = sugerirValidade('file-de-frango', COMPRA);
    expect(s?.dias).toBeLessThanOrEqual(5);
    expect(s?.vence_em).toBe('2026-08-08');
    expect(s?.texto).toMatch(/Confira a data na embalagem/);
  });

  it('propõe prazo longo para seco, sem alarme', () => {
    const s = sugerirValidade('arroz', COMPRA);
    expect(s!.dias).toBeGreaterThan(180);
    expect(s?.texto).toMatch(/longa duração/);
  });

  it('conta da data da COMPRA, não de hoje', () => {
    // Nota antiga: a validade tem que ser contada de quando o item chegou.
    expect(sugerirValidade('alface', '2026-08-04T00:00:00Z')?.vence_em).toBe('2026-08-08');
  });

  it('não inventa validade para o que não perece nem para o desconhecido', () => {
    expect(sugerirValidade('detergente', COMPRA)).toBeNull();
    expect(sugerirValidade('marmitex', COMPRA)).toBeNull();
    expect(sugerirValidade('gelo', COMPRA)).toBeNull();
    expect(sugerirValidade(null, COMPRA)).toBeNull();
    expect(sugerirValidade('nao-existe', COMPRA)).toBeNull();
  });

  it('classifica como perecível o que exige controle sanitário', () => {
    expect(ehPerecivel('file-de-frango')).toBe(true);
    expect(ehPerecivel('alface')).toBe(true);
    expect(ehPerecivel('leite')).toBe(false);   // UHT dura 90 dias
    expect(ehPerecivel('arroz')).toBe(false);
    expect(ehPerecivel('detergente')).toBe(false);
  });

  it('todo gênero de comida fresca tem prazo cadastrado', () => {
    const frescos = CATALOGO.filter((c) =>
      ['Hortifrúti', 'Carnes', 'Pescados', 'Frios', 'Laticínios', 'Padaria'].includes(c.categoria));
    const sem = frescos.filter((c) => !c.validadeDias);
    expect(sem.map((c) => c.nome)).toEqual([]);
  });

  it('nenhum item de limpeza ou descartável finge ter validade', () => {
    const naoPerece = CATALOGO.filter((c) => ['Limpeza', 'Descartáveis'].includes(c.categoria));
    expect(naoPerece.every((c) => !c.validadeDias)).toBe(true);
  });
});

describe('alerta de vencimento na conferência', () => {
  const hoje = new Date('2026-08-31T12:00:00Z');

  it('grita quando o item já chegou vencido', () => {
    const a = avaliarValidade('2026-08-20', true, hoje);
    expect(a.situacao).toBe('vencido');
    expect(a.critico).toBe(true);
    expect(a.texto).toMatch(/Já venceu/);
  });

  it('avisa o que vence dentro da semana', () => {
    const a = avaliarValidade('2026-09-03', true, hoje);
    expect(a.situacao).toBe('vence_logo');
    expect(a.dias).toBe(3);
    expect(a.texto).toMatch(/Use primeiro/);
  });

  it('não incomoda com o que está longe de vencer', () => {
    const a = avaliarValidade('2027-01-01', false, hoje);
    expect(a.situacao).toBe('ok');
    expect(a.critico).toBe(false);
  });

  it('perecível sem validade é problema; seco sem validade não é', () => {
    expect(avaliarValidade(null, true, hoje).critico).toBe(true);
    expect(avaliarValidade(null, true, hoje).texto).toMatch(/não vai conseguir avisar/);
    expect(avaliarValidade(null, false, hoje).critico).toBe(false);
  });

  it('data torta não quebra a conferência', () => {
    expect(avaliarValidade('31/08/2026', true, hoje).situacao).toBe('sem_validade');
  });
});

describe('como a nota deve entrar', () => {
  it('compra recente entra no saldo sem perguntar nada', () => {
    const r = recomendarModo(2);
    expect(r.modo).toBe('SOMAR');
    expect(r.perguntar).toBe(false);
  });

  it('nota antiga vira pergunta, porque só o lojista sabe a resposta', () => {
    const r = recomendarModo(26);
    expect(r.perguntar).toBe(true);
    expect(r.explicacao).toMatch(/26 dias/);
    expect(r.explicacao).toMatch(/CMV/);
  });

  it('nota sem data conhecida não trava o fluxo', () => {
    expect(recomendarModo(null).perguntar).toBe(false);
  });
});
