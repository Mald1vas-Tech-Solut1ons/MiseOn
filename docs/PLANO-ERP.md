# MiseOn — Plano Supremo: da Nota Fiscal ao ERP de Food Service

**Papel deste doc:** documento-guarda-chuva do produto. Define a **espinha** sobre a qual todo
módulo de suprimentos, almoxarifado, ativos e nutrição se pendura, e a divisão de trabalho do
squad de agentes.
**Owner:** Rafael (fundador/CTO) · **Squad:** Rafael + agentes (§9)
**Status:** 🚧 EM EXECUÇÃO — **Onda 0 aplicada no banco em 2026-07-29** (§3.1). Falta só a adoção nas telas.
**Documentos-filho:** [AGENTES.md](docs/AGENTES.md) (roteamento e prompts do squad) · [PLANO-NUTRICIONAL.md](docs/PLANO-NUTRICIONAL.md) (Onda 3) · [PLANO-PRODUTO.md](docs/PLANO-PRODUTO.md) (roadmap comercial) · [PLANO-WHATSAPP.md](docs/PLANO-WHATSAPP.md)

---

## 0. A tese em cinco linhas

O que mata todo ERP de pequeno negócio não é falta de funcionalidade — é **digitação**. O
lojista abandona porque cadastrar 400 itens, lançar 60 notas por mês e classificar cada
despesa é trabalho que não cabe no dia dele.

No Brasil, esse problema **já foi resolvido pelo Estado e ninguém aproveitou direito**: toda
compra que a loja faz gera uma NF-e eletrônica, estruturada, assinada, com descrição, unidade,
quantidade, valor, código de barras, classificação fiscal e até as parcelas com vencimento — e
a SEFAZ entrega esse documento ao destinatário via webservice, sem o fornecedor precisar
colaborar.

> **A tese do MiseOn ERP:** não construir telas de cadastro. Construir **um pipeline de
> ingestão** que transforma o documento fiscal em estoque, custo, almoxarifado, contas a pagar,
> ativo imobilizado e informação nutricional — automaticamente. O cadastro vira consequência
> da compra, não pré-requisito dela.

---

## 1. O CTO fala primeiro (leia antes do resto)

Você disse que pensar grande e pensar pequeno gastam a mesma energia. Concordo — **para
visão**. Para execução, não: escopo grande gasta *tempo de vida* de forma desigual, e o modo
clássico de um produto excelente morrer é virar ERP antes do primeiro cliente pagante.

Mas há um jeito de as duas coisas serem verdade ao mesmo tempo, e é ele que estrutura este
plano:

> **O ERP do MiseOn não são oito módulos. É um pipeline e oito configurações.**

Se a espinha estiver certa — um modelo de item polimórfico, um razão, um motor de custeio, uma
porta de entrada — então "adicionar material de limpeza" não é um projeto, é uma linha numa
tabela de tipos e um comportamento contábil. Dias, não meses. Se a espinha estiver errada,
cada categoria vira um módulo próprio, e aí sim são dois anos.

**Portanto, a recomendação é sequência, não redução de escopo:**

1. **Onda 0 e 1 primeiro, sempre.** A espinha e a ingestão. Elas sozinhas já entregam valor
   comercial imediato e são pré-requisito de tudo.
2. **Depois, cada categoria entra sob demanda de cliente real.** Você não decide de antemão se
   material de escritório vem antes de manutenção — o piloto decide, e ambos custam dias.
3. **Nada disso adia o lançamento.** As ondas 0 e 1 melhoram um produto que já está pronto para
   vender; não bloqueiam nada em [PLANO-PRODUTO §4.1](docs/PLANO-PRODUTO.md).

**E há uma urgência real, não inventada:** a SEFAZ mantém os documentos disponíveis para
download por **90 dias**. Cada mês sem o coletor rodando é um mês de histórico de compras que o
lojista **perde para sempre** — e histórico de preço de compra é exatamente o ativo que torna a
curva ABC, o alerta de variação e o custeio confiáveis. O coletor deveria começar a rodar antes
mesmo de existir tela para ele.

---

## 2. As três descobertas que estruturam a arquitetura

### 2.1 A nota vem sozinha — não precisa pedir ao fornecedor 🎯

