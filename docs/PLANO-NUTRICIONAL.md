# MiseOn — Módulo Nutricional: da Ficha Técnica ao Selo de Transparência

**Papel deste doc:** plano de execução para o squad (humanos + agentes). Visão de CTO/PO:
o dado nutricional **não é digitado, é derivado** — a ficha técnica já existe, o motor de
conversão de unidades já existe, e a IA entra como *copiloto de captura*, nunca como fonte
de verdade publicada.
**Owner:** Rafael (PO/CTO) · **Tenants:** Lanche do Paulista (provas) · Natureba (demo — não mexer sem autorização)
**Status:** 🟢 Sprint 0 CONCLUÍDA (2026-07-29) · ADRs aprovadas pelo PO · próxima: Sprint 1 (motor de cálculo)
**Épico:** `EP-NUT` · **Esforço estimado:** 123 SP · **Janela:** Sprint 0 + 6 sprints de 1 semana

---

## 1. Objetivo e promessa

**Objetivo de negócio:** transformar a ficha técnica — que o lojista já preenche por causa do
CMV — em informação nutricional publicável e **auditável por terceiros**, e usar isso como
ativo comercial: SEO, conversão, público restritivo, marmitaria embalada, licitação e
alimentação corporativa.

**Promessa (honesta, defensável, ver §3):**
> "Você já cadastra a ficha técnica para saber seu custo. O MiseOn usa a mesma ficha para
> calcular a informação nutricional de cada prato, a partir de bases científicas oficiais,
> e publica no seu cardápio com um selo que **qualquer pessoa pode auditar** — método, fontes
> e data, numa página pública. Você revisa e aprova; nada vai ao ar sem seu aval."

**O que NÃO vamos prometer:**
- Laudo laboratorial. Só análise físico-química dá isso.
- Que a IA declara "não contém" alérgeno (ADR-03 — regra inegociável).
- Precisão ±5%. A promessa é **estimativa calculada a partir da receita declarada**.

**Métrica-norte:** `% de produtos ativos com status COMPLETO`. Meta: **≥ 70% em até 30 min de
trabalho do lojista** numa despensa de ~150 insumos. Se levar 4 horas, o módulo falhou por
mais correto que o número esteja.

---

## 2. Por que isso é barato aqui (e caro em qualquer concorrente)

O MiseOn já tem, em produção, as peças que tornam isso um recálculo e não um produto novo:

| Peça existente | Arquivo | O que já resolve para nutrição |
|---|---|---|
| Registro canônico de unidades e grandezas | [unidades.ts](src/lib/unidades.ts) | `g/kg/ml/L` com fator imutável, e a distinção entre grandeza física e agrupador semântico (`un`, `fatia`, `porção`) — exatamente a fronteira onde cálculo nutricional erra |
| Grafo de conversão por item (BFS) | [custeio.ts](src/lib/custeio.ts) | "quanto de X há neste prato" já é resolvido para custo; nutriente percorre **o mesmo caminho** |
| Ficha técnica + preparos recursivos | `fichas_tecnicas`, `fichas_preparos` | O molho é insumo composto; a recursão já é modelada e usada no custeio |
| Módulo de Compras com nota do fornecedor | `compras`, `compras_itens` | Porta de entrada do **EAN** — ver §5.1, caminho de captura zero-esforço |

**Insight central:**
> Nutrição é propriedade do **insumo**, nunca do produto.
> A tabela do prato é **projeção derivada e cacheada** da ficha técnica.
> Ninguém edita a tabela do prato; edita-se a receita ou o insumo.

---

## 3. Base regulatória — o que a pesquisa mudou no plano

Três achados alteram decisões de arquitetura. Estão aqui porque o squad precisa entender
*por que* o sistema é assim, não só *como*.

### 3.1 O cálculo por tabela de composição é método aceito pela ANVISA ✅

A orientação oficial da ANVISA para obter a informação nutricional é consultar **"uma Tabela de
Composição Química de Alimentos, um Banco de Dados de Alimentos ou o laudo de análise
físico-química"**. As três vias são válidas — laudo não é obrigatório. As tabelas citadas
nominalmente incluem a brasileira (Nepa/Unicamp) e a do **U.S. Department of Agriculture**.

**Consequência para o produto:** o que o MiseOn faz é um método reconhecido, não um atalho.
Isso sustenta o selo.

### 3.2 A fonte usada pode ser exigida pela fiscalização 🎯

A ANVISA é explícita: a fonte da tabela **não precisa constar no rótulo, mas pode ser
solicitada pelo órgão de vigilância sanitária**.

**Consequência (esta é a grande):** rastreabilidade deixa de ser capricho de engenharia e vira
**funcionalidade de conformidade**. Todo valor gravado carrega `origem`, `fonte`, `versão da
base` e `data`. Na hora da fiscalização, o lojista exporta o dossiê em um clique. Nenhum
concorrente de cardápio digital tem isso, porque nenhum guardou a proveniência.
É o que transforma o selo de adesivo em documento.

### 3.3 Restaurante é isento; marmitaria embalada NÃO é ⚠️

A RDC 429/2020 alcança **alimentos embalados na ausência do consumidor**. Comida preparada e
embalada no ponto de venda a pedido do cliente está fora do escopo.

**Consequência dupla:**
- Para o restaurante/delivery clássico, a tabela é **voluntária** — logo é *diferencial*, e
  diferencial é o que se vende. Ninguém compra obrigação com entusiasmo; compra vantagem.
- Para **marmitaria, congelados, dark kitchen que vende em freezer, e produção para revenda**,
  a rotulagem é **obrigatória** — e hoje esse lojista paga consultoria avulsa por rótulo.
  Esse é o segmento que paga o módulo premium sem pestanejar. O MiseOn já tem `DARK_KITCHEN`
  e `RESTAURANTE_POR_QUILO` em [types.ts:105](src/types.ts:105).

### 3.4 Quem assina — e por que o selo tem 3 níveis

A Resolução **CFN nº 600/2018** coloca a elaboração de rotulagem nutricional de preparações
entre as atribuições do nutricionista, e restaurantes comerciais já precisam de Responsável
Técnico quando exercem atividade privativa da profissão.

