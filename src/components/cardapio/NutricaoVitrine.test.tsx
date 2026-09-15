// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import TabelaNutricional from './TabelaNutricional';
import ResumoNutricionalPedido from './ResumoNutricionalPedido';
import type { NutricaoOpcao, NutricaoProduto, NutrienteCatalogo } from '../../lib/nutricao';
import type { ItemCarrinho } from '../../types';

afterEach(cleanup);

const catalogo: NutrienteCatalogo[] = [{
  codigo: 'ENERGIA_KCAL', rotulo: 'Valor energético', abreviacao: null,
  unidade: 'kcal', ordem: 1, indentacao: 0, obrigatorio_anvisa: true, vdr: 2000, ativo: true,
}];
const prato: NutricaoProduto = {
  produto_id: 'prato', publicavel: true, status: 'COMPLETO', parcial: false,
  por_porcao: { ENERGIA_KCAL: 300 }, por_100g: { ENERGIA_KCAL: 150 },
  peso_porcao_g: 200, porcoes: 1, massa_servida_g: 200,
  cobertura_pct: 100, itens_total: 3, itens_com_dado: 3,
  alergenos_contem: [], alergenos_pode_conter: [], atributos: ['BAIXO_SODIO'],
  composicao_fontes: { ROTULO: 100 }, atualizado_em: '2026-09-15T00:00:00Z',
};
const extra: NutricaoOpcao = {
  opcao_id: 'extra', produto_id: 'prato', nutrientes: { ENERGIA_KCAL: 100 },
  massa_g: 50, completo: true, alergenos_contem: ['leite'], alergenos_pode_conter: [],
};
const item: ItemCarrinho = {
  produto: { id: 'prato', nome: 'Prato', preco: 25, is_combo: false, destaque: false, disponivel: true, vendidos: 0 },
  quantidade: 1,
  opcoesSelecionadas: [{ id: 'extra', grupo_id: 'grupo', nome: 'Queijo', preco_adicional: 3, disponivel: true }],
};

