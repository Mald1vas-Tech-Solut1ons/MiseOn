import { describe, it, expect } from 'vitest';
import { UNIDADES } from './unidades';
import { normalizarUnidadeFiscal, extrairConteudos } from './unidadesFiscais';
import {
  CATALOGO,
  casarCatalogo,
  sugerirDaNota,
  limparDescricao,
  unidadeSegura,
  fatorPara,
  GRUPOS_UNIDADE_COMPRA,
  slugDoItem,
  itemPorSlug,
  buscarCatalogo,
  montarNomeInsumo,
  separarIdentidade,
} from './catalogoInsumos';

describe('normalizarUnidadeFiscal', () => {
  it('traduz a sigla que derrubou a importação de 53 itens', () => {
    // "bd" chegava crua em insumos.unidade_medida e violava a FK.
    expect(normalizarUnidadeFiscal('bd')).toEqual({ codigo: 'bdj', ambigua: false });
  });

  it('aceita as variações de caixa e pontuação da mesma sigla', () => {
    for (const sigla of ['KG', 'kg', 'Kg.', ' kg ']) {
      expect(normalizarUnidadeFiscal(sigla)?.codigo).toBe('kg');
    }
    expect(normalizarUnidadeFiscal('Pç')?.codigo).toBe('un');
    expect(normalizarUnidadeFiscal('GR')?.codigo).toBe('g');
  });

  it('marca as siglas de duplo sentido do varejo', () => {
    expect(normalizarUnidadeFiscal('lt')).toEqual({ codigo: 'L', ambigua: true });
    expect(normalizarUnidadeFiscal('pc')).toEqual({ codigo: 'un', ambigua: true });
  });

  it('devolve null em vez de repassar sigla desconhecida', () => {
    expect(normalizarUnidadeFiscal('xpto')).toBeNull();
    expect(normalizarUnidadeFiscal('')).toBeNull();
    expect(normalizarUnidadeFiscal(null)).toBeNull();
  });

  it('nunca produz código fora do catálogo — é essa a trava da FK', () => {
    const validos = new Set(UNIDADES.map((u) => u.codigo));
    const siglas = ['bd', 'BDJ', 'lt', 'pc', 'pt', 'cx', 'fd', 'sc', 'gf', 'dz', 'un', 'kg', 'g', 'ml', 'l', 'gr'];
    for (const s of siglas) {
      const r = normalizarUnidadeFiscal(s);
      expect(r).not.toBeNull();
      expect(validos.has(r!.codigo)).toBe(true);
    }
  });
});

describe('extrairConteudos', () => {
  it('lê a quantidade escrita na embalagem', () => {
    expect(extrairConteudos('APP1 OVOS EXTRA BRANCO PVC 20UN')).toContainEqual(
      expect.objectContaining({ qtd: 20, unidade: 'un' }),
    );
    expect(extrairConteudos('AGUA SANIT SELECT 2L')).toContainEqual(
      expect.objectContaining({ qtd: 2, unidade: 'L' }),
    );
    expect(extrairConteudos('ACUCAR UNIAO 5KG')).toContainEqual(
      expect.objectContaining({ qtd: 5, unidade: 'kg' }),
    );
    expect(extrairConteudos('LEITE ITALAC 1,5L')).toContainEqual(
      expect.objectContaining({ qtd: 1.5, unidade: 'L' }),
    );
  });

  it('multiplica embalagem composta', () => {
    expect(extrairConteudos('REFRI FARDO 12X1L')).toContainEqual(
      expect.objectContaining({ qtd: 12, unidade: 'L' }),
    );
    expect(extrairConteudos('OVO CARTELA C/30')).toContainEqual(
      expect.objectContaining({ qtd: 30, unidade: 'un' }),
    );
  });

  it('converte dúzia escrita na descrição em contagem', () => {
    expect(extrairConteudos('OVO CAIPIRA 1DZ')).toContainEqual(
      expect.objectContaining({ qtd: 12, unidade: 'un' }),
    );
  });

  it('não inventa conteúdo onde não há', () => {
    expect(extrairConteudos('TOMATE SALADA')).toEqual([]);
  });
});

