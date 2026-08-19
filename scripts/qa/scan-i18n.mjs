/**
 * Varredura das classes de erro que a instrumentação de i18n produz.
 * Roda sobre TODO o src/, não só os arquivos do diff.
 */
import fs from 'fs';
import path from 'path';

const raiz = 'src';
const arquivos = [];
(function anda(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) anda(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) arquivos.push(p);
  }
})(raiz);

const achados = [];
const add = (arq, linha, classe, trecho) =>
  achados.push({ arq, linha, classe, trecho: trecho.trim().slice(0, 110) });

// Campos que quase sempre vêm do banco (conteúdo do lojista/cliente)
const CAMPOS_DE_DADOS =
  /\b\w*\.(nome|nome_produto|descricao|titulo|observacao|identificador_cliente|razao_social|nome_opcao|endereco|bairro|cidade|logradouro|mensagem|conteudo|codigo|slug|apelido|nome_fantasia)\b/;

for (const arq of arquivos) {
  const txt = fs.readFileSync(arq, 'utf8');
  const linhas = txt.split(/\r?\n/);
  const usaTDynamic = /\btDynamic\s*\(/.test(txt);
  const usaT = /(?<![\w.])t\s*\(\s*['"]/.test(txt);

  // 1. usa tDynamic/t sem pegar do contexto
  if ((usaTDynamic || usaT) && !/useI18n\s*\(/.test(txt) && !/from ['"].*i18nData/.test(txt)) {
    add(arq, 0, 'HOOK AUSENTE', 'usa tDynamic/t mas não chama useI18n()');
  }

  linhas.forEach((l, i) => {
    const n = i + 1;

    // 2. tradução de dado do banco (nome de produto, título, endereço…)
    const mDados = l.match(/tDynamic\s*\(\s*([^)]*)\)/);
    if (mDados && CAMPOS_DE_DADOS.test(mDados[1])) {
      add(arq, n, 'TRADUZ DADO DO BANCO', l);
    }

    // 3. valor traduzido indo PARA o banco (grava em idioma do navegador)
    if (/tDynamic\s*\(/.test(l) &&
        /(insert|update|upsert|\.rpc\(|p_[a-z_]+\s*:|_id\s*:)/.test(l) &&
        !/^\s*(\/\/|\*)/.test(l)) {
      add(arq, n, 'TRADUZIDO GRAVA NO BANCO', l);
    }

    // 4. comparação com string traduzida — quebra a lógica em en-US
    if (/tDynamic\s*\([^)]*\)\s*(===|!==|==|!=)/.test(l) ||
        /(===|!==|==|!=)\s*tDynamic\s*\(/.test(l)) {
      add(arq, n, 'COMPARA COM TRADUZIDO', l);
    }

    // 5. switch/case ou includes sobre traduzido
    if (/\.(includes|startsWith|indexOf)\s*\(\s*tDynamic/.test(l)) {
      add(arq, n, 'BUSCA SOBRE TRADUZIDO', l);
    }

    // 6. tDynamic nas deps de hook: a identidade muda a cada render do provider
    if (/^\s*\}, \[.*\btDynamic\b.*\]\)/.test(l)) {
      add(arq, n, 'tDynamic EM DEPS DE HOOK', l);
    }

    // 7. tDynamic sobre número/data — o dicionário só entende string
    if (/tDynamic\s*\(\s*(String\(|Number\(|\w+\.(valor|preco|total|quantidade|numero)\b)/.test(l)) {
      add(arq, n, 'TRADUZ NUMERO/VALOR', l);
    }

    // 8. chave de tradução dentro de template literal (nunca casa no dicionário)
    if (/tDynamic\s*\(\s*`[^`]*\$\{/.test(l)) {
      add(arq, n, 'CHAVE DINAMICA (nunca casa)', l);
    }
  });
}

const porClasse = {};
for (const a of achados) (porClasse[a.classe] ??= []).push(a);

console.log(`\narquivos varridos: ${arquivos.length}\nachados: ${achados.length}\n`);
for (const [classe, itens] of Object.entries(porClasse).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`━━ ${classe} (${itens.length})`);
  for (const it of itens) console.log(`   ${it.arq}:${it.linha}\n     ${it.trecho}`);
  console.log();
}
if (!achados.length) console.log('nenhum problema encontrado nas 8 classes verificadas.');