**Consequência de design:** o MiseOn **não emite parecer nutricional** — emite *cálculo com
método aberto e proveniência auditável*, exatamente como fazem os softwares que nutricionistas
já usam. A assinatura profissional é um **nível superior do selo**, opcional e monetizável
(§8), não um pré-requisito para o módulo existir.

> **Isso destrava o plano sem contratar ninguém agora.** Níveis 1 e 2 do selo são
> autodeclaração do estabelecimento com método publicado e verificável. Nível 3 exige CRN, e
> vira produto quando você quiser — inclusive como marketplace.

---

## 4. O Selo MiseOn de Transparência Nutricional

O que faz um selo valer alguma coisa não é o desenho — é **poder ser auditado por quem
desconfia**. Um selo que ninguém consegue verificar é adesivo de vitrine. Portanto:

### 4.1 Os três níveis

| Nível | Nome | Critério objetivo (verificado pelo sistema, não pelo humano) |
|---|---|---|
| **1** | **Declarado** | Ficha técnica completa em ≥ 90% dos pratos ativos · cobertura ≥ 80% da massa em cada prato publicado · 100% dos valores com fonte rastreável · disclaimer visível |
| **2** | **Rastreado** | Tudo do nível 1 · **≥ 70% da massa** vem de rótulo do fabricante ou base científica (não de estimativa por IA) · alérgenos declarados em 100% dos pratos · nenhum insumo com `confianca < 0,7` publicado |
| **3** | **Auditado** | Tudo do nível 2 · **nutricionista com CRN ativo** revisou e assinou dentro da plataforma · assinatura registrada com nome, CRN, data e **hash da versão auditada** · revalidação a cada 12 meses ou a cada mudança de ficha |

### 4.2 As três regras que dão integridade ao selo

1. **É calculado, nunca concedido.** Nenhum humano do MiseOn "aprova" um selo. O nível é
   função pura do estado do dado, recalculado a cada mudança.
2. **É revogável automaticamente.** Cadastrou prato novo sem ficha? O nível cai na hora e o
   lojista é avisado com o que fazer para recuperar. Selo que só sobe é propaganda; selo que
   desce é garantia. *(E, não por acaso, é o melhor loop de retenção do produto.)*
3. **É público e auditável.** Cada selo tem uma **página de verificação** em
   `miseon.com.br/selo/{slug-da-loja}` — aberta, sem login, com QR code para colar na porta
   e no cardápio impresso.

### 4.3 O que a página pública de verificação mostra

Esta página é o produto. Ela contém:

- Nível atual, data da última verificação e **histórico de mudanças de nível**
- Cobertura: quantos pratos publicados, qual o % de massa com dado rastreado
- **Composição das fontes**: "62% rótulo do fabricante · 31% base científica USDA/TBCA · 7% estimado"
- **Metodologia aberta** — a mesma explicação para todos, em linguagem que um fiscal e uma mãe
  de criança alérgica entendem
- Se nível 3: nome do profissional, CRN e data da assinatura
- Disclaimer e o que o selo **não** significa (honestidade explícita é o que o torna crível)

> **Por que isso eleva de verdade o estabelecimento:** ele deixa de dizer "nossa comida é
> saudável" — frase que todo mundo diz e ninguém prova — e passa a exibir um endereço onde
> qualquer pessoa confere o método. Em licitação, PNAE, convênio corporativo e auditoria de
> franquia, isso é a diferença entre ser considerado e ser descartado.

---

## 5. Fontes de dados — licenciamento resolvido

Pesquisa concluída. **Nenhuma dependência bloqueia o início.**

| Fonte | Cobertura | Licença | Decisão |
|---|---|---|---|
| **USDA FoodData Central** | ~300 mil alimentos, alta qualidade analítica | **CC0 / domínio público**, uso comercial livre, API gratuita com chave (1.000 req/h). USDA só *pede* atribuição | ✅ **Base do v1.** Embarcar subconjunto de in natura + commodities. Creditar sempre |
| **Open Food Facts** | 3M+ produtos industrializados **por código de barras**, com alérgenos | **ODbL** — comercial permitido, com atribuição e *share-alike* sobre a base | ✅ **Consulta por EAN no cadastro** (§5.1). Ver R-05 sobre o limite de redistribuição |
| **TBCA (USP/FoRC)** | 5.700 alimentos + 4.000 **preparações brasileiras** — a melhor base para comida daqui | Consulta livre; **licença paga** para usar a base em outra ferramenta | 🟡 **Upgrade pago.** Orçar após o v1. É o salto de qualidade para o mercado brasileiro |
| **TACO (Nepa/Unicamp)** | 597 alimentos | Obra registrada sob a Lei 9.610/98; reprodução exige autorização | ⛔ **Não embarcar** sem autorização escrita. Citada pela ANVISA como referência, mas isso não licencia redistribuição |
| **Rótulo do fabricante** | O que o lojista realmente compra | Dado factual do produto que ele possui | ✅ **A melhor fonte de todas** — e a mais fácil de capturar (§5.1) |

### 5.1 Os quatro caminhos de captura, do melhor ao pior

Esta é a espinha dorsal da UX. Cada insumo entra pelo caminho mais alto disponível:

```
①  EAN da nota de compra  ──►  Open Food Facts  ──►  dado do rótulo, ZERO clique
    (o XML da NF-e do fornecedor traz o GTIN de cada item)
    ↓ não achou

②  Foto da embalagem  ──►  Gemini Vision  ──►  dado do rótulo, UM clique
    (o lojista fotografa a tabela nutricional; a IA lê. 5 segundos.)
    ↓ não tem embalagem (in natura: carne, tomate, farinha a granel)

③  Match em base científica  ──►  trigram + Gemini desambigua  ──►  revisão em 1 toque
    ↓ nada bate

④  Estimativa livre  ──►  confiança baixa, marcado em amarelo, nunca conta para o nível 2
```

**O caminho ① é a jogada de mestre desta arquitetura.** O plano de produto já prevê "Importar
XML da NF-e de compra" ([PLANO-PRODUTO §4.3](docs/PLANO-PRODUTO.md)). Aquele XML carrega o
`cEAN` de cada item. Adicionar `insumos.gtin` serve às **duas** features: pré-preenche a
conferência de recebimento *e* busca a tabela nutricional do fabricante. O lojista recebe a
mercadoria e a nutrição chega junto, sem saber que trabalhou.

