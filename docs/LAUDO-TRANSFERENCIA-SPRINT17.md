# MiseOn — laudo de transferência para a Sprint 18

**Data de corte:** 10/09/2026
**Origem:** Sprint 17 — engenharia de produção (Modo de Preparo, fator de correção, cocção e classificação que aprende)
**Destino:** Sprint 18 — a definir entre elegibilidade de pagamento (contrato herdado) e homologação da produção
**Branch de produção:** `main`
**Baseline transferida:** `6206120` (`origin/main` sincronizado, working tree limpo)
**Substitui:** [LAUDO-TRANSFERENCIA-SPRINT16.md](LAUDO-TRANSFERENCIA-SPRINT16.md), cujas pendências são reconduzidas aqui sem desconto

**Parecer:** a Sprint 17 está **PRONTA PARA REVISÃO**, não **ACEITA**. O código está versionado, publicado e com CI verde; as regras de domínio foram exercitadas com dados reais no tenant de provas. O que falta para o aceite é uso por um operador de cozinha real e a revisão independente. A Sprint 16 do contrato anterior (elegibilidade de pagamento) **não foi iniciada** — a prioridade foi deslocada pelo PO, e isso está registrado na seção 3 em vez de escondido.

---

## 1. Objeto da transferência

Este laudo entrega:

- a baseline implantada da engenharia de produção: Modo de Preparo, OS atômica, custo de conversão, fator de correção, perda de cocção, procedência do item e classificação que aprende;
- as evidências de repositório, CI, frontend, Edge Functions e banco de produção;
- o que **não** foi feito, incluindo o contrato da sprint anterior que segue intocado;
- os riscos residuais, com os herdados reconduzidos e os novos que eu mesmo introduzi;
- o backlog de dados que a mudança criou e que ninguém pode fingir que não existe;
- a ordem recomendada de execução e os critérios de aceite.

---

## 2. Estado efetivamente entregue

### 2.1 Evidências

| Camada | Evidência no corte | Resultado |
|---|---|---|
| Git | `HEAD == origin/main == 6206120`, working tree limpo | PASS |
| Commits | `96e5389`, `44643db`, `6206120` | PASS |
| CI/CD | runs `34412786059`, `34419402179`, `34421420045` — os três `success` | PASS |
| E2E Cypress | runs `34412786130`, `34419402213`, `34421420023` — os três `success` | PASS |
| Testes locais | 800 aprovados, 28 ignorados por dependência de ambiente | PASS com skips declarados |
| Typecheck / ESLint / build | `tsc -b`, `eslint . --max-warnings 0`, `npm run build` limpos | PASS |
| Frontend | `https://miseon.app.br/` respondeu HTTP 200 | PASS |
| Migrations | 8 aplicadas e registradas em produção (ver 2.3) | PASS |
| Edge Functions | `preparo-sugerir` v1 ACTIVE, `nfe-classificar-itens` v16 ACTIVE | PASS |
| Integridade da view `itens` | 187 itens = 187 insumos, nenhum desaparecendo no INNER JOIN | PASS |
| Sobrecargas de `fn_produzir_preparo` | exatamente 1, sem ambiguidade no PostgREST | PASS |
| Uso por operador real de cozinha | não houve | **NOT RUN** |
| Revisão independente | não houve | **NOT RUN** |

### 2.2 O que passou a existir

**Modo de Preparo.** A OS deixou de ser um cronômetro solto. Virou execução em tela cheia: mise en place conferida item a item (não libera o preparo sem conferir), roteiro passo a passo com cronômetro por etapa e aviso sonoro, cronômetro global da OS e conclusão até a etiqueta. O roteiro mora em `insumos.modo_preparo` (jsonb), com marcação de etapa em fogo/forno.

**Custo de conversão.** Gás e mão de obra apurados pelo tempo **MEDIDO** na bancada: gás = `botijão ÷ peso × consumo kg/h × minutos de chama`; mão de obra = `valor hora × tempo total`. `producoes_preparo.tempo_origem` distingue `MEDIDO` de `ESTIMADO`.

