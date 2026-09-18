# Auditoria inicial — MiseOn

**Data:** 18/09/2026 · **Commit:** `cc28974` · **Branch:** `main`
**Método:** leitura do repositório + medição direta na produção (Management API,
logs do Supabase, HTTP real contra `miseon.app.br` e contra o gateway do
projeto). Nada foi alterado: esta rodada é somente diagnóstico.

Convenção de resultado, para não confundir o que foi provado com o que foi
suposto: **MEDIDO** (executei e tenho o número), **LIDO** (está no código),
**BLOQUEADO** (não deu para verificar agora, com o motivo).

---

## 1. Resumo executivo

**O MiseOn está fora do ar neste momento, e não é bug de código.** O projeto
Supabase de produção responde `HTTP 402` em todas as portas — REST, Auth,
Storage e Edge Functions — com a mensagem `Service for this project is
restricted due to the following violations: exceed_egress_quota`. A
organização está no **plano free**.

Consequência prática: não entra pedido, não abre o cardápio público, não
carrega o KDS, **não dá para fazer login**, e o formulário de contato não grava
lead. O site em `miseon.app.br` continua respondendo `200` porque é estático na
Vercel — o que piora a situação: a vitrine está no ar vendendo um sistema que
não responde, e quem clicar em "Entrar" bate num erro.

O segundo achado é da mesma família: **ninguém foi avisado**. A queda já dura
no mínimo 24 horas e provavelmente cerca de três dias, e o sistema não tem
nenhum monitor que grite. A ausência de medição é o tema que atravessa quase
todos os problemas deste relatório.

O que este diagnóstico **não** encontrou é igualmente relevante: o código está
maduro. 546 testes passam, a infraestrutura de SEO é séria, as regras de
entrada fiscal estão corretas e travadas por teste, e as funções sensíveis do
banco checam papel antes de escrever. O gargalo do MiseOn hoje não é qualidade
de código — é **custo de infraestrutura, medição e disciplina de operação**.

---

## 2. Problemas críticos (P0)

### 2.1 Produção suspensa por cota de egress — MEDIDO

| Porta | Resultado |
|---|---|
| `/rest/v1/pub_produtos` (cardápio público) | **402** |
| `/auth/v1/token` (login do lojista) | **402** |
| `/functions/v1/*` | **402** |
| `/storage/v1/*` | **402** |
| `https://miseon.app.br/` (Vercel) | 200 |
| Banco via Management API | vivo, `ACTIVE_HEALTHY` |

O banco não caiu: o **gateway** é que está barrado por cobrança. Plano da org
`MaldivaSky Tech`: **free**.

**Janela da queda:** a suspensão foi registrada pela primeira vez em
**16/09** e continua hoje, 18/09 — **terceiro dia**. Último login
bem-sucedido em `auth.users`: 15/09 14:54. A janela de log disponível (24h)
já começa inteiramente em 402.

**Só o dono resolve.** Restaurar exige subir para Pro (ou liberar o teto de
gasto) no painel da Supabase, ou esperar a virada do ciclo de cobrança. É
decisão de dinheiro e não cabe a mim tomar.

### 2.2 O webhook do iFood está sendo martelado e devolvendo 402 — MEDIDO

Últimas 24 horas, por rota de Edge Function:

| Rota | Chamadas/24h | Status | Origem |
|---|---|---|---|
| `ifood-webhook` | **5.725** | 402 | iFood (`Go-http-client/2.0`) |
| `ifood-polling` | **1.440** | 402 | `pg_net` — cron de 1 em 1 minuto |
| outras | 2 | 402 | — |

Duas coisas aqui. Primeiro: o iFood exige `202` e **desativa o webhook após 72
horas de healthcheck falhando** (regra já registrada no `CLAUDE.md`). A queda
já pode ter consumido esse prazo — a integração pode precisar de nova
homologação. Segundo: `ifood-polling` roda **1.440 vezes por dia** por cron,
com ou sem loja no iFood. Isso é consumo contínuo de cota para um produto sem
volume.

### 2.3 Nada mede o funil — LIDO