A SEFAZ opera o webservice nacional **`NFeDistribuicaoDFe`**: o destinatário consulta e baixa
os XMLs de **todas as notas emitidas contra o seu CNPJ**. Não depende do fornecedor mandar
nada. Requisitos: certificado digital com o CNPJ raiz, e **manifestação do destinatário** para
liberar o XML completo (sem manifestar, só vem o resumo). Janela de retenção: **90 dias**.

### 2.2 E o MiseOn já tem o caminho pronto para isso ✅

O módulo fiscal já usa a **Focus NFe** em produção
([fiscal-emitir-nfce](supabase/functions/fiscal-emitir-nfce/index.ts)), e a Focus expõe API de
**Manifestação do Destinatário (MDe)**, listagem de **NF-e recebidas** e **download de XML**.
Ou seja: nada de SOAP, assinatura XMLDSig e mTLS com `.pfx` dentro do Deno — coisa que sozinha
consumiria uma onda inteira. É uma chamada REST com o token que já existe.

E mais: a tabela `notas_fiscais` **já nasceu com `tipo = 'ENTRADA_FORNECEDOR'` e status
`'IMPORTADA'`** ([migração fiscal](supabase/migrations/20260724000000_modulo_fiscal_completo.sql)),
e o certificado A1 já tem lugar guardado e criptografado em `configuracoes_fiscais`. O gancho
foi deixado; falta pendurar.

> **Consequência:** a maior peça técnica do ERP inteiro custa uma sprint, não um trimestre.

### 2.3 O NCM classifica sozinho o que a IA teria que adivinhar

Todo item de NF-e carrega o **NCM** — 8 dígitos, cujos 2 primeiros são o capítulo da
Nomenclatura Comum do Mercosul. Isso é um **classificador determinístico, gratuito e auditável**
para o problema "isto é ingrediente, limpeza, escritório ou máquina?":

| Capítulos NCM | Conteúdo | `tipo_item` sugerido |
|---|---|---|
| 01–24 | Animais, hortaliças, frutas, cereais, carnes, laticínios, bebidas, preparações alimentícias | `INGREDIENTE` |
| 34 | Sabões, agentes de superfície, preparações para lavagem, ceras, produtos de limpeza | `LIMPEZA` |
| 38 | Produtos químicos diversos (desinfetantes, inseticidas) | `LIMPEZA` |
| 39 · 76 | Plástico e obras · alumínio (marmitex, papel-alumínio, filme) | `EMBALAGEM` / `DESCARTAVEL` |
| 48 | Papel e cartão (higiênico, toalha, papelaria) | `LIMPEZA` ou `ESCRITORIO` — fronteira, ver abaixo |
| 61–63 | Vestuário e têxteis (uniforme, pano de prato) | `UNIFORME_EPI` |
| 69 · 70 · 73 · 82 | Cerâmica, vidro, ferro/aço, cutelaria e talheres | `UTENSILIO` |
| 84 · 85 | Máquinas e aparelhos elétricos (fogão industrial, freezer, coifa) | `ATIVO_IMOBILIZADO` |
| 96 (9603) | Vassouras, escovas, rodos | `LIMPEZA` |

**A regra de ouro do classificador:** o NCM resolve a maioria por regra pura; a IA só é chamada
**na fronteira** (o capítulo 48 é papel higiênico ou papel sulfite? o capítulo 39 é pote de
viagem ou balde de faxina?), usando a descrição do produto. E toda classificação — por regra ou
por IA — é **sugestão revisável**, e a correção do lojista vira regra permanente para aquele
fornecedor (§5, estágio 4).

Isso inverte a economia do problema: em vez de IA classificando 400 itens com 85% de acerto,
temos regra fiscal resolvendo o grosso com 100% de rastreabilidade e IA resolvendo a borda.

---

## 3. A espinha: de `insumos` para `itens`

Hoje `insumos` assume que tudo é comida que entra em receita: tem `is_preparo`,
`rendimento_porcoes`, ficha técnica, validade. Detergente não tem ficha técnica. Furadeira não
tem validade. Papel A4 não entra no CMV.

**A decisão errada** seria criar `produtos_limpeza`, `materiais_escritorio`, `ativos`… — cinco
tabelas, cinco telas, cinco razões, e o custeio replicado cinco vezes.

**A decisão certa** é generalizar: `insumos` ganha um discriminador `tipo_item`, e o
comportamento passa a ser função do tipo. Um razão, um motor de custeio, uma porta de entrada,
um inventário — comportamentos diferentes por tipo.