describe('nutrição da composição escolhida', () => {
  it('troca de 100 g para a porção com extra sem divergir número, legenda e %VD', () => {
    const { rerender } = render(<TabelaNutricional dados={prato} catalogo={catalogo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tabela nutricional completa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Por 100 g' }));
    expect(within(screen.getByRole('table')).getByText('150 kcal')).toBeTruthy();

    rerender(<TabelaNutricional dados={prato} catalogo={catalogo} extras={[extra]} totalExtrasSelecionados={1} />);
    const tabela = screen.getByRole('table', { name: 'Informação nutricional por porção' });
    expect(within(tabela).getByText('400 kcal')).toBeTruthy();
    expect(within(tabela).getByText('20%')).toBeTruthy();
    expect(screen.getByText('Incluindo os adicionais que você escolheu · porção de 250 g')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Por 100 g' })).toBeNull();

    rerender(<TabelaNutricional dados={prato} catalogo={catalogo} extras={[]} totalExtrasSelecionados={0} />);
    expect(within(screen.getByRole('table', { name: 'Informação nutricional por 100 gramas' })).getByText('150 kcal')).toBeTruthy();
  });

  it('avisa a cobertura parcial antes de expandir e não chama a tabela de completa', () => {
    render(<TabelaNutricional dados={{ ...prato, status: 'PARCIAL', parcial: true, cobertura_pct: 60, itens_com_dado: 2 }} catalogo={catalogo} />);
    expect(screen.getByRole('status').textContent).toContain('cobertura de 60%');
    expect(screen.getByRole('status').textContent).toContain('2 de 3 ingredientes');
    expect(screen.queryByRole('button', { name: 'Tabela nutricional completa' })).toBeNull();
    expect(screen.queryByText('Baixo em sódio')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver valores nutricionais disponíveis' })).toBeTruthy();
  });

  it('conta adicionais ausentes e incompletos, sem apresentar o peso conhecido como peso final', () => {
    render(<TabelaNutricional dados={prato} catalogo={catalogo} extras={[{ ...extra, completo: false }]} totalExtrasSelecionados={2} />);
    expect(screen.getByRole('status').textContent).toContain('2 adicionais escolhidos ainda não têm dados completos');
    fireEvent.click(screen.getByRole('button', { name: 'Ver valores nutricionais disponíveis' }));
    expect(screen.getByText('Composição com adicionais: valores e peso ainda incompletos.')).toBeTruthy();
    expect(screen.queryByText(/porção de 250 g/)).toBeNull();
    expect(within(screen.getByRole('table')).getByText('400 kcal')).toBeTruthy();
  });

  it('não mantém selo da base após personalizar e restaura quando o extra é removido', () => {
    const { rerender } = render(<TabelaNutricional dados={prato} catalogo={catalogo} />);
    expect(screen.getByText('Baixo em sódio')).toBeTruthy();
    rerender(<TabelaNutricional dados={prato} catalogo={catalogo} extras={[extra]} />);
    expect(screen.queryByText('Baixo em sódio')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tabela nutricional completa' }));
    expect(screen.getByText(/Origem dos dados da receita base/)).toBeTruthy();
    expect(screen.queryByText(/Todos os 3 ingredientes/)).toBeNull();
    rerender(<TabelaNutricional dados={prato} catalogo={catalogo} />);
    expect(screen.getByText('Baixo em sódio')).toBeTruthy();
  });

  it('conserva o alérgeno conhecido do extra mesmo sem registro nutricional da base', () => {
    render(<TabelaNutricional catalogo={catalogo} extras={[extra]} totalExtrasSelecionados={1} />);
    expect(screen.getByText('Contém: leite.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText(/100 kcal/)).toBeNull();
  });
});

describe('resumo nutricional do pedido', () => {
  it.each([undefined, { ...prato, publicavel: false }])('não omite leite do adicional quando a base não publica números (%s)', (base) => {
    const { container } = render(<ResumoNutricionalPedido carrinho={[item]} nutricao={base ? new Map([['prato', base]]) : new Map()} nutricaoOpcoes={new Map([['extra', extra]])} catalogo={catalogo} />);
    expect(container.textContent).toContain('Contém: leite.');
    expect(screen.getByRole('status').textContent).toContain('1 item sem valores disponíveis ficou fora da soma');
    expect(screen.queryByText(/100 kcal/)).toBeNull();
  });

  it('mostra pode conter mesmo sem calorias nem alergênico do tipo contém', () => {
    const { container } = render(<ResumoNutricionalPedido carrinho={[item]} nutricao={new Map()} nutricaoOpcoes={new Map([['extra', { ...extra, alergenos_contem: [], alergenos_pode_conter: ['amendoim'] }]])} catalogo={catalogo} />);
    expect(container.textContent).toContain('Pode conter: amendoim.');
    expect(screen.getByRole('region', { name: 'Resumo nutricional do pedido' })).toBeTruthy();
  });

  it('qualifica a soma de receita parcial e adicional ausente sem perder a quantidade comprada', () => {
    render(<ResumoNutricionalPedido carrinho={[{ ...item, quantidade: 2 }]} nutricao={new Map([['prato', { ...prato, parcial: true, status: 'PARCIAL', cobertura_pct: 60 }]])} nutricaoOpcoes={new Map()} catalogo={catalogo} />);
    expect(screen.getByText('600 kcal')).toBeTruthy();
    const aviso = screen.getByRole('status').textContent;
    expect(aviso).toContain('1 receita tem cobertura nutricional parcial');
    expect(aviso).toContain('1 adicional escolhido ainda não tem dados completos');
  });

  it('soma os extras completos de cada unidade e mantém o resumo sem alerta de parcial', () => {
    render(<ResumoNutricionalPedido carrinho={[{ ...item, quantidade: 2 }]} nutricao={new Map([['prato', prato]])} nutricaoOpcoes={new Map([['extra', extra]])} catalogo={catalogo} />);
    expect(screen.getByText('800 kcal')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