Não existe analytics do site MiseOn. O único GA4 do código
(`src/components/SEO.tsx:135`) é injetado com o **ID do lojista**, para a loja
dele — não para `miseon.app.br`. Existe exatamente um evento de produto no
sistema inteiro (`kiosk_lead_submit`, em `KioskLeadForm.tsx:92`).

Isso significa que **nenhuma das perguntas da Fase 7 tem resposta hoje**:
quantas visitas, quantos cliques no CTA, quantos cadastros começados,
quantos terminados. Qualquer melhoria de conversão feita agora seria
inverificável — por isso instrumentar vem antes de mexer em copy.

---

## 3. Problemas de conversão

- **O contato nunca gravou um lead.** A tabela `leads` tem **zero linhas**
  (MEDIDO — `max(created_at)` é nulo). A correção via `registrarLead` está no
  código desde 17/09, mas não dá para provar que funciona com a API em 402.
  Primeira coisa a validar quando o serviço voltar.
- **A promessa de "30 dias sem cartão" tem lastro** (`lojas.trial_termina_em`
  existe e `src/lib/assinatura.ts` avalia) — mas o corte é **só no frontend**
  (`AdminLayout.tsx:187`). Não há bloqueio no servidor quando o trial vence.
  Hoje é inofensivo (não há assinante pagante); no dia em que houver, é receita
  escapando.
- **Sem prova social, e corretamente**: não há depoimento inventado no site.
  Falta a estrutura pronta para receber o primeiro caso real.

---

## 4. Problemas de UX

- **Acessibilidade por amostragem** (MEDIDO): em `PDV.tsx`, `KDSExpeditor.tsx`
  e `Cardapio.tsx` há **39 botões e nenhum `aria-label`**. No projeto todo:
  883 `<button>` para 75 `aria-label`. Em telas de operação — cozinha,
  balcão — isso também é usabilidade sob pressão, não só acessibilidade.
- **Foto de produto sem `loading="lazy"`, `width` nem `height`**
  (`src/lib/fotoProduto.tsx:34`). O componente resolve bem o caso difícil
  (timeout de imagem externa, medido em 03/09), mas deixa o layout pular.
- **Componentes mortos**: `src/components/home/Hero.tsx` e `HeroSection.tsx`
  não são importados por ninguém — o hero vivo está em `Home.tsx:895`.

---

## 5. Problemas de SEO

Poucos, e nenhum crítico. A infraestrutura aqui está acima da média: prerender
de 40+ páginas, sitemap derivado de fonte única (`scripts/public-routes.mjs`,
inclusive lendo os slugs do blog), `robots.txt` com política explícita para
LLMs, JSON-LD de Organization e SoftwareApplication, canonical nas rotas
duplicadas, `ads.txt`.

O risco real de SEO hoje é **reputacional**: páginas indexadas apontando para
um app que devolve 402. Quanto mais tempo assim, pior.

---

## 6. Problemas de performance

| Medição | Valor |
|---|---|
| Chunk de entrada | **762 KB** |
| JS total no `dist` | **5,2 MB** |
| `OrbitControls` (three.js, página de estoque 3D) | 546 KB |
| `ScannerQRCodeModal` | 482 KB |
| `setInterval` no código | 24 |
| Bucket `loja-assets` | 82 MB / 38 objetos |
| Maior imagem | **16 MB** (PNG, banner) |

Dois pontos ligados diretamente ao P0:

1. **Cinco banners PNG de 10 a 16 MB** no tenant de provas (`lanchepaulista`),
   subidos em 15/07 — antes do limite de 1600px que hoje existe em
   `ImageUpload.tsx:24`. Um banner de 16 MB servido a um visitante é ~0,3% da
   cota mensal gratuita de uma vez só.
2. **Polling que não dorme**: KDS recarrega a cada 60s, Entregas a cada 15s,
   Painel de TV em laço próprio — telas que ficam abertas o dia inteiro. Com
   34 pedidos em 14 dias, o sistema gasta muito mais banda perguntando do que
   respondendo.