| `tipo_item` | Ficha técnica? | Efeito no resultado | Conta | Validade | Inventário |
|---|---|---|---|---|---|
| `INGREDIENTE` | sim | CMV | 1.1.03 Estoque | sim | contagem cíclica |
| `PREPARO` | é composto | CMV (via pai) | 1.1.03 | sim (já existe) | produção |
| `EMBALAGEM` | opcional | CMV | 1.1.03 | não | contagem |
| `DESCARTAVEL` | opcional | CMV variável | 1.1.04 Almoxarifado | não | contagem |
| `LIMPEZA` | **não** | Despesa operacional | 1.1.04 | sim (produto químico) | requisição por setor |
| `ESCRITORIO` | não | Despesa administrativa | 1.1.04 | não | requisição |
| `MANUTENCAO` | não | Despesa de manutenção | 1.1.04 | não | consumo por OS |
| `UNIFORME_EPI` | não | Despesa de pessoal | 1.1.04 | **sim (CA do EPI)** | entrega nominal ao colaborador |
| `ATIVO_IMOBILIZADO` | não | **não entra no resultado** — deprecia | 1.2.01 Imobilizado | — | patrimônio |

### 3.1 Correção de rota: a tabela NÃO foi renomeada ✅ aplicado

O plano original mandava renomear `insumos` para `itens` e deixar `insumos` como view. A
auditoria feita antes de escrever a migração encontrou **12 chaves estrangeiras** apontando
para `insumos(id)` — `compras_itens` (duas), `fatores_conversao`, `fichas_preparos` (duas),
`fichas_tecnicas`, `lotes_estoque`, `movimentacoes_estoque`, `opcoes`, `producoes_preparo`,
`reposicoes_buffet`, `transformacoes_itens`.

Renomear preserva as FKs (elas seguem o OID, não o nome), mas faria o **PostgREST resolver os
embeds aninhados contra uma view** — `.select('*, insumos(*)')` está espalhado pelo front. Risco
real, distribuído por dezenas de queries, em troca de um ganho puramente cosmético de nome.

**Decisão tomada na execução:** a tabela física continua `insumos`. O que importa é o
discriminador, não o nome. `itens` existe como **view nova**, com o comportamento do tipo já
resolvido no join — é o que o código novo lê, e a nomenclatura converge sem big bang.

**A ponte de compatibilidade:** `is_preparo` continua funcionando. O trigger
`trg_sync_tipo_item_is_preparo` mantém os dois campos sincronizados **nos dois sentidos** —
`EstoquePreparos.tsx` insere `{ is_preparo: true }` sem saber que `tipo_item` existe e o
registro nasce `PREPARO`; código novo grava `tipo_item` e `is_preparo` acompanha. Nenhum lado
precisa ceder, e o risco **E-02 deixa de ser crítico**.

**Prova de execução (2026-07-29):** `insumos` 39→39 · `fichas_tecnicas` 13→13 ·
`movimentacoes_estoque` 70→70 · `lojas` 2→2 · `contas` 18→36 (as 9 contas novas × 2 lojas).
Os quatro casos do trigger testados e revertidos, sem resíduo. `get_advisors(security)` sem
alerta novo. Backfill: 29 `INGREDIENTE`, 5 `REVENDA`, 4 `PREPARO`, 1 `LIMPEZA` — derivado de
`is_preparo` e `categoria_insumo`, sem nenhuma adivinhação por nome.

Migração: [20260729020000_erp_onda0_tipo_item_e_plano_de_contas.sql](supabase/migrations/20260729020000_erp_onda0_tipo_item_e_plano_de_contas.sql)

**Plano de contas a criar** (o atual tem 1.1.01 Caixa, 1.1.02 Banco, 1.1.03 Estoque, 2.1.01
Fornecedores, 4.1.01 CMV): `1.1.04 Almoxarifado`, `1.2.01 Imobilizado`,
`1.2.09 (-) Depreciação Acumulada`, e as despesas `4.2.x` por natureza.

---

## 4. Por que isso é um ERP de *food service*, e não um ERP genérico

Um ERP genérico trata tudo como "item de estoque". Food service tem quatro coisas que ERP
genérico faz mal, e o MiseOn já resolve três delas:

