import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Catraca de internacionalização.
 *
 * O tDynamic traduz procurando o texto EM PORTUGUÊS dentro do dicionário. Quando
 * a entrada não existe ele devolve o original — sem erro, sem log, sem nada. O
 * resultado é a página ficar bilíngue misturada com o idioma em inglês, que é
 * pior do que não oferecer inglês nenhum. Em 19/08/2026 havia 238 textos nessa
 * situação e ninguém tinha como saber.
 *
 * Estes testes transformam esse vazamento silencioso em build quebrado.
 */

const RAIZ = join(process.cwd(), 'src');

function listarArquivos(dir: string, exts: string[]): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...listarArquivos(caminho, exts));
    } else if (exts.some((e) => nome.endsWith(e)) && !nome.endsWith('.test.ts')) {
      saida.push(caminho);
    }
  }
  return saida;
}

const fonte = new Map<string, string>();
for (const f of listarArquivos(RAIZ, ['.ts', '.tsx'])) {
  fonte.set(f, readFileSync(f, 'utf-8'));
}

const dicionario = readFileSync(join(RAIZ, 'data', 'i18nData.ts'), 'utf-8');

/** Todas as chaves em português já cadastradas (mapa de texto e dicionário). */
function chavesTraduzidas(): Set<string> {
  const chaves = new Set<string>();
  for (const m of dicionario.matchAll(/^\s*'((?:[^'\\]|\\.)*)'\s*:\s*'/gm)) {
    chaves.add(m[1]);
  }
  return chaves;
}

/** Textos que chegam ao tDynamic: chamadas literais + campos de dados da home. */
function textosDeInterface(): Set<string> {
  const usados = new Set<string>();

  for (const [caminho, s] of fonte) {
    if (!caminho.endsWith('.tsx')) continue;
    for (const m of s.matchAll(/tDynamic\(\s*'((?:[^'\\]|\\.)+)'\s*\)/g)) usados.add(m[1]);
    for (const m of s.matchAll(/tDynamic\(\s*"((?:[^"\\]|\\.)+)"\s*\)/g)) usados.add(m[1]);
  }

  // Arrays de dados repassados a componentes que traduzem (FlipCard e afins).
  const comDados = ['Home.tsx', 'Showcase.tsx', 'RecursosShowcase.tsx'];
  for (const [caminho, s] of fonte) {
    if (!comDados.some((n) => caminho.endsWith(n))) continue;
    for (const campo of ['titulo', 'texto', 'metrica', 'badge', 'resumo', 'subtitulo']) {
      for (const m of s.matchAll(new RegExp(`${campo}:\\s*'((?:[^'\\\\]|\\\\.)+)'`, 'g'))) {
        usados.add(m[1]);
      }
    }
    for (const bloco of s.matchAll(/detalhes:\s*\[([\s\S]*?)\]/g)) {
      for (const item of bloco[1].matchAll(/'((?:[^'\\]|\\.)+)'/g)) usados.add(item[1]);
    }
  }
  return usados;
}

describe('cobertura de tradução', () => {
  it('todo texto de UI que passa pelo tDynamic tem tradução cadastrada', () => {
    const traduzidas = chavesTraduzidas();
    const faltando = [...textosDeInterface()]
      .filter((t) => t.length > 2 && /[A-Za-zÀ-ÿ]/.test(t))
      .filter((t) => !traduzidas.has(t))
      .sort();

    expect(
      faltando,
      `\n${faltando.length} texto(s) de interface sem tradução em en-US.\n` +
        'Sem a entrada no dicionário o tDynamic devolve o português e a tela fica\n' +
        'bilíngue. Cadastre em MAPA_TRADUCAO_TEXTO (src/data/i18nData.ts):\n\n' +
        faltando.map((t) => `  '${t}': '...',`).join('\n') +
        '\n',
    ).toEqual([]);
  });
});