O proxy de imagem (`api/img.ts` + `src/lib/cdn.ts`) está bem feito e cobre as
telas de cliente. Ele não é o problema; o tamanho dos arquivos de origem e a
frequência das consultas são.

---

## 7. Problemas de segurança

O que está **bom** (MEDIDO): 107 tabelas, **todas** com RLS ligado. Nenhuma
função `SECURITY DEFINER` sem `search_path` fixo. As funções de escrita
expostas ao `anon` que li — `fn_reconciliar_estoque`,
`fn_definir_classificacao_insumo`, `fn_liberar_cartao_online` — **checam
`fn_tem_papel` antes de gravar**. A regra do `CLAUDE.md` está sendo cumprida.

O que precisa de conferência:

| Item | Situação |
|---|---|
| `lojas_publicas` | View **SECURITY DEFINER**, legível por `anon` — ignora RLS |
| `vw_insumos_custo_suspeito` | View **SECURITY DEFINER**, legível por `anon` — e é view de **custo** |
| 21 de 24 views | legíveis por `anon` (as outras 19 são `security_invoker`, dependem do RLS de baixo) |
| 36 funções `SECURITY DEFINER` | executáveis por `anon` |
| 13 tabelas com RLS e **zero policy** | nega tudo por padrão — parece proposital (acesso via função), mas não está documentado |
| Proteção contra senha vazada | **desligada** (advisor do Supabase) |

**RESOLVIDO em 18/09, depois da restauração do serviço.** O teste com a chave
anônima rodou. Resultado, medido:

| View | Resposta ao anônimo |
|---|---|
| `vw_insumos_custo_suspeito` | **bloqueada** (`permission denied for function fn_custo_unitario_insumo`) |
| `meus_cartoes` | **bloqueada** (`permission denied for table cartoes_salvos`) |
| `vw_custo_real_estoque`, `vw_dre_mensal`, `vw_caixa_extrato`, `vw_historico_precos_compra`, `vw_ultimo_custo_insumo`, `vw_insumo_giro` | 0 linhas (RLS segurou) |
| `lojas_publicas` | 3 linhas — é o diretório público de lojas, correto |
| **`vw_lucro_real_produto`** | **121 de 121 linhas** — as 8 lojas de uma vez |

A que vazava não era nenhuma das suspeitas: era `vw_lucro_real_produto`, com
`anon=arwdDxtm` na ACL e colunas `custo_real`, `receita_real`,
`resultado_exercicio`, `lucro_real`, `margem_pct`.

**Sem exagerar a gravidade:** nenhum valor financeiro vazou. Todas as colunas de
dinheiro voltam zero para qualquer um, inclusive para o `postgres` — o join liga
`lf.referencia_id` (que é um PEDIDO, pelo próprio `referencia_tipo = 'PEDIDO'`) a
`p.id` (um PRODUTO), e isso nunca casa. A view está quebrada desde que nasceu, e
o que saía era nome e preço, que já são o cardápio público. Escrita era
impossível (view com `GROUP BY` não é atualizável).

Fechada assim mesmo (`20260918180000_view_de_lucro_sai_da_api_publica.sql`): é
superfície financeira aberta por descuido, que viraria vazamento de verdade no
dia em que o join fosse corrigido. Conferido depois: anônimo recebe
`permission denied`, cardápio público segue 200. A view está órfã (nenhum
arquivo em `src/` a consulta) e sucedida por `vw_margem_produto_real` — **DROP é
decisão do dono**, registrada aqui em vez de feita calada.

---

## 8. Problemas de acessibilidade

Ver §4. Resumo: rótulo acessível é exceção, não regra (75 para 883 botões), e
as telas de operação são as piores. Não medi contraste nem navegação por
teclado com ferramenta — seria afirmação sem prova.

---

## 9. Problemas técnicos

- **Raiz do repositório com entulho**: `test_nfe.ts`, `test-ia.cjs`,
  `test-insert.cjs`, `test-produtos.cjs`, `enable-ia.cjs`, `lint_output.txt`,
  `lint_full.txt`, `git_diff_head.diff`, `git_log_recent.diff`,
  `animation_1.mp4`, `logo.png` (o próprio `CLAUDE.md` diz que é antigo e não
  deve ser usado), `scratch/`, `coverage/`.