1. **Unidade não é linear.** Compra-se em caixa, estoca-se em quilo, usa-se em fatia, e o
   rendimento é humano, não físico. Já resolvido em [unidades.ts](src/lib/unidades.ts) e
   [custeio.ts](src/lib/custeio.ts) — e é o motivo de este ERP ser possível.
2. **O produto se transforma.** Frango vira peito, coxa e carcaça; molho vira insumo de outro
   molho. Já resolvido em `fn_transformar_estoque` e nos preparos recursivos.
3. **Perecibilidade é dinheiro.** Já resolvido em `vw_lotes_validade` e no controle de lotes.
4. **Consumo não-produtivo existe e some do custo.** É o buraco que esta onda fecha: detergente,
   marmitex, uniforme e manutenção hoje saem do caixa sem passar pelo estoque — o lojista vê o
   dinheiro sumir e não sabe onde. **O CMV fica certo e a margem real continua errada.**

O item 4 é o argumento comercial inteiro do módulo: *"você já sabe quanto custa seu prato. Este
módulo mostra quanto custa manter a porta aberta."*

---

## 5. O pipeline de ingestão — cinco estágios

Este é o coração. Cada estágio é idempotente e auditável, e o documento nunca é destruído.

```
① COLETA          Focus MDe / DistribuicaoDFe, por CNPJ, a cada 6 h
   └─ grava o resumo, manifesta (ciência), baixa o XML completo
   └─ XML original guardado imutável (bucket) — é documento fiscal, guarda de 5 anos

② PARSE           XML → notas_entrada + notas_entrada_itens (staging)
   └─ <prod>: cProd, cEAN, xProd, NCM, CFOP, uCom, qCom, vUnCom, vProd
   └─ <cobr><dup>: parcelas com vencimento → contas a pagar (§6.3)
   └─ NADA toca estoque ainda. Staging é staging.

③ CLASSIFICA      NCM (regra) → tipo_item · IA só na fronteira · sempre revisável

④ DE-PARA         "REFRIG COCA 2L PET FD6" (fornecedor) → item interno
   └─ chave forte: EAN · chave média: cProd+CNPJ do fornecedor · fraca: similaridade
   └─ o de-para aprendido é PERMANENTE por fornecedor: a 2ª nota do mesmo fornecedor
      chega quase 100% resolvida. É aqui que o esforço decai a zero.
   └─ item novo? cria com tipo, unidade e fator de conversão sugeridos

⑤ EFETIVA         Uma transação: estoque + custo + razão + contas a pagar
   └─ reaproveita fn_receber_compra (já existe, já é atômica)
   └─ divergência nota × físico é INFORMAÇÃO, não erro (princípio da Fase 5)
```

**O que faz o esforço decair a zero:** o estágio ④ aprende. Primeira nota de um fornecedor:
o lojista mapeia 20 itens. Segunda nota: 2 itens novos. Terceira: nenhum. Em 60 dias o sistema
processa nota sozinho e só chama o humano quando há novidade real.

---

## 6. Os quatro ganhos que caem de graça do XML

Nenhum destes é um módulo novo. Todos são leitura de campos que **já vêm na nota**.

### 6.1 Nutrição sem trabalho — o elo com o EP-NUT
O campo `cEAN` de cada item é o código de barras. Com ele, o
[PLANO-NUTRICIONAL §5.1 caminho ①](docs/PLANO-NUTRICIONAL.md) consulta o Open Food Facts e traz
a tabela nutricional **do rótulo do fabricante**, sem o lojista tocar em nada. A onda de
ingestão alimenta a onda nutricional de graça.

### 6.2 Histórico de preço real, por fornecedor
`vw_historico_precos_compra` já existe, mas hoje depende de o lojista lançar a compra à mão. Com
ingestão automática, ela passa a refletir **tudo o que entrou na loja** — e aí a curva ABC, o
alerta de variação de preço e a sugestão de troca de fornecedor deixam de ser relatórios
bonitos e viram decisão com base completa.

### 6.3 Contas a pagar automáticas
O grupo `<cobr><dup>` do XML traz **cada parcela com número, vencimento e valor**. O razão já
credita `2.1.01 Fornecedores` no recebimento. Falta só a agenda de vencimentos — que o plano de
produto já lista como pendência ([§4.3](docs/PLANO-PRODUTO.md)) e que aqui **nasce preenchida**.