**O caminho ② é o que salva a UX.** Fotografar um rótulo custa 5 segundos e entrega dado do
fabricante — qualidade de nível 2 do selo, sem digitação e sem IA adivinhando.

---

## 6. Arquitetura

### 6.1 Fluxo de ponta a ponta

```
┌──────────────────────────────────────────────────────────────────────┐
│  CAPTURA (uma vez por insumo — §5.1)                                 │
│  ① EAN/NF-e   ② foto do rótulo   ③ base científica   ④ estimativa   │
│                            │                                          │
│                            ▼                                          │
│                   HUMANO revisa em lote                               │
│                   (aprovar/corrigir — teclado, 1 tecla por item)     │
│                            │                                          │
│                            ▼                                          │
│              insumos_nutricao  ← origem, fonte, versão, confiança    │
└──────────────────────────────────────────────────────────────────────┘
                             │ trigger
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CÁLCULO (determinístico, plpgsql, zero IA)                          │
│  ficha ─┬─ insumo simples ──► nutriente × qtd normalizada            │
│         └─ preparo ──(recursão)──► ÷ rendimento                      │
│                    × fator de cocção  ÷ porções                       │
│                             ▼                                         │
│              produtos_nutricao_cache  +  nível do selo                │
└──────────────────────────────────────────────────────────────────────┘
                             │  leitura anon (cache, sem recursão em runtime)
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   VITRINE               PÁGINA DO SELO       PDV / KDS
   card + modal          pública, QR, SEO     alerta de alérgeno
   JSON-LD schema.org    dossiê p/ fiscal     para o atendente
```

### 6.2 Modelo de dados

```sql
-- ── Plataforma (sem loja_id; leitura pública, escrita só service_role) ──
nutrientes                 codigo pk, rotulo, unidade, ordem, obrigatorio_anvisa, vd_referencia
alimentos_referencia       id pk, fonte, codigo_fonte, nome, nome_normalizado, grupo,
                           base_unidade, densidade_g_ml, nutrientes jsonb, alergenos_contem[],
                           versao_base, licenca            -- GIN trigram em nome_normalizado

-- ── Por loja ──
insumos_nutricao           insumo_id pk, loja_id, base_qtd, base_unidade, nutrientes jsonb,
                           alergenos_contem[], alergenos_pode_conter[],
                           densidade_g_ml, peso_medio_un_g,          -- pontes p/ não-massa
                           origem ('ROTULO_EAN'|'ROTULO_FOTO'|'USDA'|'TBCA'|'IA'|'MANUAL'),
                           fonte_ref, fonte_versao, fonte_url,       -- §3.2 rastreabilidade
                           confianca, revisado, revisado_por, revisado_em,
                           ia_modelo, ia_justificativa, ia_payload jsonb, atualizado_em
insumos += gtin            -- serve também ao import de XML da NF-e

produtos_nutricao_config   produto_id pk, exibir, porcoes, peso_porcao_g,
                           fator_coccao, metodo_coccao, override_nutrientes jsonb, observacao
produtos_nutricao_cache    produto_id pk, loja_id, por_porcao jsonb, por_100g jsonb,
                           peso_liquido_g, alergenos_contem[], alergenos_pode_conter[],
                           cobertura_pct, pct_massa_rastreada, status, insumos_faltantes jsonb,
                           calculado_em, versao_calculo
lojas_selo_nutricional     loja_id pk, nivel (0..3), calculado_em, metricas jsonb,
                           hash_versao, assinatura_crn, assinado_por, assinado_em, valido_ate
lojas_selo_historico       append-only: toda mudança de nível, com motivo

lojas += nutricao_ativo, nutricao_exibicao, nutricao_base, nutricao_disclaimer,
         nutricao_cobertura_minima (default 0.80), selo_publico (default true)
ModulosAtivos += nutricional?: boolean     -- src/types.ts:111
```

### 6.3 Superfícies novas

| Superfície | Caminho | Sprint |
|---|---|---|
| Cálculo canônico | `fn_recalcular_nutricao_produto(uuid)` | S1 |
| Preview sem salvar | `fn_simular_nutricao(jsonb)` | S1 |
| Nível do selo | `fn_recalcular_selo_loja(uuid)` + trigger | S4 |
| Lookup por EAN | `supabase/functions/nutricao-ean/` | S2 |
| OCR de rótulo | `supabase/functions/nutricao-ocr-rotulo/` | S2 |
| Copiloto de match | `supabase/functions/nutricao-sugerir/` | S3 |
| Varredura em lote | `supabase/functions/nutricao-varrer-despensa/` | S3 |
| Página pública do selo | `src/pages/Selo.tsx` + prerender | S5 |
| Dossiê p/ fiscalização | `supabase/functions/nutricao-dossie/` (PDF) | S6 |

---

## 7. Decisões de arquitetura (ADRs)

### ADR-01 — Cálculo canônico em plpgsql, não em TypeScript
O cardápio público é lido por `anon` e precisa ser rápido; a recursão de preparos já vive no
banco no custeio (`fn_transformar_estoque`, `fn_receber_compra`). O cálculo canônico é
`fn_recalcular_nutricao_produto` com CTE recursiva; o preview ao vivo no editor de ficha chama
`fn_simular_nutricao(jsonb)` com a receita ainda não salva — **uma implementação só**, sem
gêmeo em TS que diverge. Custo: testes vão para `__tests__/integration/` executando a RPC
contra o banco, não para Vitest puro.

### ADR-02 — IA captura, humano publica
Nenhuma linha com `revisado = false` entra no cache publicável. `origem`, `fonte`, `confianca`,
`ia_modelo` e `ia_justificativa` ficam gravados para auditoria. A etapa de revisão é obrigatória
— é o que torna a promessa defensável. A missão da UX é fazê-la custar **segundos**, não minutos.