- **Documentação inflada**: 40+ arquivos em `docs/`, vários planos sobrepostos
  (`PLANO-ERP`, `PLANO-PRODUTO`, `PLANO-LANCAMENTO-*`, cinco HANDOFFs, três
  LAUDOs). Encontrar a decisão vigente custa caro.
- **265 migrations**, com o aviso já conhecido de que produção pode divergir da
  versão em disco nos dois sentidos.

---

## 10. Oportunidades de diferenciação

Baseadas no que o código realmente faz — não em desejo:

1. **Entrada fiscal com origem e confiança.** `parseNFeXml.ts` separa
   `qCom`/`uCom`/`vUnCom`/`vProd` corretamente, lê NCM como classificador
   determinístico, e **isso está travado por teste de fixture**
   (`__tests__/parseNFeXml.test.ts`, incluindo os dois casos do mandato:
   20 KG × 18,90 = 378 e 10 CX × 50). A cascata
   `USUARIO > CATALOGO > RENDIMENTO > DESCRICAO > IA` garante que a correção do
   lojista nunca é sobrescrita por leitura automática. **Concorrente nenhum
   vende isso, porque quase ninguém faz.**
2. **Custo que admite não saber.** `fn_custo_unitario_insumo` devolve veredito
   de confiança, e margem incerta vem nula com o motivo em vez de um
   percentual inventado. É argumento comercial forte para quem já foi enganado
   por relatório bonito.
3. **Ferramentas grátis + blog** (`/ferramentas`, 3 calculadoras, sem depender
   do banco) já são um motor de captação pronto — e continuaram no ar durante a
   queda, justamente por não dependerem do Supabase.

O posicionamento que o produto sustenta hoje: **controle de custo e estoque
real a partir da nota fiscal**, não "mais um sistema de pedidos".

---

## 11. Backlog priorizado

| # | Item | Impacto | Esforço | Risco | Depende de |
|---|---|---|---|---|---|
| 1 | Restaurar o serviço (Pro ou teto de gasto) | Crítico | — | — | **Decisão do dono** |
| 2 | Monitor externo de saúde com alerta | Alto | Baixo | Baixo | — |
| 3 | Confirmar `vw_insumos_custo_suspeito` e `lojas_publicas` com chave anônima | Alto | Baixo | Baixo | #1 |
| 4 | Provar que `/contato` grava lead | Alto | Baixo | Baixo | #1 |
| 5 | Verificar estado do webhook iFood (72h) | Alto | Baixo | Médio | #1 |
| 6 | Comprimir os 5 banners de 10–16 MB | Alto | Baixo | Baixo | #1 (Storage em 402) |
| 7 | Reduzir/parar `ifood-polling` sem loja ativa | Alto | Baixo | Médio | — |
| 8 | Analytics do funil (eventos da Fase 7) | Alto | Médio | Baixo | — |
| 9 | ~~Backoff no polling quando a aba está oculta~~ | Médio | Baixo | Baixo | **feito 18/09** |
| 9b | Realtime de entregas sem filtro por loja | Médio | Médio | Médio | schema |
| 10 | `aria-label` nas telas de operação | Médio | Médio | Baixo | — |
| 11 | Bloqueio de trial vencido no servidor | Médio | Médio | Médio | — |
| 12 | Limpar raiz do repositório | Baixo | Baixo | Baixo | — |
| 13 | Consolidar `docs/` numa fonte vigente | Baixo | Médio | Baixo | — |

---

## 12. Cinco primeiros experimentos

Nenhum experimento de conversão faz sentido antes do #1 — sem medição, o
resultado não é legível.

1. **Instrumentar o funil** (`view_home`, `click_cta_principal`,
   `start_signup`, `complete_signup`, `create_first_product`,
   `create_first_order`). Sem dado pessoal no evento.