> **Decisão contábil, explícita e transferida:** gás e mão de obra ficam registrados na OS e **não** são capitalizados no custo do lote. `configuracoes_custo` já rateia esses custos no preço de venda (Cardápio/Financeiro); somar de novo no lote contaria o mesmo real duas vezes e inflaria o CMV. Quem quiser mudar isso tem de decidir primeiro se o rateio mensal sai do preço de venda — as duas coisas juntas é erro.

**Fator de correção (bruto × líquido).** `fichas_preparos.quantidade` é o BRUTO na unidade de estoque, e é o que custo e CMV contam — a loja pagou pela casca. `quantidade_liquida` é o que entra no preparo e passa a ser a base da nutrição. `rendimento_pct_aplicado` e `rendimento_origem` são snapshot: mudar a referência amanhã não altera ficha já fechada. `quantidade_informada`/`unidade_informada` preservam a intenção do lojista ("5 un" enquanto o banco guarda 0,600 kg).

**Domínio da técnica culinária, como dado.** 25 técnicas em `tecnicas_culinarias`; 73 fatores em `tecnicas_rendimento_ingrediente` (casados pelo nome, mesma mecânica do léxico); 16 em `tecnicas_rendimento_categoria`; e `insumos_tecnica_rendimento` para o que a loja mediu, com média móvel por número de amostras. `fn_rendimento_tecnica` resolve na ordem `MEDIDO_LOJA` > `REFERENCIA_INGREDIENTE` > `REFERENCIA_CATEGORIA` e devolve **nulo** quando não tem base — o sistema domina a técnica e não chuta.

**Perda e ganho de cocção.** É o segundo fator e não se mistura com o primeiro: correção é limpeza, por linha, sempre ≤ 100%; cocção é fogo, por lote, e pode passar de 100% (arroz rende 250%, frango assado 70%). Na OS a equipe pesa o lote pronto e **entra no estoque o que existe de fato**. `fn_rendimento_real_preparo` devolve o histórico das últimas 20 produções e a ficha confronta o lojista com o que a cozinha dele realmente entrega.

**Procedência do item.** O seletor separa Matéria-prima, Preparos da casa, Comprado pronto e Embalagens/descartáveis, cada grupo explicando o que significa. Item de revenda não oferece técnica de limpeza, e a tela orienta: quem rala o parmesão da geladeira faz uma ficha própria, que vira preparo da casa com custo de produção e lote rastreável.

**Classificação inteligente e que aprende.** Ordem de autoridade: NCM (verdade fiscal) > léxico do nome > catálogo de categoria > Outros. `classificacao_lexico` cobre limpeza, higiene, EPI, manutenção, embalagem e descartáveis (72 termos). A Edge Function da NF-e passou a receber o NCM de cada item, a carregar a taxonomia do banco (`fn_categorias_classificacao`) em vez de uma lista fixa, e a promover ao léxico o que classifica com confiança (`fn_aprender_termo_lexico`).

> **Regra do erro barato, transferida:** só categorias que **não** são matéria-prima podem ser aprendidas. Classificar limpeza como alimento é risco sanitário; o inverso apenas tira o item da ficha até alguém corrigir. Termo com menos de 4 caracteres, com número, ou já existente é recusado. Tudo auditável e reversível em `vw_lexico_aprendido`, com a descrição da nota que gerou o aprendizado.

### 2.3 Migrations aplicadas

| Arquivo local | Nome registrado em produção |
|---|---|
| `20260909210000_tomate_unidade_fisica_no_seed.sql` | `tomate_unidade_fisica_no_seed` |
| `20260909220000_producao_preparo_atomica.sql` | `producao_preparo_atomica` |
| `20260909230000_classificador_por_nome.sql` | `classificador_por_nome` |
| `20260909240000_custo_conversao_producao.sql` | `custo_conversao_producao` |
| `20260909250000_tecnicas_culinarias_fator_correcao.sql` | `tecnicas_culinarias_fator_correcao` |
| `20260909260000_perda_coccao_e_rendimento_real.sql` | `perda_coccao_e_rendimento_real` |
| `20260909270000_lexico_embalagem_e_descartavel.sql` | `lexico_embalagem_e_descartavel` |
| `20260909280000_lexico_aprende_com_a_ia.sql` | `lexico_aprende_com_a_ia` |

### 2.4 Defeitos corrigidos no caminho

Nenhum destes estava no escopo pedido; todos foram encontrados ao mexer no que estava em volta.