### ADR-03 — A IA nunca emite negativa de alérgeno 🔒
Afirmar "não contém glúten" é afirmação analítica, não inferência. O domínio tem três estados:
`CONTÉM`, `PODE_CONTER`, `NAO_AVALIADO`. **`NAO_CONTEM` não existe como saída de IA** — o
`responseSchema` do Gemini nem permite representá-lo, e a Edge Function rejeita e loga qualquer
tentativa. O lojista pode declarar ausência manualmente, e ao fazê-lo assume a declaração num
aceite explícito gravado com `user_id`, timestamp e texto da declaração. A vitrine nunca
renderiza ausência como garantia. **Não negociável.**

### ADR-04 — Gemini como motor único de IA, em três papéis
Você já tem a chave. Decisão: **criar uma chave nova e exclusiva** para este módulo, para
isolar quota e custo.

| Papel | Modelo | Por quê |
|---|---|---|
| **OCR de rótulo** (§5.1 ②) | Gemini Flash-Lite + `responseSchema` | Multimodal com saída estruturada; extração de rótulo custa fração de centavo por imagem |
| **Match/desambiguação** (③) | Gemini Flash-Lite | Alto volume, erro barato e visível na revisão |
| **Estimativa livre + alérgeno** (④) | Gemini Flash | Erro caro; escalar para Pro se a taxa de aceite ficar < 80% |

Regras não negociáveis: **toda** chamada usa `responseSchema` (nunca parsing de texto livre);
**toda** resposta passa por validação de domínio antes de tocar o banco; `temperature: 0` em
extração. Custo estimado de onboarding por loja (~150 insumos): **< R$ 1,00**.
Custo em runtime da vitrine: **zero** — o cardápio lê cache, nunca chama IA.

### ADR-05 — Cobertura mínima trava a publicação
`cobertura_pct` = fração da massa da ficha coberta por insumo com nutrição revisada. Abaixo de
`nutricao_cobertura_minima` (default 80%), status `PARCIAL` e a vitrine **não publica número** —
mostra só os alérgenos conhecidos. O admin mostra exatamente quais insumos faltam, com
deep-link. Menos pratos no dia 1, zero número mentiroso.

### ADR-06 — Proveniência é imutável e obrigatória
Todo valor em `insumos_nutricao` carrega origem, fonte, versão da base, URL e data. Correção
não sobrescreve histórico: gera nova versão. Isso atende §3.2 (a vigilância pode exigir a
fonte), sustenta o nível 2 do selo e permite recalcular tudo quando uma base for atualizada.

---

## 8. UX — o padrão de qualidade deste épico

> **Princípio único que resolve 90% das decisões:** o lojista nunca deve *sentir* que está
> cadastrando informação nutricional. Ele está recebendo mercadoria, fotografando uma
> embalagem, ou confirmando um palpite bom. O trabalho nutricional acontece como efeito
> colateral do trabalho que ele já faz.

### 8.1 Os cinco compromissos

1. **Zero digitação de número.** Nenhum fluxo primário pede que o lojista digite "23,4 g de
   proteína". Ele fotografa, confirma ou corrige. Digitar existe só como via de escape.
2. **Revisão a uma tecla.** A fila de revisão é operável só pelo teclado: `Enter` aprova,
   `E` edita, `↓` pula. 150 insumos em 10 minutos. Cada item mostra a evidência (foto do
   rótulo recortada, ou o alimento de referência com nome e fonte) — o lojista decide olhando,
   não lendo.
3. **A lacuna é sempre uma tarefa, nunca um erro.** Nunca "dados insuficientes". Sempre
   *"faltam 3 insumos para publicar a Lasanha — tomate pelado, muçarela, manjericão"*, com o
   nome clicável indo direto ao campo. Estado vazio que ensina, no padrão da tela de Equipe.
4. **375px é o alvo, não a adaptação.** O dono opera do celular, e a foto do rótulo é
   inerentemente mobile. A tela de captura é desenhada primeiro para o telefone com a câmera
   aberta; o desktop é que se adapta.
5. **Honestidade visível é feature.** Confiança baixa aparece em amarelo com a palavra
   "estimado", não escondida. O cliente final vê o disclaimer sem precisar procurar. Um número
   que se apresenta como mais certo do que é destrói o selo inteiro no primeiro
   questionamento.

### 8.2 Os três momentos que precisam ser impecáveis

**Momento 1 — a primeira vez (o "uau").**
O lojista liga o módulo e vê: *"Encontramos 47 dos seus 150 insumos automaticamente pelas notas
de compra. Quer que eu tente o resto?"* — progresso antes do primeiro clique. A varredura roda
em background com progresso real, e ele pode sair da tela. Ao voltar: fila pronta.

**Momento 2 — a revisão (onde o módulo morre se for chato).**
Cards grandes, um por vez, evidência à esquerda e valores à direita. Barra de progresso que
mostra **o que muda quando terminar**: *"faltam 12 — ao concluir, 23 pratos ficam publicáveis e
seu selo sobe para Rastreado."* O motivo aparece antes do esforço, sempre.

**Momento 3 — o cliente final no cardápio.**
Tabela em `<table>` semântica (leitor de tela lê corretamente — isso importa exatamente para o
público que mais precisa da informação). Ordem oficial de rótulo. Alérgenos **acima** dos
macros, em destaque, com ícone e texto — nunca só cor, por daltonismo. Alternância
porção/100 g. Disclaimer junto, não em rodapé escondido. Peso visual do selo proporcional ao
nível: nível 1 é discreto, nível 3 é orgulhoso.

### 8.3 O que está proibido nesta feature

- Spinner sem estimativa de tempo em varredura de despensa.
- Toast de erro genérico. Erro de nutrição sempre diz **qual insumo** e **o que fazer**.
- Número publicado sem fonte rastreável — em qualquer superfície, inclusive impressão.
- Cor como único portador de significado (alérgeno, confiança, nível do selo).
- Modal que não fecha no `Esc` ou que perde o trabalho ao fechar.

---

## 9. Backlog do épico

Legenda: SP em Fibonacci. Capacidade assumida **21 SP/sprint**.