### 6.4 Conferência fiscal que ninguém faz
O CFOP e o CST/CSOSN de cada item permitem detectar o que passa despercebido: substituição
tributária cobrada indevidamente, nota emitida contra seu CNPJ que você não reconhece (uso
indevido de inscrição), item tributado fora do regime. Alerta simples, valor alto — e só o
MiseOn teria, porque só ele tem a nota estruturada e o contexto do negócio.

---

## 7. Modelo de dados (novo)

```sql
-- Espinha (Onda 0)
insumos += tipo_item, gtin, ncm, conta_id, depreciavel, vida_util_meses
           -- 'insumos' vira VIEW filtrando INGREDIENTE|PREPARO; tabela física = 'itens'
tipos_item                 catálogo: codigo pk, rotulo, entra_ficha, natureza_contabil,
                           conta_padrao, controla_validade, unidade_padrao

-- Ingestão (Onda 1)
dfe_coletas                loja_id, ultimo_nsu, ultimo_nsu_em, status, erro
                           -- cursor da SEFAZ; sem isso o coletor repete ou pula
notas_entrada              id, loja_id, chave (unique), fornecedor_cnpj, fornecedor_id,
                           numero, serie, emissao, valor_total, xml_path,
                           status ('RESUMO'|'MANIFESTADA'|'BAIXADA'|'CLASSIFICADA'|
                                   'CONFERIDA'|'EFETIVADA'|'RECUSADA'),
                           manifestacao_tipo, manifestacao_em
notas_entrada_itens        nota_id, n_item, c_prod, c_ean, x_prod, ncm, cfop, cst,
                           u_com, q_com, v_un_com, v_prod, v_desc, v_ipi, v_st,
                           item_id (de-para resolvido), tipo_item_sugerido, fator_conversao,
                           origem_match ('EAN'|'CPROD'|'SIMILARIDADE'|'MANUAL'|'IA'),
                           confianca, revisado
fornecedor_item_depara     fornecedor_id, c_prod, c_ean, item_id, fator_conversao,
                           unidade_nota, criado_por, usos    -- o aprendizado permanente
notas_entrada_duplicatas   nota_id, numero, vencimento, valor, lancamento_id

-- Almoxarifado não-alimentar (Onda 2)
requisicoes_almox          loja_id, setor, solicitante, status, criado_em
requisicoes_almox_itens    requisicao_id, item_id, qtd, custo_unit_snapshot
epi_entregas               colaborador_id, item_id, ca, qtd, entregue_em, assinatura

-- Ativos e manutenção (Onda 4)
ativos                     item_id, nota_entrada_id, valor_aquisicao, data_aquisicao,
                           vida_util_meses, valor_residual, depreciacao_acumulada,
                           local, numero_serie, garantia_ate, status
ordens_servico             ativo_id, tipo ('PREVENTIVA'|'CORRETIVA'), abertura, conclusao,
                           custo_pecas, custo_servico, fornecedor_id, descricao
planos_manutencao          ativo_id, periodicidade_dias, proxima_em, checklist jsonb
```

---

## 8. Ondas de entrega

| Onda | Escopo | SP | Pré-requisito | Valor entregue |
|---|---|---|---|---|
| **0 — Espinha** ✅ | `tipos_item`, discriminador em `insumos`, `gtin`/`ncm`, views `itens`/`vw_itens_*`, trigger de compatibilidade, plano de contas expandido | 21 | — | **Banco pronto (§3.1).** Falta adotar nas telas — ver [AGENTES.md §6.1](docs/AGENTES.md) |
| **1 — Ingestão** ⭐ | Coletor DFe, parser, staging, classificador NCM, de-para com aprendizado, tela de conferência, efetivação | 55 | Onda 0 + certificado A1 no tenant | Nota entra sozinha. Estoque, custo, razão e contas a pagar preenchidos |
| **2 — Almoxarifado** | Limpeza, descartáveis, escritório, EPI; requisição por setor; despesa por natureza | 21 | Onda 1 | "Quanto custa manter a porta aberta" (§4.4) |
| **3 — Nutricional** | [EP-NUT completo](docs/PLANO-NUTRICIONAL.md) — agora alimentado pelo EAN da Onda 1 | 123 | Onda 1 (caminho ①) | Selo público, rótulo, dossiê |
| **4 — Ativos** | Imobilizado, depreciação, ordem de serviço, plano preventivo, garantia | 34 | Onda 0 | Patrimônio e manutenção deixam de ser "despesa surpresa" |
| **5 — Financeiro completo** | Contas a pagar com agenda, conciliação, DRE por natureza, fluxo de caixa projetado | 34 | Onda 1 (duplicatas) | O dono para de usar planilha |
| **6 — Inteligência** | Curva ABC, alerta de variação de preço, sugestão de compra por giro e prazo, conferência fiscal (§6.4) | 21 | Ondas 1 e 5 | O sistema passa a opinar, não só registrar |