2. **CTA do hero**: "Começar agora" contra "Ver como funciona" — hoje o botão
   principal manda direto para cadastro, sem etapa de convencimento.
3. **Preço acima da dobra** na home, contra preço no fim da página.
4. **Ferramenta grátis como porta de entrada**: medir quantos saem de
   `/ferramentas/calculadora-cmv` para o cadastro. Já existe tráfego potencial
   ali e nenhuma medição.
5. **Prova real no lugar da promessa**: substituir uma afirmação genérica da
   home por um print do sistema com dado do `lanchepaulista`.

---

## 12-A. O que foi executado em 18/09, sem esperar o gateway

A Management API **não** está bloqueada — só o gateway (REST/Auth/Storage/
Functions). Isso abriu espaço para atacar a causa do consumo enquanto a
decisão de plano não sai.

**1. O cron do iFood parou de gastar requisição contra parede.**
Migration `20260918150000_cron_do_ifood_respeita_o_disjuntor.sql`, aplicada em
produção. O freio de 30 minutos já existia dentro da edge function; o cron
pagava a requisição só para ouvir "estou em espera". Agora ele lê
`integracao_ifood_saude` **antes** de gastar, e grava a própria tentativa —
necessário porque, com o gateway em 402, a função nunca responde e nunca
atualizaria `proxima_tentativa_em` sozinha.
Baseline medido antes: **1 chamada HTTP por minuto, todo minuto**
(`net._http_response`). Esperado no estado atual (`SEM_PERMISSAO`, 64 falhas
seguidas): ~48/dia em vez de 1.440.

**2. Três telas de operação pararam de consultar em aba de fundo.**
`KDS.tsx` (60s), `Entregas.tsx` (15s) e `PainelTV.tsx` (4s no modo senha).
Todas voltam a buscar na hora em que a aba reaparece — o padrão que
`Pedido.tsx` e `MeusPedidos.tsx` já usavam. O Painel de TV **desacelera para
30s em vez de parar**, de propósito: se algum receptor relatar `hidden` na
parede, parar deixaria o cliente esperando uma senha que não chega.
Os pollers de pagamento (Pix no PDV, Totem, Assinatura, `PagamentoStatus`)
**não** foram tocados — são curtos e o cliente está esperando na frente.

**3. Passou a existir alarme.** `.github/workflows/saude-producao.yml` bate de
hora em hora na vitrine, no cardápio público (REST) e no Auth. Falhou, o
GitHub manda e-mail. Custa zero e resolve o problema de fundo: esta queda durou
três dias porque ninguém foi avisado.

**Não foi feito, com motivo:** comprimir os cinco banners de 10–16 MB (Storage
em 402); filtrar o Realtime de entregas por loja — `localizacao_entregador`
**não tem `loja_id`** (só `pedido_id`, `entregador_id`, `lat`, `lng`,
`atualizado_em`), então o filtro exige mudança de schema e teste com o canal
de pé; estreitar os 83 `select('*')`, que sem banco vivo é mexer no escuro.

---

## 12-B. Lote 1 executado — 18/09, depois do Pro

O plano Pro foi assinado no fim da tarde de 18/09 e o serviço voltou. O Lote 1
saiu inteiro no mesmo dia.

| # | Item | Resultado |
|---|---|---|
| 1 | Restaurar o serviço | **feito pelo dono** — REST, Auth e Storage em 200 |
| 2 | Monitor com alerta | workflow horário no ar, simulado nas 3 portas |
| 3 | Teste anônimo nas views | **feito** — achou e fechou `vw_lucro_real_produto` (§7) |
| 4 | Provar que `/contato` grava lead | **funciona**: HTTP 201 pelo caminho real; anônimo não lê o CRM; linha de teste apagada |
| 5 | Webhook do iFood | **não foi desativado** — e achou-se coisa pior (abaixo) |
| 6 | Banners de 10–16 MB | resolvido por transformação, sem tocar nos arquivos |

**O achado mais caro do dia não estava no plano.** Com o serviço de volta, os
logs mostraram o webhook do iFood respondendo **HTTP 200** aos healthchecks. O
iFood só registra presença com **202**; 200 não gera heartbeat nenhum, e
healthcheck falhando por 72h **desativa o webhook**.