1. **`fn_produzir_preparo` em produção não custeava nada.** Inseria direto em `movimentacoes_estoque` e ajustava `quantidade_atual` na mão: o custo voltava nulo, o PEPS não consumia lote e o preparo entrava valendo **zero**. Agora a OS roda exclusivamente por `fn_movimentar_estoque`.
2. **Sobrecarga ambígua iminente.** A migration local declarava `(uuid, integer)` contra a `(uuid, numeric)` que já existia em produção — a chamada do PostgREST teria quebrado.
3. **`rendimento_porcoes` era `integer`.** Meio litro por lote virava 0 ou 1 em silêncio. Passou a `numeric(12,4)`, com as três views encadeadas e a trigger de cache nutricional recriadas.
4. **Insumos desaparecendo do sistema sem erro.** `classificacao_categorias` apontava para os tipos `OPERACIONAL` e `OUTROS`, que nunca existiram em `tipos_item`; como a view `itens` faz INNER JOIN, qualquer insumo nesses tipos sumia do almoxarifado e da ficha, calado. Os dois tipos passaram a existir.
5. **Material de limpeza como ingrediente de receita.** `fn_classificar_insumo` recebia `p_nome` e nunca usava. Corrigido por léxico versionado, e a tela passou a respeitar `entra_ficha_tecnica`, que já existia em `tipos_item`.
6. **Sacola como ingrediente.** A lista de categorias no prompt da IA era fixa e não tinha Embalagem, Higiene, Manutenção nem Utensílios — a IA não tinha como acertar.
7. **NCM sendo jogado fora.** O frontend tinha o NCM da nota em mãos e não o enviava à IA.
8. **Tour quebrado.** O passo 8 apontava para uma aba que deixou de existir.
9. **Etiqueta sem validade saía em branco** — ambiguidade perigosa numa cozinha. Agora imprime `NAO CONTROLADA`.
10. **`origin/HEAD` apontando para `master`** (P1 do laudo anterior) — corrigido.

### 2.5 Prova de ponta a ponta no tenant de provas

Ficha do exemplo do PO: 5 un de tomate (pele e semente, 78%) + 2 cebolas (descascar, 90%) + 10 g de sal.

```
Tomate    0,600 kg bruto → 0,468 kg limpo    R$ 5,34
Cebola    0,300 kg bruto → 0,270 kg limpo    R$ 1,95
Sal       10 g                                R$ 0,04
─────────────────────────────────────────────────────
Material (sobre o BRUTO)                      R$  7,33
Gás (43 min de chama medidos)                 R$  1,49
Mão de obra (66 min)                          R$ 10,00
Custo da OS                                   R$ 18,82
Nutrição sobre 748 g de LÍQUIDO (não 910 g)
Cocção: previstos 0,85 L, pesados 0,62 L = 72,94%
Histórico após 3 produções: média 81,96% (72,94% a 100%)
```

A nutrição contando líquido em vez de bruto elimina **22% de erro de caloria** que o cardápio publicava.

---

## 3. O que NÃO foi feito

Esta seção existe para que ninguém descubra por acidente.

### 3.1 Sprint 16A — elegibilidade de pagamento online: **NÃO INICIADA**

O laudo anterior contratou, como próximo incremento, garantir que intenção de pagamento, pendência, análise, recusa ou expiração não produzissem venda operacional (ticket, impressão, som, push, e-mail, receita, preparo). **Nada disso foi tocado.** A prioridade foi deslocada pelo PO para a engenharia de produção, o que é decisão legítima dele, mas o risco descrito naquele laudo continua inteiro e sem mitigação nova.

### 3.2 Sprint 16B — eventos e recuperação do iFood: **NÃO INICIADA**

Dependia da 16A e segue na fila.

### 3.3 Homologação da Sprint 17: **NÃO EXECUTADA**

O que foi exercitado foi SQL e regra de domínio, por mim, no tenant de provas. Ninguém abriu o Modo de Preparo numa cozinha, com as mãos sujas, para descobrir o que a tela esconde. Sem isso a sprint não é aceita.

---

## 4. Gates pendentes

### 4.1 Herdados da Sprint 15C — assinatura recorrente

Todos continuam abertos, e há evidência nova de que estão **mais** abertos do que o laudo anterior sugeria:

