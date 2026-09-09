# MiseOn — Estoque, Nota Fiscal e Custo: diagnóstico medido e plano de execução

**Público**: engenheiro pleno que vai executar sem acompanhamento.
**Data da medição**: 09/09/2026, contra o banco de **produção** (`zzuxklwhaoisuuvndtfw`).
**Regra de leitura**: tudo aqui foi medido, não inferido. Cada afirmação traz como reproduzir.
Se você for reexecutar depois de semanas, **rode as consultas de novo** — este documento é uma
fotografia, não uma verdade permanente.

---

## 1. Por que este documento existe

A landing vende cinco promessas ([TabelaComparativaRealidade.tsx](../src/components/home/TabelaComparativaRealidade.tsx)).
Duas são o núcleo do produto:

> *"Cada venda baixa o estoque exato por Ficha Técnica pelo **custo PEPS**."*
> *"Atualização dinâmica de **CMV por lote**: o custo acompanha o valor pago na nota."*

**Veredito medido**: o motor que sustenta as duas **existe e funciona** (Seção 2). O elo
frágil não é a saída — é a **entrada**:

1. quando o insumo não tem lote, o custeio cai silenciosamente em **estimativa**
   (`RAISE WARNING`, sem bloquear): o CMV daquele item fica plausível e errado;
2. a leitura da nota — a origem de todo lote e todo custo — aceitava **inferência de IA como
   fato fiscal**, sem checar sequer se `qtd × unitário = total` (Seção 3);
3. a conversão de unidade entre o que se compra e o que se estoca não é explícita nem
   auditável, e há evidência de dano real por isso (Seção 2, "Batata congelada").

Ou seja: o custo sai certo **se** o dado entrou certo. Hoje nada garante a entrada.

---

## 2. O PEPS funciona — e por que quase concluí o contrário

⚠️ **Leia esta seção antes de propor qualquer refatoração de estoque.** A primeira versão
deste documento afirmava que "a venda não consome lote" e propunha um sprint para implementar
consumo PEPS. **Estava errado.** Registro o erro aqui porque a armadilha que me pegou vai
pegar você também.

### O que existe de fato

A cadeia real da baixa por venda:

```
fn_baixar_estoque
  └─ INSERT em movimentacoes_estoque (tipo BAIXA_VENDA, quantidade negativa)
       └─ TRIGGER trg_mov_custear_baixa → fn_mov_custear_baixa
            └─ fn_consumir_lotes_peps(insumo, qtd)   ← o PEPS mora aqui
```

`fn_consumir_lotes_peps` é bem implementada:
- ordena por `COALESCE(ocorrido_em, criado_em)`, desempatando por `vence_em NULLS LAST`
  (**o que vence antes sai antes**, e lote sem validade não fura a fila de quem está vencendo);
- `FOR UPDATE` nos lotes — protegida contra concorrência;
- decrementa `quantidade_restante` lote a lote, acumulando `qtd × custo_unitario`;
- quando falta lote, **estima** o custo (último unitário, ou `preco_embalagem/qtd_embalagem`)
  e emite `RAISE WARNING` sem bloquear a venda.

Do mesmo modo, a **entrada** cria lote via `trg_mov_criar_lote` → `fn_mov_criar_lote`.

**Portanto**: `fn_receber_compra`, `fn_movimentar_estoque` e as demais **não estão quebradas**
por não citarem `lotes_estoque` no corpo — elas delegam ao trigger da tabela de movimentações.

### A armadilha metodológica (não repita)

Consultar `position('lotes_estoque' in pg_get_functiondef(oid))` e concluir que a função "não
toca lote" **é inválido neste schema**. O efeito de uma operação de estoque está distribuído
em três camadas:

1. a RPC (escreve saldo + insere movimentação);
2. os **triggers** de `movimentacoes_estoque` (`trg_mov_criar_lote`, `trg_mov_custear_baixa`,
   `trg_lancar_custo_estoque`);