O conserto já existia (`e660c91`, 01/09). Duas noites depois, `711b294` — um
commit de UI sobre screenshots nos cards de nicho — trouxe a linha de volta para
200 e deixou intacto o comentário de quinze linhas explicando que tem de ser
202. O comentário mentiu por duas semanas.

Corrigido, publicado a partir do disco (versão 59) e conferido ao vivo: **202
nas três variantes de healthcheck**. Vai com teste de regressão
(`__tests__/ifood-webhook-202.test.ts`) — o módulo chama `serve()` no topo e não
dá para importar, então o teste lê a fonte e trava as três coisas que importam.
Comentário não segura código.

**Privilégios do Pro já aproveitados:**

- **Transformação de imagem** no proxy (`api/img.ts`). Medido no maior banner:
  16.772.595 → 4.999.288 (width=1600, q=75) → **307.898 bytes com WebP**. 98% a
  menos, sem tocar em nenhum objeto, valendo para tudo que subir daqui em
  diante. Com queda para o objeto cru se a transformação falhar.
- **Proteção contra senha vazada** ligada (`password_hibp_enabled`), que antes
  devolvia 402 por ser recurso pago. Os avisos de segurança caíram de 7 para 6.

**A conferir amanhã:** se o backup diário apareceu de verdade. Foi olhando que
se descobriu, em 19/08, que não existia nenhum.

---

## 13. Plano dos três primeiros lotes

### Lote 1 — Voltar ao ar e provar que voltou
**Objetivo:** produção respondendo e ninguém mais descobrindo queda por acaso.
**Depende de:** decisão do dono sobre o plano da Supabase.
**Arquivos:** nenhum de produto; monitor novo + `docs/`.
**Aceite:** `/auth/v1/token` e `/rest/v1/pub_produtos` em 200; teste anônimo
contra as duas views DEFINER executado e registrado; `/contato` grava lead;
estado do webhook iFood conferido no portal.
**Risco:** baixo — leitura e verificação.

### Lote 2 — Parar de sangrar cota
**Objetivo:** o consumo parar de crescer sozinho, sem loja nova.
**Escopo:** comprimir os cinco banners de 10–16 MB; `ifood-polling` só roda com
loja iFood ativa; polling do frontend com backoff quando a aba está oculta
(`document.hidden`).
**Arquivos:** `supabase/functions/ifood-polling/`, cron `coletar-eventos-ifood`,
`KDS.tsx`, `Entregas.tsx`, `PainelTV.tsx`, objetos do bucket.
**Aceite:** invocações/dia de `ifood-polling` caem a zero sem loja ativa;
nenhum objeto acima de 1 MB no bucket; KDS com aba oculta não consulta.
**Não-escopo:** trocar a arquitetura de realtime.
**Risco:** médio — mexe em integração viva. Cada mudança entra sozinha, com
medição antes e depois.

### Lote 3 — Passar a enxergar
**Objetivo:** responder "quantos entram, quantos cadastram, quantos ativam".
**Escopo:** os seis eventos do experimento #1, sem dado pessoal, com
consentimento respeitado (a infraestrutura de consentimento já existe em
`src/lib/adsense.ts` e `cmpTcf.ts`).
**Aceite:** funil visível de `view_home` a `create_first_order`;
`docs/plano-analytics.md` com gatilho e propriedade de cada evento.
**Risco:** baixo.

---

## Estado da validação desta rodada

| Verificação | Resultado |
|---|---|
| `npx vitest run` | **PASS** — 546 passaram, 17 pulados, 0 falhas (56 arquivos, 9 pulados) |
| Medição na produção via Management API | PASS |
| Teste de vazamento com chave anônima | **BLOQUEADO** — gateway em 402 |
| `npm run build` | **NÃO EXECUTADO** nesta rodada |
| Cypress / carga / E2E | **NÃO EXECUTADOS** |

Nenhum arquivo de código foi alterado. Nenhum dado de produção foi gravado.