**Total: 309 SP.** Ondas 0 e 1 são **76 SP** e destravam sozinhas metade do valor.

**Ordem recomendada:** 0 → 1 → (3 em paralelo com 2, porque dependem de times/agentes
diferentes) → 5 → 4 → 6.

---

## 9. O squad de agentes

Você e os agentes. A regra que faz isso funcionar não é "qual modelo é melhor" — é **separar
quem escreve de quem julga**, e dar a cada papel um contrato de entrada e saída.

### 9.1 Papéis → modelos

| Papel | Modelo | Por que este | Nunca faz |
|---|---|---|---|
| **Arquiteto / Tech Lead** | **Opus** | Migração de schema sem downtime, RPC transacional, decisão de modelo, revisão final de SQL — onde errar custa dados | Tela, CSS, texto de marketing |
| **Implementador de volume** | **Sonnet** | React, Edge Functions, testes, refactor guiado — throughput com qualidade alta e custo sensato | Decidir schema ou política de RLS sozinho |
| **Especialista multimodal / contexto longo** | **Gemini** | OCR de rótulo, XML de 5 MB inteiro no contexto, classificação NCM em lote, leitura de legislação e manual da SEFAZ | Escrever migração de produção |
| **Varredor de baixo custo** | **K2/K3** | Normalização de nomes, deduplicação de catálogo, backfill, geração de fixtures — trabalho repetitivo e verificável | Qualquer coisa cujo erro não seja detectável por teste automático |
| **Juiz / Inspetor** | **Nemotron** | Avalia entregas contra os critérios de aceite e o DoD, gera relatório de conformidade, procura o que o autor não quis ver | **Escrever código de produção. Jamais.** |
| **PO / decisor** | **Rafael** | Prioridade, risco legal, promessa comercial, aceite final | Delegar decisão de negócio ao agente |

### 9.2 As quatro regras do squad

1. **Quem escreve não julga.** Nenhuma entrega é aceita pelo agente que a produziu. O Nemotron
   recebe o critério de aceite e o diff — não o histórico da conversa, para não herdar a
   justificativa de quem escreveu.
2. **Contrato de handoff.** Toda história entregue a um agente carrega: objetivo, arquivos que
   pode tocar, **invariantes que não pode quebrar**, critério em Gherkin, e a lista do que
   **não** deve fazer. Agente sem contrato reescreve o que já funcionava.
3. **O banco tem dono único.** Toda migração passa pelo Opus e é aplicada num tenant de provas
   (Lanche do Paulista) com fingerprint de contagem antes/depois. Natureba nunca é cobaia.
4. **Nenhum agente decide política de RLS.** Tabela nova nasce com RLS ligada e policy escopada
   por `loja_id`; o Nemotron valida isso como item bloqueante do DoD, não como sugestão.

### 9.3 O ciclo de uma história

```
Rafael prioriza  →  Opus especifica (contrato + Gherkin + invariantes)
      ↓
Sonnet/Gemini/K3 implementam  →  testes verdes localmente
      ↓
Nemotron julga contra o contrato  →  relatório: CONFORME / NÃO CONFORME + evidência
      ↓
Opus revisa o SQL e o risco  →  Rafael aceita  →  aplica no tenant de provas
```

---