describe('casarCatalogo', () => {
  it('reconhece o gênero apesar do nome do mercado', () => {
    expect(casarCatalogo('TOMATE SALADA KG')?.nome).toBe('Tomate');
    expect(casarCatalogo('TOM ITALIANO GRANEL')?.nome).toBe('Tomate');
    expect(casarCatalogo('APP1 OVOS EXTRA BRANCO PVC 20UN')?.nome).toBe('Ovos');
    expect(casarCatalogo('CEB BRANCA NACIONAL')?.nome).toBe('Cebola');
  });

  it('prefere o termo mais específico', () => {
    expect(casarCatalogo('MOLHO DE TOMATE POMAROLA 340G')?.nome).toBe('Molho de tomate');
    expect(casarCatalogo('EXTRATO DE TOMATE ELEFANTE')?.nome).toBe('Extrato de tomate');
    expect(casarCatalogo('FILE DE FRANGO RESFRIADO')?.nome).toBe('Filé de frango');
  });

  it('casa por palavra inteira — "sal" não pode morar dentro de "salada"', () => {
    expect(casarCatalogo('ALFACE CRESPA SALADA')?.nome).not.toBe('Sal');
    expect(casarCatalogo('SALSICHA HOT DOG')?.nome).toBe('Salsicha');
    expect(casarCatalogo('SAL REFINADO CISNE 1KG')?.nome).toBe('Sal');
  });

  it('devolve null para o que não conhece', () => {
    expect(casarCatalogo('ZZZ PRODUTO EXOTICO')).toBeNull();
  });

  it('só cataloga unidade de compra — rodela e fatia nascem de preparo', () => {
    const semanticas = new Set(
      UNIDADES.filter((u) => u.grandeza === 'semantico').map((u) => u.codigo),
    );
    for (const item of CATALOGO) {
      expect(semanticas.has(item.unidade), `${item.nome} está em unidade semântica`).toBe(false);
      expect(UNIDADES.some((u) => u.codigo === item.unidade)).toBe(true);
    }
  });
});


describe('abreviação de atacado — o vocabulário real do cupom', () => {
  const casa = (descricao: string) => casarCatalogo(descricao)?.nome;

  it('a marca no meio da descrição não sequestra o gênero', () => {
    // "BISC REC TODDY CHOC" é biscoito recheado de uma marca, não achocolatado.
    // O gênero vem primeiro no cupom; a marca vem depois. Antes deste desempate
    // o item entrava como Achocolatado, em quilo, e o custo saía errado.
    expect(casa('BISC REC TODDY CHOC 130g')).toBe('Biscoito');
    expect(casa('ACHOCOLATADO TODDY 400G')).toBe('Achocolatado');
  });

  it('entende as abreviações que o atacado imprime', () => {
    expect(casa('REQ CREM TIROLEZ CP 200G')).toBe('Requeijão');
    expect(casa('MUC FATIADA TIROLEZ 500G')).toBe('Queijo mussarela');
    expect(casa('DET LIQ YPE CLEAR 500ML')).toBe('Detergente');
    expect(casa('APP1 PEITO FGO CONG C OSSO Kg')).toBe('Filé de frango');
    expect(casa('CEB BCA NAC SC 20KG')).toBe('Cebola');
    expect(casa('TOM ITAL GRANEL')).toBe('Tomate');
    expect(casa('ACUC REFINADO UNIAO 1KG')).toBe('Açúcar');
    expect(casa('MARG QUALY 500G')).toBe('Margarina');
    expect(casa('PRES COZIDO SADIA KG')).toBe('Presunto');
  });

  it('a abreviação não atropela o termo completo de outro gênero', () => {
    expect(casa('DETERGENTE EM PO OMO 1KG')).not.toBe('Tomate');
    expect(casa('CENOURA BABY 200G')).toBe('Cenoura');
    expect(casa('ALFACE AMERICANA')).toBe('Alface');
    expect(casa('PIMENTAO VERDE KG')).toBe('Pimentão');
  });

  it('o termo mais específico ainda ganha quando começam juntos', () => {
    expect(casa('MOLHO DE TOMATE POMAROLA 340G')).toBe('Molho de tomate');
    expect(casa('EXTRATO DE TOMATE ELEFANTE 350G')).toBe('Extrato de tomate');
    expect(casa('BATATA DOCE KG')).toBe('Batata doce');
  });
});