3. as funções que esses triggers **chamam** (`fn_consumir_lotes_peps`).

Antes de afirmar que algo não acontece, siga a cadeia inteira:

```sql
-- triggers de uma tabela e as funções que eles chamam
select t.tgname, p.proname from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where c.relname = 'movimentacoes_estoque' and not t.tgisinternal;
```

### O que continua verdadeiro: a divergência histórica

```sql
select count(*) from public.vw_divergencia_saldo_lotes;  -- 54
```

Distribuição (09/09/2026):

| Loja | Divergentes | Saldo sem lote nenhum | Saldo > lotes | Lotes > saldo |
|---|---|---|---|---|
| Lanche do Paulista (tenant de provas) | 54 | 26 | 25 | 3 |
| **"N" de NATUREBA (cliente real)** | **0** | — | — | — |

**O cliente pagante está limpo.** As 54 estão todas no tenant de provas.

Segundo a memória de projeto de 08/09 (medição independente, `54 de 92 insumos`), essa
divergência é **resíduo da era anterior ao Sprint 7**, cujas duas causas foram encontradas e
fechadas naquele sprint (commits `fadf71e` / `ab6b75d`):

1. o cadastro de insumo gravava `quantidade_atual` no INSERT **e** chamava
   `fn_movimentar_estoque` ENTRADA depois — dobrava (criar com 10 dava saldo 20 / lote 10);
2. `anon`/`authenticated` tinham escrita direta no ledger, nos lotes e no saldo.

**Não é fábrica ativa; é dívida de dado.** Mas ela se auto-perpetua: uma vez que o insumo tem
saldo sem lote, `fn_consumir_lotes_peps` cai no ramo de **estimativa** (`RAISE WARNING`, sem
bloquear) e toda venda seguinte daquele insumo custeia por chute em vez de PEPS real. O CMV
daquele item fica plausível e errado — o pior tipo de erro.

### Um caso que merece investigação própria (hipótese, **não** confirmada)

*"Batata congelada"*: `unidade_medida = 'porção'`, `quantidade_atual = 100`,
`saldo_lotes = 8050`.

A razão 8050/100 e a unidade "porção" sugerem **erro de conversão de unidade** na entrada
(comprou em grama/quilo, o lote entrou na unidade da nota e o saldo está em "porção") — ou
seja, Regra 12 do mandato (unidade de compra ≠ unidade de estoque) sem fator determinístico.
**Isso é hipótese**: para confirmar, rastreie as movimentações desse insumo:

```sql
select m.tipo, m.quantidade, m.custo_total, m.motivo, m.criado_em
from movimentacoes_estoque m
where m.insumo_id = 'f75338fd-e078-4af8-b664-5ec8f3ad8c72' order by m.criado_em;
```

Se confirmado, o problema é de **conversão na entrada da nota** — e conecta direto com a
Seção 3 (leitura de nota), não com o PEPS.

### O que **não** é a causa (verificado e descartado)

- **Não é o seed.** `fn_semear_loja` e ambas as migrations de seed
  (`20260903100000`, `20260903110000`) inserem insumo com `quantidade_atual = 0`.
  Saldo zero e lote zero batem. *(Descartado depois de eu ter afirmado o contrário por leitura
  apressada — a presença da coluna no INSERT não significa saldo positivo.)*
- **Não é falta de PEPS.** Ver Seção 2: `fn_consumir_lotes_peps` existe e consome lote
  corretamente. *(Também afirmei o contrário antes de seguir a cadeia de triggers.)*

---

## 3. Achado: a leitura da nota aceita inferência de IA como fato fiscal

Rotas de entrada de nota hoje:

| Rota | Arquivo | Fonte | Avaliação |
|---|---|---|---|
| XML NFe 55 | [`src/lib/parseNFeXml.ts`](../src/lib/parseNFeXml.ts) | documento estruturado | **correto** |
| QR Code (SEFAZ) | [`supabase/functions/nfe-importar-qrcode/parser.ts`](../supabase/functions/nfe-importar-qrcode/parser.ts) | HTML do portal | frágil |
| Foto do cupom | [`supabase/functions/nfe-ocr-cupom/index.ts`](../supabase/functions/nfe-ocr-cupom/index.ts) | **IA (Gemini)** | era o buraco |