## 10. Riscos

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| E-01 | **Escopo de ERP adia o lançamento indefinidamente** | **Alta** | **Crítico** | §1: ondas 0+1 primeiro; cada categoria depois vira configuração de dias. Nenhuma onda bloqueia [PLANO-PRODUTO §4.1](docs/PLANO-PRODUTO.md) |
| E-02 | ~~Migração `insumos` → `itens` quebra PDV/KDS/custeio~~ **RESOLVIDO** | — | — | §3.1: a tabela não foi renomeada; `itens` é view aditiva e o trigger de compatibilidade mantém `is_preparo` funcionando. Fingerprint provado |
| E-03 | Janela de 90 dias da SEFAZ perde histórico | **Alta** | Alto | Coletor no ar o quanto antes, mesmo sem UI. Cada mês parado é histórico irrecuperável |
| E-04 | Manifestação do destinatário é ato jurídico com efeito fiscal | Média | Alto | v1 usa apenas **"Ciência da Operação"**, que não confirma a operação. Confirmação/desconhecimento/não-realizada exigem ação explícita do lojista, com texto claro do que significa |
| E-05 | Certificado A1 é pré-requisito e o lojista não tem | **Alta** | Médio | Já é bloqueador conhecido do módulo fiscal. Fallback: upload manual de XML e importação por e-mail dedicado por loja |
| E-06 | De-para errado contamina custo e estoque | Média | Alto | Staging não toca estoque; conferência humana na 1ª ocorrência; confiança exposta; efetivação reversível por estorno no razão |
| E-07 | Nota de fornecedor com unidade absurda (`CX`, `FD6`, `PC`) gera multiplicação de massa | **Alta** | Médio | Fator de conversão obrigatório na 1ª ocorrência, validado por `validarConversao` — a desigualdade de conservação de massa de [unidades.ts](src/lib/unidades.ts) já existe justamente para isto |
| E-08 | Volume de XML estoura storage e custo do Supabase | Baixa | Médio | XML em bucket com lifecycle; staging particionado por mês; resumo em banco, documento em objeto |
| E-09 | **Token da Focus NFe hardcoded no código-fonte** (achado desta análise, ver §12) | — | **Alto** | Tratar antes da Onda 1 — a ingestão amplia a superfície de uso desse token |

---

## 11. Métricas do ERP

| Métrica | Meta |
|---|---|
| **% de notas de compra ingeridas automaticamente** (norte) | ≥ 85% em 60 dias de uso |
| Itens novos por nota, ao longo do tempo | curva decrescente até ≈ 0 na 4ª nota do mesmo fornecedor |
| Tempo humano por nota conferida | ≤ 90 s na 1ª, ≤ 15 s a partir da 3ª |
| Acerto do classificador NCM antes de correção | ≥ 90% em `INGREDIENTE`, ≥ 75% na fronteira |
| % da despesa total capturada no sistema | ≥ 80% (hoje: só o que passa por compra manual) |
| Contas a pagar criadas sem digitação | ≥ 90% das notas com duplicata |

---

## 12. Achado de segurança (fora do escopo, mas urgente)

Durante a leitura do módulo fiscal para este plano: os tokens da Focus NFe estão **hardcoded
como fallback** em [fiscal-emitir-nfce/index.ts:17](supabase/functions/fiscal-emitir-nfce/index.ts:17)
e [fiscal-cancelar-nota/index.ts:14](supabase/functions/fiscal-cancelar-nota/index.ts:14), e há
um token de homologação em [test_nfe.ts](test_nfe.ts) na raiz do repositório. Estão versionados
em git — rotacionar não basta se o histórico for público algum dia.

Não faz parte deste épico, mas a Onda 1 aumenta muito o uso desse token. Tratar antes.

---

## Fontes consultadas

- [SEFAZ — Web Service NFeDistribuicaoDFe](http://moc.sped.fazenda.pr.gov.br/NFeDistribuicaoDFe.html) — distribuição de DF-e ao destinatário
- [Focus NFe — API de Manifestação do Destinatário](https://focusnfe.com.br/manifestacao) · [documentação da API v2](https://focusnfe.com.br/doc/) — NF-e recebidas, MDe e download de XML
- [TecnoSpeed — Distribuição DFe e manifestação](https://blog.tecnospeed.com.br/distribuicao-dfe/) — janela de 90 dias e exigência de manifestação para o XML completo
- [Gov.br / Siscomex — NCM: resumo das seções e capítulos](https://www.gov.br/siscomex/pt-br/servicos/aprendendo-a-exportarr/planejando-a-exportacao-1/ncm-resumo-das-secoes-e-capitulos) · [Tabela NCM completa (MDIC)](https://www.gov.br/antaq/pt-br/assuntos/instalacoes-portuarias/Tabela_NCM_Completa.pdf)