> `assinatura_notificacoes_efi` tem **0 registros** e há **0 lojas com `status_assinatura = 'ativa'`**. Nenhum evento real da Efí jamais chegou ao sistema. O ciclo recorrente nunca foi exercitado com dinheiro de verdade.

| Ordem | Ação | Dono | Evidência de conclusão |
|---|---|---|---|
| G1 | Revisar o diff `2f853bd`, a RPC `fn_assinatura_processar_evento_efi`, os privilégios de `service_role` e a UX de cancelamento | Revisor independente | parecer sem P0/P1 aberto |
| G2 | Executar uma assinatura mensal controlada no ambiente autorizado da Efí | Rafael + engenharia | correlação de assinatura, cobrança, fatura, período e evento |
| G3 | Reentregar o mesmo token/evento e confirmar efeito único | QA | contagens e período inalterados |
| G4 | Exercitar recusa, aprovação tardia e cancelamento | QA | estados coerentes, período pago preservado |
| G5 | Confirmar NFS-e e e-mail no caminho automático | Fiscal/operação | fatura, nota e recebimento correlacionados, sem segunda cobrança |
| G6 | Tornar a reconciliação da inbox operacional | Infra | monitor/cron autenticado, alerta para `erro`, procedimento de reprocessamento |

### 4.2 Novos — Sprint 17

| Ordem | Ação | Dono | Evidência de conclusão |
|---|---|---|---|
| H1 | Revisar o diff das três migrations de produção e das duas Edge Functions | Revisor independente | parecer sem P0/P1 aberto |
| H2 | Rodar uma OS real numa cozinha, do mise en place à etiqueta | Operador + Rafael | lote no estoque, etiqueta impressa, tempo medido coerente |
| H3 | Preencher gás e mão de obra em `configuracoes_custo` de uma loja real | Rafael | custo de conversão diferente de zero numa OS real |
| H4 | Pesar bruto/líquido de 3 insumos e confirmar que o medido vence a referência | Operador | `insumos_tecnica_rendimento` com `amostras > 1` e badge "medido na sua cozinha" |
| H5 | Importar uma NF-e real com item de limpeza/embalagem e conferir o aprendizado | Rafael | linha em `vw_lexico_aprendido` com a descrição de origem correta |
| H6 | Confirmar que a caloria do cardápio caiu onde havia técnica declarada | Fiscal/operação | comparação antes/depois num produto com preparo |

---

## 5. Riscos e pendências

### 5.1 P0 — antes de qualquer `supabase db push`

- **Drift de versão que eu introduzi.** As 8 migrations foram aplicadas pela Management API, que estampa o próprio timestamp: os nomes batem com os arquivos, mas as **versões registradas não** (ex.: o arquivo `20260909210000_...` está registrado como `20260909222349`). Um `db push` tentaria reaplicar os arquivos locais. O padrão já existia nas migrations de 05/09, então isto agrava um problema conhecido em vez de criar um novo. **Nada de `db push` sem inventário e reconciliação.**
- **O SQL aplicado difere dos arquivos em formatação** em três migrations (compactei valores de seed ao aplicar). É semanticamente idêntico, mas o **banco é o registro autoritativo** — quem for auditar deve ler `pg_get_functiondef`, não o arquivo.
- **`teste-relay-fiscal-rps` continua ACTIVE v5.** Era P0 no laudo anterior, descrito como desativado, e segue de pé. Confirmar dependência e remover a função temporária. Não reutilizar como API de produção.

### 5.2 P1 — durante a Sprint 18

- **Motor nutricional divergente.** A função em produção chama-se `fn_calcular_nutricao_receita`; o arquivo versionado do motor v2 define `fn_nutricao_de_linhas`, que **não existe no banco**. A alteração desta sprint foi cirúrgica (lê `pg_get_functiondef`, troca a expressão, reinstala, aborta em voz alta se a âncora sumir), mas o drift em si continua aberto e é uma armadilha para a próxima pessoa.
- **Instrumentar a inbox `assinatura_notificacoes_efi`:** idade do item, tentativas, último erro e alerta acionável. Herdado.
- **Runbook de reconciliação e rollback** sem apagar eventos, faturas ou evidência financeira. Herdado.
- **Actions dependendo de ações Node 20.** Herdado.
- **Chave DeepSeek exposta.** A `DEEPSEEK_API_KEY` apareceu em texto claro numa captura de tela durante a sprint. Rotacionar.
- **Worktree órfã.** `.claude/worktrees/vibrant-swirles-39cac4` está dentro do repositório, não é uma worktree registrada no git, e o vitest a varre — duplica falhas em execução local. Não afeta o CI. Identificar o dono antes de remover.