describe('copy das landing pages', () => {
  /**
   * O ponto cego que deixou a pagina do iFood sair em portugues no /en.
   *
   * A catraca acima varre `tDynamic('literal')`. As landing pages nao escrevem
   * assim: elas guardam a copy em landingPagesData.ts e a tela chama
   * `tDynamic(data.h1Title)` — com VARIAVEL. Nenhuma expressao regular de
   * varredura enxerga isso, entao 488 frases de marketing passavam batidas.
   *
   * Sem entrada no dicionario, o tDynamic cai na substituicao palavra a palavra
   * e devolve frase pela metade em ingles. Foi assim que a pagina de integracao
   * inteira — H1, cards, regras de negocio e FAQ — ficou macarronica sem que
   * nenhum teste reclamasse.
   *
   * A divida existente esta medida no TETO. A pagina do iFood foi traduzida por
   * inteiro (67 frases); o resto fica registrado aqui em vez de invisivel. Regra:
   * nao pode aumentar. Ao traduzir um bloco, baixe o teto junto.
   */
   const TETO_SEM_TRADUCAO = 441;

  /** Campos de landingPagesData.ts que chegam na tela como texto. */
  const CAMPOS = [
    'badge', 'h1Title', 'h1Highlight', 'subheadline', 'painPointsTitle',
    'painPointsSubtitle', 'featuresTitle', 'featuresSubtitle', 'semMiseOn',
    'comMiseOn', 'title', 'description', 'tag', 'label', 'value',
    'pergunta', 'resposta', 'titulo', 'legenda',
  ];

  it('a copy das landings nao cresce sem traducao', () => {
    const dados = readFileSync(join(RAIZ, 'data', 'landingPagesData.ts'), 'utf-8');
    const traduzidas = chavesTraduzidas();

    const textos = new Set<string>();
    for (const campo of CAMPOS) {
      const rx = new RegExp(`${campo}:\\s*'((?:[^'\\\\]|\\\\.)+)'`, 'g');
      for (const m of dados.matchAll(rx)) {
        const t = m[1].replace(/\\'/g, "'");
        if (t.length > 2 && /[A-Za-zÀ-ÿ]/.test(t)) textos.add(t);
      }
    }

    const faltando = [...textos].filter((t) => !traduzidas.has(t));

    expect(
      faltando.length,
      `\n${faltando.length} frases de landing page sem traducao (teto: ${TETO_SEM_TRADUCAO}).\n` +
        'Elas chegam na tela por tDynamic(data.campo) — variavel, nao literal —\n' +
        'entao a catraca de cobertura nao as enxerga. Sem entrada no dicionario o\n' +
        'visitante em /en le portugues traduzido palavra a palavra.\n' +
        'Cadastre em MAPA_TRADUCAO_TEXTO (src/data/i18nData.ts).\n',
    ).toBeLessThanOrEqual(TETO_SEM_TRADUCAO);
  });
});

describe('texto escrito direto no JSX', () => {
  /**
   * Limite de não-regressão.
   *
   * Existe um terceiro caso que os testes acima NÃO alcançam: texto escrito
   * solto dentro do JSX, sem passar por tDynamic —
   *
   *     <Boxes size={22} /> Observabilidade 3D de Estoque Físico
   *
   * Esse texto nunca é traduzido e nem aparece na varredura do dicionário, então
   * declarar cobertura total aqui seria falsa segurança. Começou em 631 e
   * está em 17. O que sobrou vive em lugares onde não existe componente para
   * pendurar o hook — JSX dentro de `const RECURSOS = [...]`, em escopo de
   * módulo — ou é dado fictício de mockup ("Rua das Flores, 123"). Tirar isso
   * exigiria mover os arrays para dentro de componentes, o que não se paga
   * pelo que se ganha.
   *
   * Então o combinado é: não pode aumentar. Ao envolver um trecho em tDynamic,
   * baixe o teto junto. Ao adicionar texto novo solto, este teste reprova.
   */
  const TETO = 19;

  it('não cresce o volume de texto não traduzível', () => {
    const rxJsx = />\s*([A-ZÀ-Ý][^<>{}\n]{14,150}?)\s*</g;
    // Detecta português por acento OU palavra funcional. A primeira versão
    // procurava só 16 palavras e deixava passar frases inteiras sem nenhuma
    // delas — "Observabilidade 3D de Estoque Físico" não casava com nenhuma e
    // saía da conta. O teto marcava 2 quando o número real era 631: falsa
    // segurança, exatamente o que este arquivo existe para evitar.
    const rePT = /[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]|\b(de|da|do|das|dos|em|na|no|nas|nos|com|para|por|que|uma|um|os|as|ao|aos|pelo|pela|sem|seu|sua|você|não|mais|já|também|ou|se|são|está|estão)\b/i;
    const reEN = /\b(the|your|with|and|for|from|this|that|you|are|will|can|our)\b/i;

    let total = 0;
    for (const [caminho, s] of fonte) {
      if (!caminho.endsWith('.tsx')) continue;
      for (const m of s.matchAll(rxJsx)) {
        const t = m[1].trim();
        if (!rePT.test(t)) continue;
        // frase claramente em inglês e sem acento não conta
        if (reEN.test(t) && !/[áéíóúâêôãõç]/i.test(t)) continue;
        if (/^[{}/]|&&|=>/.test(t)) continue;
        total++;
      }
    }

    expect(
      total,
      `\nTexto solto no JSX subiu de ${TETO} para ${total}.\n` +
        'Texto assim nunca chega ao dicionário e some da tradução para o inglês.\n' +
        'Envolva em {tDynamic(\'...\')} e cadastre em MAPA_TRADUCAO_TEXTO.\n' +
        'Se você REDUZIU o número, baixe a constante TETO neste teste.\n',
    ).toBeLessThanOrEqual(TETO);
  });
});

describe('português dos textos de interface', () => {
  // Palavras cuja forma sem acento NÃO existe em português — se aparecerem
  // assim, é digitação sem acentuação, e o visitante brasileiro é quem lê.
  const SEM_ACENTO = [
    'voce', 'nao', 'proprio', 'propria', 'cardapio', 'sugestao', 'comissao',
    'salao', 'balcao', 'garcom', 'gestao', 'preco', 'producao', 'estacoes',
    'operacao', 'integracao', 'antecipacao', 'conciliacao', 'emissao',
    // 'analise' fica de fora: é forma verbal válida ("Analise o tempo médio"),
    // diferente de 'análise'. Mesma razão de 'media', 'ja', 'so' e 'ate'.
    'impressao', 'historico', 'relatorio', 'automatico', 'automatica',
    'minimo', 'maximo', 'rapido', 'basico', 'publico', 'atencao', 'atraves',
    'servico', 'usuario', 'codigo', 'numero', 'padrao', 'descricao', 'posicao',
    'informacao', 'informacoes', 'configuracao', 'configuracoes', 'notificacao',
    'notificacoes', 'tambem', 'referencia', 'cientifica', 'recuperacao',
    'distancia', 'liquido', 'contribuicao', 'calculo', 'generica', 'lancada',
    'balanca', 'peca', 'variavel', 'periodo', 'disponivel', 'possivel', 'nivel',
    'rotulo', 'metrica', 'tecnica', 'conferencia', 'multiplos', 'ultimos',
  ];
  const regex = new RegExp(`\\b(${SEM_ACENTO.join('|')})\\b`, 'i');

  it('não há português sem acentuação nos textos de interface', () => {
    const problemas: string[] = [];
    for (const t of textosDeInterface()) {
      if (regex.test(t)) problemas.push(t);
    }
    expect(
      problemas.sort(),
      `\n${problemas.length} texto(s) de interface com português sem acentuação.\n` +
        'Isto aparece assim para o visitante brasileiro — o cliente-alvo:\n\n' +
        problemas.map((t) => `  ${t}`).join('\n') +
        '\n',
    ).toEqual([]);
  });
});