### Sprint 0 — Fundação de dados · 13 SP · 3 dias · ✅ CONCLUÍDA 2026-07-29
| ID | História | SP | Status |
|---|---|---|---|
| NUT-01 | Catálogo `nutrientes` na ordem oficial de rótulo, com VDR | 2 | ✅ Migração aplicada — 12 nutrientes, ordem/indentação/VDR do Anexo II/XI/XXII |
| NUT-02 | `alimentos_referencia` + ingestão do subconjunto USDA FDC (CC0), indexado por trigram, com `versao_base` e `licenca` gravadas | 8 | ✅ 88/89 alimentos importados (`scripts/importar-usda.mjs`). 1 gap conhecido: "Mandioca" e "Farinha de mandioca" caíram no mesmo `fdcId` 169985 (USDA só tem "Cassava, raw" nesse subconjunto) — farinha de mandioca fica com o perfil nutricional da raiz crua até entrar um termo de busca melhor ou a base TBCA (§5) |
| NUT-03 | ADRs revisadas pelo PO + texto do disclaimer v1 + política de atribuição de fontes | 3 | ✅ ADR-01 a ADR-06 (§7) aprovadas pelo PO em 2026-07-29 sem alteração. Disclaimer v1 e política de atribuição em §16 |

**Meta:** base científica dentro do banco, licença clara, buscável por nome. **Atingida.**

### Sprint 1 — Motor de cálculo · 21 SP · ✅ CONCLUÍDA 2026-07-29
| ID | História | SP | Status |
|---|---|---|---|
| NUT-04 | `insumos_nutricao` + RLS escopada por loja + tipos em `src/types.ts` | 3 | ✅ Migração aplicada, RLS via `fn_tem_papel` (admin/operador); `InsumoNutricao` e `ResultadoCalculoNutricional` em types.ts |
| NUT-05 | `fn_recalcular_nutricao_produto`: recursão de preparos, detecção de ciclo, normalização via grafo de conversão | 8 | ✅ Motor único `fn_calcular_nutricao_receita` (ADR-01) — CTE recursiva, path de ciclo, teto de profundidade 6, `fn_normalizar_para_nutricao` como ponte de massa |
| NUT-06 | `fn_simular_nutricao(jsonb)` para preview de receita não salva | 3 | ✅ Wrapper lenient do mesmo motor (inclui dado não revisado) |
| NUT-07 | Golden tests: preparo aninhado 3 níveis, ciclo, `un` sem peso médio, `L` sem densidade, insumo sem dado | 5 | ✅ `__tests__/integration/nutricao.test.ts` — 7/7 passando contra o banco real |
| NUT-08 | Cadastro manual de nutrição do insumo (a via de escape que sempre funciona) | 2 | ✅ `ModalNutricaoInsumo.tsx`, botão na tela de Estoque. **Não testado em navegador** (sem credencial de login) — verificado por typecheck/lint e consistência de padrão com os demais modais da tela |

**Meta:** com insumo preenchido à mão, o prato calcula certo — inclusive molho dentro de molho. **Atingida.**

**Decisão de design não pautada no doc original:** `cobertura_pct` é PARCIAL (não SEM_DADOS) quando a massa é conhecida mas a nutrição não — `SEM_DADOS` fica reservado para quando a própria massa é indeterminável (ciclo, profundidade excedida, ou insumo sem nenhuma ponte de conversão). Ver comentário no motor.

### Sprint 2 — Captura sem esforço · 21 SP · 🟡 CONCLUÍDA COM RESSALVA 2026-07-29
| ID | História | SP | Status |
|---|---|---|---|
| NUT-09 | `insumos.gtin` + captura do `cEAN` na conferência de compra | 3 | ✅ Campo de código de barras em `ModalRecebimento.tsx` — ao sair do campo, dispara `nutricao-ean` em segundo plano; o lojista está conferindo a compra, não cadastrando nutrição |
| NUT-10 | `nutricao-ean`: lookup Open Food Facts, normalização para o esquema interno, atribuição ODbL, cache local | 5 | ✅ Edge Function `nutricao-ean` — cache platform-wide em `alimentos_referencia` (fonte=ROTULO_FABRICANTE), mapeamento de campos validado contra produto real da OFF, checagem de sanidade energética |
| NUT-11 | `nutricao-ocr-rotulo`: foto → Gemini Flash-Lite com `responseSchema` → valores + alérgenos, com recorte da evidência | 8 | ✅ Edge Function `nutricao-ocr-rotulo` — `responseSchema` sem estado negativo de alérgeno (ADR-03), `temperature:0`, validação de domínio antes de tocar o banco, foto salva em bucket privado `nutricao-evidencias` |
| NUT-12 | UX de captura mobile: câmera, enquadramento, retomada, upload em fila offline | 5 | 🟡 Câmera (`capture="environment"`), compressão client-side (1600px/JPEG 0,85) e retomada por mensagem de erro — tudo em `ModalNutricaoInsumo.tsx`. **Fila de upload offline não implementada**: exigiria fila IndexedDB + sincronização em background, escopo maior que o resto da história. Ver nota abaixo |

**Recorte de escopo assumido, não silencioso:** a "fila offline" de NUT-12 (upload que resiste a perda de conexão em campo) ficou de fora. Hoje, se a conexão cair no meio do envio da foto, a captura falha e pede nova tentativa — não há perda de dado (nada é salvo pela metade), só perda de conveniência. Se o uso em campo mostrar que isso é frequente (cozinha com wifi ruim), vale um sprint dedicado a isso depois.

**Verificação feita:** as duas Edge Functions foram publicadas e testadas com chamada real (sem JWT de usuário real disponível para testar o caminho de sucesso ponta a ponta — só o smoke test de que ambas sobem e recusam corretamente sem autenticação). O mapeamento de campos do Open Food Facts foi validado contra um produto real (Nutella, EAN 3017620422003) fora do Edge Function, confirmando que os nomes de campo e a conversão de sódio (g→mg) estão corretos. **Não testado em navegador com login real** — mesma limitação já registrada na Sprint 1.

**Meta:** dois caminhos de dado de rótulo funcionando — um automático, um de 5 segundos.