describe('sugerirDaNota — as duas linhas do cupom da foto', () => {
  it('ovos em bandeja viram contagem real de ovos', () => {
    const s = sugerirDaNota({ descricao: 'APP1 OVOS EXTRA BRANCO PVC 20UN', unidade: 'bd', qtd: 2 });
    expect(s.nome).toBe('Ovos');
    expect(s.unidade).toBe('un');
    expect(s.fator).toBe(20);
    expect(s.unidadeNota).toBe('bdj');
    // 2 bandejas = 40 ovos, e não "2 bd" que nem existe no catálogo.
    expect(s.fator * 2).toBe(40);
  });

  it('água sanitária de 2 L entra em litro', () => {
    const s = sugerirDaNota({ descricao: 'AGUA SANIT SELECT 2L', unidade: 'un', qtd: 1 });
    expect(s.nome).toBe('Água sanitária');
    expect(s.unidade).toBe('L');
    expect(s.fator).toBe(2);
  });
});

describe('sugerirDaNota — regras gerais', () => {
  it('tomate é tomate, e entra em quilo', () => {
    const s = sugerirDaNota({ descricao: 'TOMATE SALADA KG', unidade: 'kg', qtd: 1.022 });
    expect(s.nome).toBe('Tomate');
    expect(s.unidade).toBe('kg');
    expect(s.fator).toBe(1);
    expect(s.confianca).toBe('alta');
  });

  it('usa a conversão física quando a nota vem em submúltiplo', () => {
    const s = sugerirDaNota({ descricao: 'CARNE MOIDA PATINHO', unidade: 'g', qtd: 500 });
    expect(s.unidade).toBe('kg');
    expect(s.fator).toBeCloseTo(0.001);
    expect(s.fator * 500).toBeCloseTo(0.5);
  });

  it('pacote de arroz de 5 kg vira 5 kg, não 1 pacote', () => {
    const s = sugerirDaNota({ descricao: 'ARROZ TIO JOAO T1 5KG', unidade: 'pct', qtd: 2 });
    expect(s.nome).toBe('Arroz');
    expect(s.unidade).toBe('kg');
    expect(s.fator).toBe(5);
  });

  it('respeita a nota pesada quando o catálogo aponta outra grandeza', () => {
    // Hambúrguer é catalogado em un, mas este veio a peso: guardar em kg é o
    // único saldo verdadeiro possível.
    const s = sugerirDaNota({ descricao: 'HAMBURGUER ARTESANAL', unidade: 'kg', qtd: 3 });
    expect(s.unidade).toBe('kg');
    expect(s.fator).toBe(1);
  });

  it('item desconhecido em agrupador cai em contagem, nunca na sigla crua', () => {
    const s = sugerirDaNota({ descricao: 'ZZZ PRODUTO EXOTICO', unidade: 'cx', qtd: 3 });
    expect(s.unidade).toBe('un');
    expect(s.fator).toBe(1);
    expect(s.confianca).toBe('baixa');
  });

  it('sigla ilegível não contamina o cadastro', () => {
    const s = sugerirDaNota({ descricao: 'PRODUTO QUALQUER', unidade: '@@@', qtd: 1 });
    expect(s.unidadeNota).toBeNull();
    expect(UNIDADES.some((u) => u.codigo === s.unidade)).toBe(true);
  });

  it('avisa quando a sigla é ambígua', () => {
    const s = sugerirDaNota({ descricao: 'OLEO DE SOJA LIZA 900ML', unidade: 'lt', qtd: 6 });
    expect(s.explicacao).toMatch(/mais de um significado/i);
  });

  it('toda sugestão sai com unidade existente no catálogo', () => {
    const validos = new Set(UNIDADES.map((u) => u.codigo));
    const amostra = [
      { descricao: 'TOMATE SALADA KG', unidade: 'kg', qtd: 1 },
      { descricao: 'APP1 OVOS EXTRA BRANCO PVC 20UN', unidade: 'bd', qtd: 2 },
      { descricao: 'COCA COLA 2L PET', unidade: 'un', qtd: 6 },
      { descricao: 'DETERGENTE YPE 500ML', unidade: 'pc', qtd: 12 },
      { descricao: 'SEM UNIDADE NENHUMA', unidade: '', qtd: 1 },
      { descricao: '', unidade: 'zzz', qtd: 1 },
    ];
    for (const item of amostra) {
      const s = sugerirDaNota(item);
      expect(validos.has(s.unidade), `${item.descricao} → ${s.unidade}`).toBe(true);
      expect(s.fator).toBeGreaterThan(0);
    }
  });
});

