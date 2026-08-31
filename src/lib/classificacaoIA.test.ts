import { describe, it, expect } from 'vitest';
import { aplicarClassificacao, type ClassificacaoIA } from './classificacaoIA';
import { UNIDADES } from './unidades';
import { itemPorSlug } from './catalogoInsumos';

/**
 * As respostas abaixo são as que o modelo REALMENTE devolveu para descrições de
 * atacado, colhidas contra a API. Servem de fixture porque é justamente onde a
 * IA acerta o gênero e erra a unidade — o caso que estas regras existem para
 * consertar.
 */
const resposta = (p: Partial<ClassificacaoIA>): ClassificacaoIA => ({
  indice: 0, genero_slug: null, nome: '', unidade: 'un', variedade: null, marca: null,
  categoria: 'Outros', conteudo_qtd: null, conteudo_unidade: null, confianca: 'media', ...p,
});

describe('o catálogo manda na unidade quando reconhece o gênero', () => {
  it('mussarela em pacote de 500g não vira estoque em unidades', () => {
    const s = aplicarClassificacao(
      { descricao: 'MUC FAT TIROLEZ 500G', unidade: 'un', qtd: 4 },
      resposta({ genero_slug: 'queijo-mussarela', nome: 'Queijo mussarela', unidade: 'un',
        variedade: 'Fatiado', marca: 'Tirolez', conteudo_qtd: 500, conteudo_unidade: 'g', confianca: 'alta' }),
    );
    expect(s.unidade).toBe('kg'); // e não o 'un' que a IA devolveu
    expect(s.nome).toBe('Queijo mussarela');
    expect(s.fator).toBeCloseTo(0.5); // 500 g = 0,5 kg por pacote
  });

  it('azeite reconhecido entra em litro, como o catálogo define', () => {
    const s = aplicarClassificacao(
      { descricao: 'AZEITE PORT GALLO EXT VIRG 500ML', unidade: 'un', qtd: 6 },
      resposta({ genero_slug: 'azeite', nome: 'Azeite de oliva', unidade: 'un',
        variedade: 'Extra virgem', marca: 'Gallo', conteudo_qtd: 500, conteudo_unidade: 'ml' }),
    );
    expect(s.unidade).toBe('L');
    expect(s.nome).toBe('Azeite');
    expect(s.fator).toBeCloseTo(0.5);
  });

  it('usa o nome canônico do catálogo, não a variação da IA', () => {
    const s = aplicarClassificacao(
      { descricao: 'CEB BCA NAC SC 20KG', unidade: 'sc', qtd: 1 },
      resposta({ genero_slug: 'cebola', nome: 'Cebola branca', unidade: 'kg',
        variedade: 'Branca nacional', conteudo_qtd: 20, conteudo_unidade: 'kg' }),
    );
    expect(s.nome).toBe('Cebola');
    expect(s.unidade).toBe('kg');
    expect(s.fator).toBe(20); // um saco rende 20 kg
    expect(s.slug).toBe('cebola');
  });
});

describe('o nome final não repete a variedade', () => {
  it('descarta variedade que já está dita no nome', () => {
    const s = aplicarClassificacao(
      { descricao: 'REQ CREM TIROLEZ CP 200G', unidade: 'un', qtd: 2 },
      resposta({ genero_slug: null, nome: 'Requeijão cremoso', unidade: 'un',
        variedade: 'Cremoso', marca: 'Tirolez', confianca: 'alta' }),
    );
    expect(s.variedade).toBeNull();
    expect(s.nomeCompleto).toBe('Requeijão cremoso Tirolez');
  });

  it('mantém variedade que acrescenta informação', () => {
    const s = aplicarClassificacao(
      { descricao: 'ARROZ TIO JOAO PARBOILIZADO 5KG', unidade: 'pct', qtd: 2 },
      resposta({ genero_slug: 'arroz', nome: 'Arroz', unidade: 'kg',
        variedade: 'Parboilizado', marca: 'Tio João', conteudo_qtd: 5, conteudo_unidade: 'kg' }),
    );
    expect(s.variedade).toBe('Parboilizado');
    expect(s.nomeCompleto).toBe('Arroz Parboilizado Tio João');
    expect(s.fator).toBe(5);
  });

  it('ignora diferença de acento e caixa ao comparar', () => {
    const s = aplicarClassificacao(
      { descricao: 'BATATA PRE FRITA MCCAIN 2,5KG', unidade: 'un', qtd: 4 },
      resposta({ genero_slug: null, nome: 'Batata pré-frita', unidade: 'kg',
        variedade: 'PRE FRITA', marca: 'McCain', conteudo_qtd: 2.5, conteudo_unidade: 'kg' }),
    );
    expect(s.variedade).toBeNull();
    expect(s.nomeCompleto).toBe('Batata pré-frita McCain');
  });
});