### 3.1 XML está certo — não mexa

`parseNFeXml.ts` lê `qCom`→qtd, `uCom`→unidade, `vUnCom`→unitário, `vProd`→total, e ainda
extrai `NCM` e valida `cEAN`. É exatamente a Regra 6 do mandato. **Este é o padrão-ouro; as
outras rotas devem convergir para o formato que ele produz.**

### 3.2 OCR aceitava qualquer coisa que a IA devolvesse

Antes da correção desta sessão, a única validação era:

```ts
.filter((i) => i?.descricao?.trim() && Number.isFinite(i.qtd))
```

Nenhuma checagem de coerência. Se a IA trocasse quantidade por valor — o sintoma relatado
pelo PO ("coloca peso no lugar do preço") — o dado entrava no estoque em silêncio. Isso viola
as Regras 7 e 9: inferência de IA gravada como fato fiscal.

**Corrigido nesta sessão** (`conferirAritmetica`): a nota é aritmética, `qtd × unitário = total`.
Quando não fecha (tolerância `max(R$0,02, 0,5%)`, que cobre arredondamento de item por peso),
o item volta com `conferencia: { coerente: false, motivo, total_esperado }`.
**Deliberadamente não corrige sozinho** — inventar valor fiscal plausível é pior que admitir a
falha, porque o erro entra silencioso e contamina custo → PEPS → CMV → margem → preço.

⚠️ **Não validado em execução**: Deno não está instalado na máquina de desenvolvimento; a
função só será verificada no deploy/CI. O consumo do campo `conferencia` no frontend
(`ModalImportarNFCe.tsx`) **ainda não foi implementado** — ver Sprint B.

### 3.3 QR Code descarta item em silêncio

`parseItens` usa um regex único que exige **todos** os campos, na ordem, com no máximo 40
caracteres de distância entre eles:

```
descrição → (Código: N) → Qtde.: → UN: → Vl. Unit.: → Vl. Total
```

Se o portal mudar o rótulo, inserir uma coluna, ou o item não tiver código, a linha **não casa
e some sem aviso**. É a "omissão de informação" relatada. Não há contagem de itens esperados
vs. lidos para detectar a perda.

---

## 4. Sprints

Ordem por risco × valor, **com o PEPS já funcionando** (Seção 2). A dor declarada do PO é a
leitura da nota — e é também onde o dado errado nasce e contamina tudo depois.

---

### SPRINT A — A nota não grava o que não confere

**Objetivo**: nenhuma leitura de nota (IA, QR ou XML) grava valor que não fecha na conta, e
nenhum item some em silêncio. Metade backend já foi feita; falta fechar o ciclo.

**Já entregue nesta sessão**: `conferirAritmetica` em
[`nfe-ocr-cupom/index.ts`](../supabase/functions/nfe-ocr-cupom/index.ts) — marca o item com
`conferencia: { coerente, motivo, total_esperado }` quando `qtd × unitário ≠ total`
(tolerância `max(R$0,02, 0,5%)`, que cobre arredondamento de item por peso). **Não corrige
sozinho**, por decisão: inventar valor fiscal plausível é pior que admitir a falha.
⚠️ Não validado em execução (sem Deno local) — validar no deploy.

**Escopo restante**
- `ModalImportarNFCe.tsx` consome `conferencia`: destaca o item incoerente com o valor
  esperado ao lado do lido e **exige confirmação explícita** antes de importar.
- Aplicar a mesma checagem ao parser de QR e ao XML. O XML serve de controle: se a conta
  falhar num XML, o bug é nosso, não da fonte.