describe('unidadeSegura — a barreira que protege a chave estrangeira', () => {
  it('reduz qualquer entrada a um código do catálogo', () => {
    const validos = new Set(UNIDADES.map((u) => u.codigo));
    for (const entrada of ['bd', 'xpto', '', null, undefined, '  ', 'PC']) {
      expect(validos.has(unidadeSegura(entrada))).toBe(true);
    }
  });

  it('preserva o código quando ele já é válido', () => {
    expect(unidadeSegura('kg')).toBe('kg');
    expect(unidadeSegura(' L ')).toBe('L');
    expect(unidadeSegura('rodela')).toBe('rodela'); // insumo legado não se perde
  });
});

describe('GRUPOS_UNIDADE_COMPRA — o que a tela pode oferecer', () => {
  const oferecidas = GRUPOS_UNIDADE_COMPRA.flatMap((g) => g.unidades);

  it('não deixa a compra nascer em quebra de preparo', () => {
    expect(oferecidas.some((u) => u.grandeza === 'semantico')).toBe(false);
    expect(oferecidas.some((u) => u.codigo === 'rodela')).toBe(false);
  });

  it('oferece as medidas universais de compra', () => {
    for (const codigo of ['kg', 'g', 'L', 'ml', 'un']) {
      expect(oferecidas.some((u) => u.codigo === codigo)).toBe(true);
    }
  });

  it('só oferece código que o banco aceita', () => {
    const validos = new Set(UNIDADES.map((u) => u.codigo));
    for (const u of oferecidas) expect(validos.has(u.codigo)).toBe(true);
  });
});

describe('fatorPara — trocar a unidade na tela refaz a conta', () => {
  const bandejaDeOvos = { descricao: 'APP1 OVOS EXTRA BRANCO PVC 20UN', unidade: 'bd', qtd: 2 };

  it('mantém o rendimento da embalagem na unidade sugerida', () => {
    expect(fatorPara(bandejaDeOvos, 'un').fator).toBe(20);
  });

  it('não arrasta o fator 20 para uma unidade onde ele não faz sentido', () => {
    const r = fatorPara(bandejaDeOvos, 'kg');
    expect(r.fator).toBe(1);
    expect(r.certo).toBe(false); // a tela marca "CONFIRA"
  });

  it('usa a conversão física quando ela existe', () => {
    const r = fatorPara({ descricao: 'TOMATE SALADA', unidade: 'kg', qtd: 1 }, 'g');
    expect(r.fator).toBe(1000);
    expect(r.certo).toBe(true);
  });
});

describe('identidade do item — gênero, variedade e marca', () => {
  it('cada gênero tem um slug estável e único', () => {
    const slugs = CATALOGO.map(slugDoItem);
    expect(new Set(slugs).size, 'há slugs repetidos no catálogo').toBe(slugs.length);
    expect(slugDoItem(itemPorSlug('tomate')!)).toBe('tomate');
    expect(itemPorSlug('queijo-mussarela')?.nome).toBe('Queijo mussarela');
    expect(itemPorSlug('nao-existe')).toBeNull();
  });

  it('o slug de um item traz a unidade universal de compra junto', () => {
    expect(itemPorSlug('tomate')?.unidade).toBe('kg');
    expect(itemPorSlug('cebola')?.unidade).toBe('kg');
    expect(itemPorSlug('leite')?.unidade).toBe('L');
    expect(itemPorSlug('ovos')?.unidade).toBe('un');
  });

  it('os gêneros mais comprados trazem variedades sugeridas', () => {
    expect(itemPorSlug('tomate')?.variedades).toContain('Italiano');
    expect(itemPorSlug('tomate')?.variedades).toContain('Débora');
    expect(itemPorSlug('batata')?.variedades).toContain('Asterix');
    expect(itemPorSlug('laranja')?.variedades).toContain('Pera');
    expect(itemPorSlug('arroz')?.variedades).toContain('Parboilizado');
  });

  it('nenhuma variedade sugerida vem vazia ou repetida', () => {
    for (const item of CATALOGO) {
      if (!item.variedades) continue;
      expect(item.variedades.every((v) => v.trim().length > 0)).toBe(true);
      expect(new Set(item.variedades).size, `${item.nome} repete variedade`).toBe(item.variedades.length);
    }
  });
});