### Sprint 3 — Copiloto e revisão em lote · 21 SP
| ID | História | SP |
|---|---|---|
| NUT-13 | `nutricao-sugerir`: trigram → Gemini com `responseSchema` → sugestão com confiança e justificativa | 8 |
| NUT-14 | Inferência de alérgeno respeitando ADR-03 (schema sem estado negativo) | 3 |
| NUT-15 | `nutricao-varrer-despensa`: lote assíncrono, idempotente, progresso real, rate limit por loja | 5 |
| NUT-16 | **Fila de revisão** — teclado, evidência lado a lado, progresso com consequência (§8.2 momento 2) | 5 |

**Meta:** um clique, um café, 150 insumos revisáveis em 10 minutos.

### Sprint 4 — Produto, cache e selo · 21 SP
| ID | História | SP |
|---|---|---|
| NUT-17 | `produtos_nutricao_config`: porções, peso da porção, fator de cocção, override, exibir | 5 |
| NUT-18 | `produtos_nutricao_cache` + triggers de invalidação nas 4 origens | 5 |
| NUT-19 | `fn_recalcular_selo_loja` + `lojas_selo_historico` (append-only, revogação automática) | 5 |
| NUT-20 | Painel de cobertura: `vw_nutricao_cobertura`, semáforo por prato, lacuna como tarefa (§8.1.3) | 3 |
| NUT-21 | Config por loja + flag `ModulosAtivos.nutricional` + disclaimer editável | 3 |

**Meta:** o selo existe, sobe e desce sozinho, e o lojista vê o caminho para o próximo nível.

### Sprint 5 — Vitrine, selo público e SEO · 21 SP
| ID | História | SP |
|---|---|---|
| NUT-22 | Tabela no `ModalProduto` — semântica, a11y, alérgeno acima dos macros, 375px (§8.2 momento 3) | 5 |
| NUT-23 | Selo de kcal no card + badge do nível no cabeçalho do cardápio | 3 |
| NUT-24 | **Página pública `/selo/:slug`** — metodologia, fontes, histórico, QR code, prerender | 8 |
| NUT-25 | JSON-LD `schema.org/NutritionInformation` no prerender — SEO de cauda longa | 3 |
| NUT-26 | Alerta de alérgeno no PDV e no KDS ao abrir o item | 2 |

**Meta:** o cliente vê, o Google indexa, e existe um endereço onde qualquer um audita.

### Sprint 6 — Conformidade, hardening e GA · 13 SP
| ID | História | SP |
|---|---|---|
| NUT-27 | `nutricao-dossie`: PDF com valores, fontes, versões e datas — o documento para a vigilância (§3.2) | 5 |
| NUT-28 | Rótulo imprimível para embalagem (marmitaria — §3.3), no layout da IN 75/2020 | 3 |
| NUT-29 | Auditoria de RLS das 6 tabelas novas + `get_advisors` limpo + k6 no cardápio com cache quente | 3 |
| NUT-30 | Central de Ajuda + landing do módulo + rollout Lanche do Paulista → Natureba | 2 |

---

## 10. Critérios de aceite (as histórias que mais erram)

**NUT-05 — motor de cálculo**
```gherkin
Cenário: preparo aninhado normaliza pelo rendimento
  Dado um preparo "Molho de tomate" com rendimento de 2000 g
    E que ele consome 1500 g de tomate e 100 ml de azeite
    E um produto "Lasanha" que consome 250 g desse molho
  Quando o cálculo nutricional da Lasanha for executado
  Então o aporte do molho deve ser 250/2000 do total do preparo
    E a recursão deve resolver preparo dentro de preparo em até 5 níveis

Cenário: ciclo na ficha não derruba o cálculo
  Dado que o preparo A consome o preparo B e o preparo B consome o preparo A
  Quando o cálculo for executado
  Então a função encerra com erro tratado identificando o ciclo
    E o produto fica com status SEM_DADOS, nunca com número parcial silencioso

Cenário: unidade sem massa universal não vira regra de três
  Dado um insumo "Ovo" com unidade_medida = 'un' e sem peso_medio_un_g
  Quando o cálculo for executado
  Então o insumo entra em insumos_faltantes com motivo "peso médio não informado"
    E a cobertura_pct é reduzida proporcionalmente
    E nenhuma massa é inventada
```

**NUT-14 — alérgeno (ADR-03)**
```gherkin
Cenário: a IA não pode absolver um insumo
  Dado um insumo submetido ao copiloto
  Quando a IA retornar o campo de alérgenos
  Então o responseSchema só admite CONTEM, PODE_CONTER ou NAO_AVALIADO
    E qualquer resposta com negativa é rejeitada na validação da Edge Function
    E o evento é logado para revisão do prompt
```

**NUT-19 — integridade do selo**
```gherkin
Cenário: selo é revogado automaticamente ao quebrar o critério
  Dada uma loja no nível 2 com 40 pratos publicados
  Quando o lojista cadastrar um prato novo sem ficha técnica
  Então o nível do selo é recalculado na mesma transação
    E a queda é registrada em lojas_selo_historico com o motivo
    E o lojista recebe a ação exata para recuperar o nível
    E a página pública passa a exibir o nível novo imediatamente
```

**NUT-24 — página pública**
```gherkin
Cenário: a página do selo é auditável sem login
  Dado um visitante anônimo com a URL do selo
  Quando abrir a página
  Então vê nível, data, cobertura, composição das fontes e a metodologia
    E vê explicitamente o que o selo NÃO significa
    E, se o nível for 3, vê nome, CRN e data da assinatura
    E nenhuma consulta autenticada é necessária para renderizar
```

---

## 11. DoR / DoD

**DoR** — a história tem critério em Gherkin; impacto de RLS declarado; comportamento definido
para dado ausente (nunca "assumir zero"); protótipo em 375px quando toca UI.

**DoD** —
1. Migration aplicada via Management API, confirmada em `list_migrations`.
2. Tabela nova **nasce com RLS ligada e policy escopada por `loja_id`** — sem exceção.
3. `npm run typecheck`, `npm run lint` e `npm test` limpos.
4. Golden test cobrindo o caminho de dado ausente, não só o feliz.
5. `get_advisors` sem alerta novo.
6. Testado no **Lanche do Paulista** com fingerprint de contagem antes/depois — Natureba intocado.
7. Toda chamada de IA com `responseSchema` + validação de domínio na saída.
8. Texto exposto ao consumidor revisado pelo PO.