- QR Code: comparar itens lidos com o "Qtd. total de itens" que a página traz e **avisar**
  quando divergir, em vez de devolver lista truncada em silêncio
  ([`parser.ts`](../supabase/functions/nfe-importar-qrcode/parser.ts), regex único que exige
  todos os campos na ordem — se o portal mudar um rótulo, o item some).

**Critérios de aceitação**
1. Item com `qtd × unitário ≠ total` não entra no estoque sem confirmação humana.
2. Cupom com item ilegível informa **quantos** itens foram perdidos.
3. Nenhuma rota corrige valor fiscal automaticamente.

**Testes** (Regra 23): item por peso (1,022 kg × 6,99 = 7,14 → tem de passar);
troca qtd↔total (20/18,90/378 lido como 378/18,90/378 → tem de **reprovar**); item sem
unitário; cupom com desconto no rodapé.

---

### SPRINT B — Conversão de unidade explícita e auditável

**Objetivo**: eliminar a ambiguidade entre unidade fiscal, de compra, de estoque e de consumo
(Regras 8 e 12). É a hipótese mais provável para o caso *"Batata congelada"* (saldo 100
"porção" × lote 8050).

**Escopo**
- Registrar no insumo o **fator de conversão** entre unidade de compra e unidade de estoque,
  com origem (`XML`, `REGRA`, `CATÁLOGO`, `USUÁRIO`) — Regra 9.
- Na importação, quando `uCom` da nota ≠ unidade de estoque do insumo e **não existe fator**,
  **pedir confirmação** em vez de assumir 1:1 (que é o que produz lote 8050 contra saldo 100).
- Expor a conversão aplicada na tela de conferência: "10 CX × 12 = 120 UN".

**Pré-investigação obrigatória** (30 min): rodar o rastreamento de movimentações da Batata
congelada (query na Seção 2) e confirmar se a causa é conversão. Se não for, **reescreva este
sprint** antes de executá-lo.

---

### SPRINT C — Reconciliar as divergências históricas

**Objetivo**: zerar as 54 divergências do tenant de provas.

**Escopo**: `fn_reconciliar_estoque` (que já acerta saldo **e** lotes) aplicada em lote sobre
`vw_divergencia_saldo_lotes`, com relatório antes/depois.

**Por que não é urgente**: está confinado ao tenant de provas e as causas foram fechadas no
Sprint 7. **Por que não é ignorável**: enquanto o insumo tem saldo sem lote,
`fn_consumir_lotes_peps` custeia por **estimativa** (`RAISE WARNING`) — o CMV daquele item
fica plausível e errado.

**Pré-condição**: Sprint B, se a investigação confirmar que a conversão de unidade é a fonte —
reconciliar antes de fechar a fonte é enxugar gelo.

---

### SPRINT D — Derivar o saldo do ledger (dívida arquitetural registrada)

**Objetivo**: `insumos.quantidade_atual` é descrito no schema como "cache do ledger", mas
**nada o deriva** — as RPCs o atualizam à mão. Duas fontes para a mesma verdade (Regra 4).

**Escopo**: derivar o saldo por gatilho a partir de `movimentacoes_estoque` **e remover, no
mesmo movimento, a atualização manual das funções** — senão a contagem dobra (foi exatamente
a "fábrica de divergência" fechada no Sprint 7).

**Risco**: alto, mexe em tudo que move estoque. Uma função por vez, cada uma com sua migration
e teste de comportamento antes. **Não é hotfix.**

---

## 5. Backlog (registrado, fora dos sprints acima)