### 5.3 Backlog de dados criado pela mudança

Nenhum destes quebra nada hoje, porque todos têm fallback, mas todos degradam a precisão até serem tratados:

- **48 das 50 linhas de ficha não têm `quantidade_liquida`.** Contam bruto na nutrição até alguém declarar a técnica. O `coalesce` garante que nada quebra; a caloria fica alta.
- **0 rendimentos medidos pela loja.** Tudo roda em referência de mercado. O sistema só passa a ser "da casa" quando alguém pesar.
- **89 de 187 insumos estão na categoria genérica "Ingrediente".** Genérica demais para carregar fator de correção — por isso a resolução por nome é a que funciona hoje, e por isso o fallback por categoria quase nunca dispara.
- **Preços de embalagem sujos no tenant de provas** (cebola a R$ 4,99 por grama). Qualquer custo calculado ali sai absurdo. Não confundir com defeito de cálculo.
- **4 itens `(demo)` e 1 ficha `(demo)`** criados por mim no Lanche do Paulista para provar o fluxo. Descartáveis.

---

## 6. Ordem recomendada para a Sprint 18

A escolha entre A e B é do PO. Recomendo **A**, e explico por quê.

**Opção A — homologar a produção antes de abrir frente nova (recomendada).**
Executar H1–H6. O motivo: a Sprint 17 mexeu em custo, CMV e caloria publicada no cardápio. São números que o lojista usa para precificar e que o cliente lê na vitrine. Empilhar uma sprint de pagamento sobre isso sem uma única OS real rodada é acumular risco em duas frentes ao mesmo tempo. É também a sprint mais barata de fechar: depende de uma tarde de cozinha, não de código.

**Opção B — retomar o contrato da Sprint 16A.**
Elegibilidade de pagamento online. O risco descrito no laudo anterior é real e segue sem mitigação: pendência ou recusa não deveriam produzir venda operacional. Se o PO priorizar isto, a Sprint 17 fica em PRONTA PARA REVISÃO por mais um ciclo, e isso precisa ser aceito explicitamente.

Em qualquer um dos dois caminhos, antes do primeiro commit:

1. Fazer o inventário de migrations (§5.1) — é a dívida que mais provavelmente vai morder.
2. Resolver o `teste-relay-fiscal-rps`.
3. Rotacionar a chave DeepSeek.

---

## 7. Invariantes transferidas

Quem for mexer nesta área precisa preservar estas, sob pena de quebrar dinheiro ou saúde:

1. **Só as RPCs movem saldo, lote e custo.** `INSERT` direto em `movimentacoes_estoque` não move nada — foi exatamente esse o defeito da `fn_produzir_preparo` antiga.
2. **O custo conta o BRUTO; a nutrição conta o LÍQUIDO.** Trocar os dois é o erro clássico do food service.
3. **Gás e mão de obra ficam na OS, nunca no custo do lote.** O rateio mensal já cobra isso no preço de venda.
4. **Limpar não cria matéria.** Rendimento de limpeza é sempre ≤ 100%; só cocção pode passar de 100%.
5. **O medido pela loja vence qualquer referência.** E `nulo` é resposta legítima: o sistema não chuta rendimento.
6. **Material de limpeza, higiene, EPI e manutenção nunca entram numa ficha.** Não é filtro cosmético, é segurança alimentar.
7. **Comida nunca é aprendida pelo léxico automático.** O erro tem de ser barato em ambas as direções.
8. **A decisão do lojista (`classificacao_origem = 'USUARIO'` ou `classificacao_revisada`) nunca é sobrescrita** por regra automática.
9. **Entra no estoque o que foi pesado**, não o que a ficha prometia. O resto é estoque fantasma.
10. **Ler `pg_get_functiondef` antes de reescrever qualquer função.** A migração versionada pode estar defasada nos dois sentidos.