---

## 12. Riscos

| ID | Risco | Prob. | Impacto | Mitigação | Dono |
|---|---|---|---|---|---|
| R-01 | **Alérgeno errado publicado** causa dano ao consumidor | Baixa | Crítico | ADR-03; revisão humana; disclaimer; alerta no PDV/KDS; nunca renderizar ausência como garantia | PO |
| R-02 | Selo percebido como autocertificação sem valor | Média | **Alto** | Página pública auditável, critério calculado e não concedido, revogação automática, nível 3 com CRN. Nunca usar "certificado" ou "laudo" no marketing | PO |
| R-03 | Fator de cocção ignorado ⇒ erro sistemático (fritura absorve óleo, cozimento perde água) | **Alta** | Médio | v1: fator manual por prato com presets (grelhado 0,75 · frito 1,15 · cozido 1,05) extraídos de literatura citada; v2: retenção por nutriente | Tech Lead |
| R-04 | Recursão com ciclo ou profundidade grande derruba a RPC | Média | Alto | Limite 5 níveis, detecção de ciclo, NUT-07 | Tech Lead |
| R-05 | **ODbL do Open Food Facts** — *share-alike* pode alcançar a base derivada | Média | Médio | Usar como *lookup no cadastro*, gravando o valor como dado do insumo do lojista, com atribuição; **não redistribuir a base como base**. Fronteira "produced work" × "derivative database" precisa de leitura jurídica antes do GA | PO |
| R-06 | Cardápio lento por cálculo em runtime | Baixa | Alto | ADR-01 + cache; `anon` só lê `produtos_nutricao_cache`; k6 no S6 | Dev Front |
| R-07 | Lojista abandona no meio e fica em cobertura parcial para sempre | **Alta** | Médio | ADR-05 vira lacuna em tarefa; nudge no Dashboard; "seus 5 pratos mais vendidos estão a 3 insumos do próximo nível" | UX |
| R-08 | OCR lê rótulo errado (foto torta, reflexo, valor por porção × por 100 g) | Média | Médio | Revisão humana obrigatória com recorte da evidência ao lado; validação de sanidade (soma de macros × fator energético ≈ kcal declarada, ±20%); rejeitar e pedir nova foto | Dev Backend |
| R-09 | Base USDA não cobre bem alimento brasileiro (mandioca, açaí, farofa) | **Alta** | Médio | Aceito no v1 com caminhos ①② compensando; licença TBCA é a correção definitiva — orçar após validação de mercado | PO |

---

## 13. Métricas

| Métrica | Como medir | Meta |
|---|---|---|
| **% produtos COMPLETO** (norte) | `vw_nutricao_cobertura` | ≥ 70% em 30 min de trabalho |
| Distribuição dos caminhos de captura | `insumos_nutricao.origem` | ≥ 50% via ① ou ② (rótulo) até o S6 |
| Taxa de aceite da sugestão de IA | aprovadas sem edição ÷ sugeridas | ≥ 80% (abaixo, escalar modelo — ADR-04) |
| Tempo mediano de revisão por insumo | telemetria da fila | ≤ 8 s |
| Lojas por nível de selo | `lojas_selo_nutricional` | ≥ 30% no nível 2 em 90 dias |
| Visitas à página pública do selo | analytics | — (baseline; é o proxy de valor percebido) |
| Conversão com vs. sem tabela | A/B por loja | hipótese: +3 p.p. em público restritivo |
| Impressões orgânicas "prato + calorias" | Search Console pós-JSON-LD | crescimento em 60 dias |

---

## 14. Leitura comercial

**Por que isso vende, em ordem de força:**

1. **Marmitaria / congelados / dark kitchen** (§3.3) — para eles a rotulagem é **obrigatória**
   e hoje sai por consultoria avulsa a cada rótulo. O MiseOn entrega o rótulo imprimível
   (NUT-28) a partir de dado que eles já cadastram. Este é o segmento âncora do módulo pago.
2. **Alimentação corporativa, PNAE e licitação** — exigem informação nutricional e
   rastreabilidade documentada. O dossiê (NUT-27) e o nível 3 do selo são exatamente a peça
   que falta nas propostas desses lojistas.
3. **Diferenciação no delivery comum** — onde é voluntário, quem tem selo aparece diferente.
   E a página pública é conteúdo indexável que os concorrentes não têm.
4. **Marketplace de nutricionistas** — o nível 3 exige CRN. A [Home](src/pages/Home.tsx:1677)
   já recruta "Consultor de CMV, Chef, Nutricionista". Fechar o ciclo — lojista pede assinatura,
   profissional cadastrado audita dentro da plataforma, MiseOn intermedia — é receita nova sem
   custo fixo, e resolve o "não posso contratar agora" transformando o custo em produto.

**Sequência recomendada:** v1 gratuito no plano atual para gerar densidade de selos (o selo só
vale se muitos tiverem), e o **rótulo imprimível + dossiê + nível 3** como pacote pago.

---

## 15. Fora de escopo (v2 explícito)

- Retenção de nutrientes por método de cocção (v1 usa fator único por prato).
- Filtro "sem glúten / sem lactose" na vitrine — depende de declaração humana confiável em
  massa (ADR-03).
- Rotulagem frontal (lupa de alto teor) — entra junto com NUT-28 se o segmento marmitaria
  validar.
- VD% personalizado por perfil do cliente.
- Licença TBCA e reprocessamento da base (R-09) — decisão pós-validação de mercado.

---

## 16. NUT-03 — Disclaimer v1 e política de atribuição de fontes

Entregável da Sprint 0. Fecha o gap entre "temos os ADRs" e "temos o texto que vai para o
consumidor final e para a fiscalização". Nada aqui é definitivo — é a v1 que destrava a Sprint 1;
qualquer mudança de tom depois disso é decisão do PO, não retrabalho técnico.

### 16.1 Disclaimer curto — card do produto na vitrine

> *Valores calculados a partir da ficha técnica declarada pelo estabelecimento, usando bases de
> composição de alimentos. Não substitui laudo de análise laboratorial.*

### 16.2 Disclaimer longo — modal do produto e página do selo