| # | Item | Origem | Nota |
|---|---|---|---|
| 1 | **KDS: fluxo por operador** | PO, 09/09 | Cada operador ver só as etapas que executa, em vez do board único. Mapear antes se `kds_workflows.etapas` comporta responsável por etapa. Mudança de UX + possivelmente schema. |
| 2 | **"Ponto da carne" é modificador, não etapa** | Regra 16 + visto em produção | Hoje é texto livre em `observacao` ([PedidoMesaDrawer.tsx:97](../src/components/PedidoMesaDrawer.tsx)) **e** virou uma etapa de workflow no KDS de uma loja. Modelar modificador estruturado por item. |
| 3 | **Display/TV com pairing, não token digitado** | PO, 09/09 + Regra 18 | Hoje o usuário digita token no navegador da TV. Evoluir para DISPLAY DEVICE + DISPLAY SESSION (código/QR curto, reconexão). Avaliar Cast/Presentation API. |
| 4 | **Cartão rodando na conta PF** | Sessão 09/09 | Temporário até a Efí liberar o limite operacional da PJ. Ver `MISEON_HEAD_OF_ENGINEERING.md` §20-J. **Dinheiro cai no CPF, não no CNPJ.** |
| 5 | **PDV sem TEF** | Sessão 09/09 | Crédito/Débito no balcão são registro manual (`pagoAgora = met !== 'PIX'`). Decisão de produto: integrar TEF ou deixar explícito na UI. |
| 6 | **Rodízio não existe** | Investigação 09/09 | Zero suporte (sem preço por pessoa, sem comensais). **A landing não vende rodízio** — por isso não virou sprint. Se entrar no discurso comercial, vira prioridade. |
| 7 | **Produto composto (combinado de sushi)** | Investigação 09/09 | Só existem `grupos_opcoes` (adicional com preço). Não há como modelar "combinado 20 peças = 8 niguiri + 6 uramaki". Landing menciona sushi 1×. |
| 8 | **Conversão de unidade auditável** | Regra 12 | Diferenciar unidade fiscal / compra / estoque / consumo com fator determinístico e rastreável (`CX 12 → 12 UN`). Hoje a conversão não é explícita. |

---

## 6. Como verificar o estado atual em 30 segundos

```sql
-- 1. A cadeia do PEPS está intacta? (as três peças têm de existir)
select
  (select count(*) from pg_proc where proname='fn_consumir_lotes_peps')             as peps,
  (select count(*) from pg_trigger where tgname='trg_mov_custear_baixa')            as trg_baixa,
  (select count(*) from pg_trigger where tgname='trg_mov_criar_lote')               as trg_entrada;
-- esperado: 1, 1, 1

-- 2. Quanta divergência existe agora, e onde?
select l.nome, count(*) from public.vw_divergencia_saldo_lotes v
join public.lojas l on l.id = v.loja_id group by l.nome order by 2 desc;

-- 3. O cliente real está contaminado?
select count(*) from public.vw_divergencia_saldo_lotes v
join public.lojas l on l.id = v.loja_id where l.slug = 'natureba';
```

Se (1) não devolver `1,1,1`, a cadeia do custo foi quebrada por alguma migration posterior —
**pare e investigue antes de qualquer outra coisa**, porque todo número de custo, margem e CMV
exibido no produto passa por ali.

Se (3) deixar de ser `0`, o cliente real começou a acumular custo estimado em vez de PEPS.

---

## 7. Registro de erro desta investigação (leia antes de confiar em qualquer diagnóstico)

Durante a produção deste documento eu afirmei, com convicção e evidência aparente, **três
causas raízes que eram falsas**:

1. "o seed cria estoque sem lote" — era `quantidade_atual = 0`;
2. "6 de 8 funções de estoque não tocam lote" — elas delegam a triggers;
3. "a venda não consome lote / PEPS não existe" — existe em `fn_consumir_lotes_peps`.

As três vieram do mesmo atalho: **medir a presença de uma string no corpo de uma função e
concluir comportamento**. Nesse schema o comportamento está distribuído entre RPC, trigger e
função chamada pelo trigger. O que me corrigiu foi a memória de projeto de 08/09 mencionar um
trigger que minha medição não via.

**Regra prática para quem continuar**: antes de afirmar que o sistema *não faz* algo, siga a
cadeia — `pg_trigger` da tabela envolvida e as funções chamadas pelas funções. Uma afirmação
negativa sobre comportamento exige rastrear a cadeia inteira, não ler um corpo de função.