describe('buscarCatalogo — o que o lojista vê ao digitar', () => {
  it('traz o gênero puro antes do derivado', () => {
    const r = buscarCatalogo('tom');
    expect(r[0].item.nome).toBe('Tomate');
    expect(r.map((x) => x.item.nome)).toContain('Molho de tomate');
  });

  it('encontra pelo nome regional, não só pelo canônico', () => {
    expect(buscarCatalogo('aipim')[0].item.nome).toBe('Mandioca');
    expect(buscarCatalogo('macaxeira')[0].item.nome).toBe('Mandioca');
    expect(buscarCatalogo('mucarela')[0].item.nome).toBe('Queijo mussarela');
  });

  it('ignora acento e caixa', () => {
    expect(buscarCatalogo('ACUCAR')[0].item.nome).toBe('Açúcar');
    expect(buscarCatalogo('açúc')[0].item.nome).toBe('Açúcar');
  });

  it('não dispara com uma letra só', () => {
    expect(buscarCatalogo('t')).toEqual([]);
  });

  it('respeita o limite pedido', () => {
    expect(buscarCatalogo('a', 5).length).toBeLessThanOrEqual(5);
    expect(buscarCatalogo('queijo', 2).length).toBeLessThanOrEqual(2);
  });
});

describe('montarNomeInsumo', () => {
  it('monta o nome na ordem em que se fala na cozinha', () => {
    expect(montarNomeInsumo({ base: 'Tomate', variedade: 'Italiano' })).toBe('Tomate Italiano');
    expect(montarNomeInsumo({ base: 'Arroz', variedade: 'Parboilizado', marca: 'Tio João' }))
      .toBe('Arroz Parboilizado Tio João');
  });

  it('a marca entra no nome para dois fabricantes do mesmo item coexistirem', () => {
    const a = montarNomeInsumo({ base: 'Arroz', variedade: 'Branco tipo 1', marca: 'Tio João' });
    const b = montarNomeInsumo({ base: 'Arroz', variedade: 'Branco tipo 1', marca: 'Camil' });
    expect(a).not.toBe(b); // a unicidade é por (loja, nome)
  });

  it('aguenta campo vazio, nulo e espaço sobrando', () => {
    expect(montarNomeInsumo({ base: '  Tomate  ', variedade: '', marca: null })).toBe('Tomate');
    expect(montarNomeInsumo({ base: 'Cebola', variedade: null })).toBe('Cebola');
  });
});

describe('separarIdentidade — reabrir cadastro legado', () => {
  it('devolve gênero e variedade de um nome já gravado', () => {
    const r = separarIdentidade('Tomate Italiano');
    expect(r.base).toBe('Tomate');
    expect(r.variedade).toBe('Italiano');
    expect(r.slug).toBe('tomate');
  });

  it('preserva a grafia do que sobrou', () => {
    expect(separarIdentidade('TOMATE DEBORA').variedade).toBe('DEBORA');
  });

  it('gênero sem variedade não inventa variedade', () => {
    const r = separarIdentidade('Cebola');
    expect(r.base).toBe('Cebola');
    expect(r.variedade).toBeNull();
  });

  it('item fora do catálogo volta inteiro, sem gênero', () => {
    const r = separarIdentidade('Receita da vovo XPTO');
    expect(r.slug).toBeNull();
    expect(r.base).toBe('Receita da vovo XPTO');
  });

  it('o que sai de separarIdentidade remonta o nome original', () => {
    for (const nome of ['Tomate Italiano', 'Batata Asterix', 'Cebola', 'Queijo mussarela Fatiada']) {
      const r = separarIdentidade(nome);
      expect(montarNomeInsumo({ base: r.base, variedade: r.variedade }).toLowerCase())
        .toBe(nome.toLowerCase());
    }
  });
});

describe('limparDescricao', () => {
  it('tira código do mercado e medida colada', () => {
    expect(limparDescricao('APP1 OVOS EXTRA BRANCO PVC 20UN')).toBe('OVOS EXTRA BRANCO PVC');
  });

  it('nunca devolve vazio', () => {
    expect(limparDescricao('500G')).toBeTruthy();
  });
});