> **Como calculamos.** A informação nutricional deste prato não vem de laudo de laboratório: é
> calculada a partir da receita que o estabelecimento declarou, usando o método de cálculo por
> tabela de composição de alimentos — reconhecido pela ANVISA como via válida para obter a
> informação nutricional (junto com a análise físico-química). Cada ingrediente carrega sua
> origem: rótulo do fabricante, base científica pública ou estimativa. Estimativas aparecem
> marcadas e nunca contam para o nível de rastreamento do selo. O estabelecimento revisou e
> aprovou os valores antes da publicação; nenhum número vai ao ar sem essa revisão.
>
> **O que isto NÃO é.** Não é laudo de análise físico-química. Não é parecer de nutricionista,
> a menos que o selo desta loja esteja no nível 3 (veja a assinatura, se houver). Precisão
> declarada é a da receita informada — alterações de fornecedor, safra ou modo de preparo podem
> mudar o valor real sem mudar o valor calculado até a próxima revisão.
>
> **Alergênicos.** Os alergênicos aqui indicados refletem o que foi avaliado pelo
> estabelecimento. A ausência de um alergênico na lista significa que ele **não foi avaliado**,
> nunca que o prato **não contém** aquele alergênico. Em caso de restrição alimentar severa,
> confirme diretamente com o estabelecimento antes de consumir.

### 16.3 Disclaimer da página pública do selo (`/selo/:slug`)

Usa o texto de §16.2 na íntegra, mais um parágrafo de metodologia:

> **Metodologia.** Nível calculado automaticamente a partir da cobertura de dados da loja —
> nenhum humano do MiseOn concede ou aprova o selo. O critério de cada nível é público (ver
> tabela acima) e o nível cai automaticamente se a loja deixar de cumpri-lo. Fontes usadas:
> USDA FoodData Central (domínio público), Open Food Facts (dados de rótulo por código de
> barras) e rótulo do fabricante fornecido pelo próprio estabelecimento. O MiseOn não realiza
> análise laboratorial e não é responsável técnico nutricional da loja, exceto quando o selo
> exibir assinatura de nutricionista com CRN ativo (nível 3).

### 16.4 Política de atribuição de fontes

Regra geral: **toda fonte usada é citada onde a licença exige ou onde a fiscalização pode
perguntar** — nunca só no rodapé do site, sempre também no dossiê (NUT-27) e na página do selo.

| Fonte | Obrigação de atribuição | Como o MiseOn cumpre |
|---|---|---|
| **USDA FoodData Central** | CC0 — atribuição é *pedida*, não exigida legalmente | Citada por padrão em `alimentos_referencia.fonte_url` (grava o link do alimento específico) e na metodologia da página do selo (§16.3). Texto fixo: *"Dados de composição: USDA FoodData Central (domínio público)."* |
| **Open Food Facts** (S2 em diante) | ODbL — atribuição **obrigatória** + *share-alike* sobre a base derivada (R-05) | Cada insumo com origem `ROTULO_EAN` grava `fonte_url` apontando para a página do produto em `openfoodfacts.org`. Texto fixo no dossiê: *"Dados de rótulo: Open Food Facts (ODbL), consultados por código de barras."* O MiseOn consome via *lookup* e grava o valor como dado do insumo do lojista — não redistribui a base OFF como base. Fronteira jurídica exata (o que é "produced work" vs "derivative database") fica pendente de leitura jurídica antes do GA, conforme R-05 |
| **Rótulo do fabricante** (foto, origem `ROTULO_FOTO`) | Dado factual do produto — sem exigência de licença de terceiro | Não precisa atribuição externa; a proveniência interna (`origem`, `revisado_por`, `atualizado_em`) já documenta que veio do rótulo fotografado |
| **TBCA** (futuro, pago) | Licença comercial a negociar antes do uso | Não embarcar nenhum dado até o contrato existir — ver R-09 e §5 |
| **TACO** | Obra registrada, reprodução exige autorização escrita | **Não usar.** Pode ser citada como referência textual em documentação interna, nunca como dado embarcado no produto |

**Regra de ouro:** se a atribuição não existir no dado (`fonte`, `fonte_versao`, `fonte_url`,
`licenca` preenchidos), o valor não é publicável — isso já é reforçado por constraint em
`alimentos_referencia` (todas as quatro colunas são `not null`, exceto `fonte_url`) e será
reforçado por `insumos_nutricao` na Sprint 1 (NUT-04).

---

## Fontes consultadas

- [ANVISA — Rotulagem Nutricional, Perguntas e Respostas](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/alimentos/perguntas-e-respostas-arquivos/rotulagem-nutricional_2a-edicao.pdf) — método de cálculo aceito, tabelas de referência, fonte exigível pela vigilância
- [IN nº 75/2020](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa//2020/IN%2075_2020_.pdf) — requisitos técnicos, VDR, arredondamento, porções, fatores de conversão energética
- [RDC nº 429/2020](https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000429&seqAto=000&valorAno=2020&orgao=RDC%2FDC%2FANVISA%2FMS&codTipo=&desItem=&desItemFim=&cod_menu=1696&cod_modulo=134&pesquisa=true) — âmbito: embalados na ausência do consumidor
- [Resolução CFN nº 600/2018](https://cfn.org.br/wp-content/uploads/resolucoes/Res_600_2018.htm) — atribuições do nutricionista, rotulagem de preparações
- [USDA FoodData Central — documentação e licença](https://fdc.nal.usda.gov/data-documentation/) · [API](https://fdc.nal.usda.gov/api-guide) — CC0, uso comercial livre
- [Open Food Facts — dados e licença ODbL](https://world.openfoodfacts.org/data) · [API](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [TBCA — USP/FoRC](https://www.tbca.net.br/) — consulta livre, licença paga para uso em ferramenta
- [TACO — Nepa/Unicamp](https://nepa.unicamp.br/tabela-brasileira-de-composicao-de-alimentos-4a-edicao/) — obra registrada, uso mediante autorização
- [Gemini API — structured output](https://firebase.google.com/docs/ai-logic/generate-structured-output) · [pricing](https://ai.google.dev/gemini-api/docs/pricing)