describe('o que a IA não decide', () => {
  it('a nota pesada continua mandando no rendimento', () => {
    // Comprado a quilo: o fator é a conversão física, não o conteúdo lido.
    const s = aplicarClassificacao(
      { descricao: 'FILE MIGNON BOV RESF SWIFT KG', unidade: 'kg', qtd: 3.2 },
      resposta({ genero_slug: 'file-mignon', nome: 'Filé mignon', unidade: 'kg',
        variedade: 'Resfriado', marca: 'Swift', conteudo_qtd: 1, conteudo_unidade: 'kg' }),
    );
    expect(s.fator).toBe(1);
  });

  it('unidade inventada pela IA é reduzida a algo que o banco aceita', () => {
    const s = aplicarClassificacao(
      { descricao: 'ITEM ESTRANHO', unidade: 'xx', qtd: 1 },
      resposta({ genero_slug: null, nome: 'Item estranho', unidade: 'caixa' }),
    );
    expect(UNIDADES.some((u) => u.codigo === s.unidade)).toBe(true);
    expect(s.unidade).toBe('un');
  });

  it('slug que não existe no catálogo não vira vínculo', () => {
    const s = aplicarClassificacao(
      { descricao: 'PILHA DURACELL AA C/4', unidade: 'un', qtd: 1 },
      resposta({ genero_slug: 'pilha-alcalina', nome: 'Pilha', unidade: 'un',
        variedade: 'AA', marca: 'Duracell', categoria: 'Outros', conteudo_qtd: 4, conteudo_unidade: 'un' }),
    );
    expect(itemPorSlug('pilha-alcalina')).toBeNull();
    expect(s.slug).toBeNull();
    expect(s.nome).toBe('Pilha');
    expect(s.nomeCompleto).toBe('Pilha AA Duracell');
  });

  it('nunca devolve fator zero ou negativo', () => {
    const s = aplicarClassificacao(
      { descricao: 'QUALQUER COISA', unidade: 'un', qtd: 1 },
      resposta({ nome: 'Coisa', unidade: 'un', conteudo_qtd: -5, conteudo_unidade: 'kg' }),
    );
    expect(s.fator).toBeGreaterThan(0);
  });

  it('toda sugestão sai com unidade do catálogo de unidades', () => {
    const casos: ClassificacaoIA[] = [
      resposta({ nome: 'A', unidade: 'kg' }),
      resposta({ nome: 'B', unidade: 'L' }),
      resposta({ nome: 'C', unidade: 'fardo' }),
      resposta({ nome: 'D', unidade: '' }),
      resposta({ genero_slug: 'tomate', nome: 'Tomate', unidade: 'rodela' }),
    ];
    for (const c of casos) {
      const s = aplicarClassificacao({ descricao: 'X', unidade: 'un', qtd: 1 }, c);
      expect(UNIDADES.some((u) => u.codigo === s.unidade), `${c.unidade} -> ${s.unidade}`).toBe(true);
      expect(UNIDADES.find((u) => u.codigo === s.unidade)?.grandeza).not.toBe('semantico');
    }
  });
});
