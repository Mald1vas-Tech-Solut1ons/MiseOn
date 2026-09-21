# Auditoria CTO — lógica, regras de negócio e prontidão comercial

**Data:** 20/09/2026  
**Escopo:** frontend, Edge Functions, migrations, funções reais de produção,
RLS, dados da loja de teste e percursos autenticados sem gravação.

## Decisão

**NÃO APROVADO para venda self-service neste estado.**

Uso aceitável: piloto assistido, com escopo explícito e sem prometer iFood
operacional, WhatsApp conectado, pizza meio a meio ou margem confiável antes da
correção e da nova homologação.

Não existe base honesta para uma garantia de funcionamento integral. Existe
base para afirmar que a aplicação compila, a suíte disponível passa e vários
controles importantes estão no servidor. Também existem falhas confirmadas que
podem causar pedido invisível, cobrança incorreta, abandono de pagamento e
informação comercial enganosa.

## Evidência executada

- TypeScript aprovado.
- Vitest: 558 testes aprovados, 17 ignorados, 9 arquivos ignorados.
- Build Vite aprovado; alerta de bundle inicial acima de 600 kB.
- Prerender: 32 rotas. Sitemap: 30 URLs.
- Todas as tabelas verificadas de `public` estão com RLS.
- Views financeiras usuais estão com `security_invoker=true`; prova anônima
  retornou zero linhas. O vazamento inicialmente suspeitado não se confirmou.
- Security Advisor: 3 erros de view `SECURITY DEFINER`, 36 avisos de função
  privilegiada para `anon`, 79 para `authenticated` e 3 `search_path`
  mutáveis.
- Varredura oficial de integridade executada em produção, somente leitura.

## Falhas críticas confirmadas

### CTO-C1 — PDV sem catálogo

O PDV publicado mostra “Nenhum produto encontrado”, enquanto a mesma loja tem
17 produtos disponíveis no banco, no cardápio administrativo e na vitrine.
`src/pages/admin/PDV.tsx:103` ignora o objeto `error` e converte falha em
lista vazia.

**Impacto:** impede venda de balcão.  
**Correção:** separar a consulta, exibir erro e criar E2E autenticado.  
**Aceite:** 17/17 produtos visíveis na loja de teste.

### CTO-C2 — divisão por assento multiplica preço

`PainelGarcomMobile.tsx:169-186` divide o preço e insere um item por assento.
A função real `fn_validar_item_pedido_catalogo` substitui o preço de cada item
pelo preço integral do catálogo.

**Impacto:** cobrança indevida.  
**Correção:** representar participantes sem replicar o preço e usar RPC
transacional.  
**Aceite:** R$ 40 dividido por 4 continua totalizando R$ 40.

### CTO-C3 — cashback integral deixa pedido invisível

O checkout cria Pix/crédito em `AGUARDANDO_PAGAMENTO`. A função real
`fn_quitar_pedido_cashback` marca o pagamento como `PAGO`, mas muda o pedido
para `ACEITO` apenas se ele estiver `NOVO`.

**Impacto:** cliente vê sucesso; cozinha não recebe o pedido.  
**Correção:** aceitar os dois estados na mesma transação.  
**Aceite:** pedido `ACEITO`, pagamento `PAGO`, estoque baixado uma vez.

### CTO-C4 — cancelamento de falha do gateway é ineficaz

`CheckoutDrawer.tsx:279-282` e `Cardapio.tsx:374-378` tentam updates diretos.
As policies permitem leitura, não update do cliente, e o helper ignora erros.

**Impacto:** pedidos e pagamentos pendentes abandonados.  
**Correção:** RPC do cliente, limitada ao próprio pedido e aos estados pendentes.  
**Aceite:** falha simulada no gateway não deixa órfãos.

### CTO-C5 — iFood indisponível

Produção mostra “Vinculado, sem receber”, com 131 tentativas seguidas e HTTP
403.

**Impacto:** canal prometido não opera.  
**Correção:** liberar módulos no portal e homologar polling/webhook.  
**Aceite:** cinco pedidos consecutivos, sem 403 nem duplicidade.

### CTO-C6 — acompanhamento público expõe dados pelo UUID

`fn_acompanhar_pedido(uuid)` é privilegiada, executável por `anon` e devolve
identificador do cliente, endereço, itens, valores e pagamento. Não há token
separado de acompanhamento.

**Impacto:** exposição de PII se o UUID vazar.  
**Correção:** token aleatório, expirável/revogável, e payload mínimo.  
**Aceite:** UUID sem token retorna 401/404.

## Falhas altas confirmadas

### CTO-A1 — fechamento de mesa não é atômico

`Mesas.tsx:274+` grava pagamento, altera total, finaliza pedidos e fecha a
comanda em chamadas independentes. `GarcomMesaDrawer.tsx:76+` não verifica os
erros antes de imprimir.

**Correção:** uma RPC idempotente e transacional.  
**Aceite:** falha injetada em qualquer etapa faz rollback integral.

### CTO-A2 — saldo inclui pagamento não pago

As consultas de `Mesas.tsx:124` e `:244` trazem só `valor_pago`; o cálculo
em `:267` soma PAGO, PENDENTE e CANCELADO.

**Correção:** saldo autoritativo, somando apenas `PAGO`.  
**Aceite:** registros não pagos nunca reduzem a dívida.

### CTO-A3 — onboarding coleta e não configura

O cadastro coleta salão, entrega e equipe, mas a Edge Function cria uma loja
mínima, não chama `fn_semear_loja` e não configura módulos. O wizard é
estático.

**Correção:** persistir perfil e gerar trilha específica.  
**Aceite:** salão recebe mesas/equipe; delivery recebe localização/taxa.

### CTO-A4 — segunda unidade bloqueada

A Edge Function retorna conflito para usuário que já tem qualquer vínculo. O
seletor local troca vínculos existentes, mas não cria a segunda unidade.

**Correção:** regra de plano e fluxo “Adicionar unidade”.  
**Aceite:** criar, alternar e isolar duas lojas.

### CTO-A5 — dados de demonstração contradizem custo/estoque

Na loja de teste foram encontrados:

- 2 insumos cujo saldo não bate com os lotes;
- 1 lote com custo em escala incompatível;
- 1 embalagem incompatível com o rendimento;
- 5 produtos disponíveis sem ficha técnica.

Seeds de demonstração também contêm dezenas de custos não confiáveis.

**Correção:** reconciliar pelo ponto único de estoque/custo e corrigir seeds.  
**Aceite:** zero achado ALTO na varredura e zero produto demonstrado sem ficha.

### CTO-A6 — saúde de integração inconsistente

Dashboard marca iFood/WhatsApp como concluídos, enquanto as telas reais mostram
WhatsApp desconectado e iFood em 403. Há correção local, ainda não publicada.

**Correção:** saúde real como fonte única e publicação após os gates.  
**Aceite:** desconectado/403 nunca aparece como “Feito”.

### CTO-A7 — promessa pública excede a evidência

As landings exibem “100%”, “zera em menos de 24 horas”, “único”, “milhares” e
“dados reais de uma loja usando a integração”. Não há cliente pagante medido e
o iFood não recebe.

**Correção:** remover absolutos/números sem fonte e declarar dependências.  
**Aceite:** auditoria de corpo/metadados com zero alegação sem fonte.

### CTO-A8 — importação da nota podia multiplicar o custo por 1.000

Ao vincular uma linha da nota a um insumo existente com unidade diferente, a
interface usava fator `1` quando a unidade sugerida não era igual à unidade do
cadastro. O caso confirmado na loja de teste — cenoura comprada em `kg` e
controlada em `g` — é compatível com o lote de R$ 5,48 por grama encontrado na
varredura, em vez de aproximadamente R$ 0,00548 por grama.

**Correção local implementada:** `resolverFatorImportacao` aplica primeiro a
conversão física/documental (`kg→g`, `L→ml`, conteúdo como `20UN`), usa histórico
confirmado somente quando a nota não prova a conversão e devolve fator zero
quando não há evidência. A tela bloqueia a importação até o lojista informar o
fator. O valor deixou de cair silenciosamente para `1` no payload.

**Prova automatizada:** testes para kg→g, L→ml, embalagem de 20 unidades,
histórico e bloqueio do caso desconhecido.

**Limite:** a correção ainda não está publicada e não corrige lotes antigos.
Eles exigem reconciliação assistida e trilha de auditoria; não devem ser
reescritos automaticamente.

## Proposta CTO — motor inteligente de custo e rastreio

### Princípio

O sistema deve ser inteligente para **explicar e impedir erro**, não para
inventar um número plausível. Regra determinística decide dinheiro; IA extrai,
classifica e propõe. A confirmação humana vira evidência versionada e passa a
ter precedência sobre qualquer automação futura.

### 1. Entrada fiscal orientada por evidência

Criar um pipeline explícito:

`item bruto imutável → normalização → candidatos → simulação de impacto → confirmação → lançamento → aprendizado`.

Cada decisão de unidade/fator deve carregar `origem`, `confiança`, evidências e
versão da regra. Ordem recomendada:

1. unidade fiscal e conversão dimensional;
2. conteúdo escrito na embalagem;
3. de-para confirmado por loja + fornecedor + GTIN/código do item;
4. catálogo determinístico;
5. sugestão de IA;
6. confirmação do usuário.

Antes de gravar, a tela deve mostrar: “1 kg = 1.000 g; entram 1.000 g; custo
R$ 0,00548/g; estes produtos e margens serão afetados”. Conversão sem evidência
ou custo fora da faixa histórica fica bloqueado, não apenas destacado.

### 2. Detector de anomalias antes do dano

Executar, ainda na prévia:

- coerência `quantidade × unitário = total` e reconciliação com o total da nota;
- dimensão da unidade e escala 10×/100×/1.000×;
- comparação com última compra, mediana robusta e faixa por fornecedor;
- embalagem × rendimento e saldo × lotes;
- duplicidade por chave fiscal e idempotência do lançamento;
- impacto sobre produtos, CMV e margem.

Com pouco histórico, usar regra e catálogo; somente após amostra suficiente,
usar mediana/MAD por loja e fornecedor. O objetivo mensurável é **zero
aprovação automática de anomalia crítica**.

### 3. Custo 3D v2 — explicação, confiança e tempo

Hoje o Custo 3D reconstrói uma cadeia a partir do estado dos lotes e dos fatores
atualmente cadastrados. Isso conserva o valor matemático, mas não prova que cada
transformação ocorreu naquela data. A interface foi corrigida localmente para
chamar isso de conversão cadastrada, não de histórico imutável, e agora também
recarrega quando um fator muda.

Para virar diferencial defensável, evoluir para:

- ledger imutável de eventos de custo/estoque, com pai, origem e idempotência;
- linha do tempo e “viajar no tempo” para reproduzir o custo de uma data;
- botão “por que custa isso?” com nota, lote, fator, preparo e consumo;
- selo de confiança por nó e valor cinza/nulo quando não confiável;
- comparação antes/depois e produtos/margens afetados;
- reconciliação guiada, reversível, sem apagar o evento original.

### 4. Rastreio 3D v2 — localização e decisão operacional

Hoje o Rastreio organiza insumos por setor, mostra origem do custo, alertas e
capacidade de receita. Ainda deriva setor por heurística quando o cadastro não
informa e expande preparo dentro de preparo apenas um nível.

Evolução recomendada:

- hierarquia física `unidade → setor → equipamento → prateleira → posição`;
- QR por lote/posição, validade e FEFO/PVPS;
- movimentos reais entre locais, inventário cíclico e mapa de divergência;
- expansão recursiva de preparos até 5 níveis, com detecção de ciclo;
- cobertura em dias, previsão de ruptura e gargalo por receita;
- ações no próprio alerta: contar, transferir, corrigir, produzir ou comprar.

O 3D deve ser uma camada de decisão. Se a mesma decisão ficar mais clara em
lista, o sistema oferece lista; o canvas nunca pode esconder uma inconsistência.

### 5. Modelo mínimo de eventos

Um ledger `estoque_eventos`/`custo_eventos` precisa ligar:

`nota_item → compra → lote → transformação/preparo → venda → perda/ajuste`.

Campos mínimos: loja, tipo, data efetiva, quantidade/unidade, custo, origem,
confiança, `evento_pai_id`, `idempotency_key`, documento de origem, usuário,
motivo e reversão. O saldo permanece cache derivado; o ledger é a autoridade.

### 6. Métricas de inteligência

- tempo mediano para importar uma nota;
- percentual autoaprovado e percentual corrigido pelo usuário;
- falso positivo e, principalmente, falso aceite de anomalia crítica;
- divergência saldo × lotes;
- percentual do estoque e das fichas com custo confiável;
- tempo para explicar um custo até a nota de origem;
- erro da previsão de ruptura e perda por validade;
- impacto de correções sobre margem antes da confirmação.

### Sequência de entrega

| Fase | Entrega | Critério de saída |
|---|---|---|
| P0 | correção de fator; fila de inconsistências; bloquear margem não confiável | nenhum fator desconhecido vira 1; loja de teste sem achado ALTO |
| P1 | item fiscal bruto, evidência/confiança, prévia de impacto e aprendizado versionado | importação repetida exige menos correções sem aumentar falso aceite |
| P2 | ledger imutável e Custo 3D baseado em eventos | qualquer custo é reproduzível até a nota/lote |
| P3 | localização, QR, FEFO e Rastreio recursivo/previsão | inventário e ruptura medidos em operação piloto |

## Segurança — conclusão precisa

- **Confirmado como bom:** RLS nas tabelas; views financeiras verificadas usam
  `security_invoker`; anônimo recebeu zero linhas.
- **Pendente:** Advisor acusa `lojas_publicas`,
  `plataforma_pagamento_publico` e `vw_insumos_custo_suspeito` como
  `SECURITY DEFINER`. As duas primeiras são públicas por projeto; a de custo
  rejeitou o anônimo com 401, mas deve migrar para `security_invoker` com
  predicado explícito.
- **Pendente:** 36 funções privilegiadas para anônimo e 79 para autenticado
  exigem allowlist documentada. O número não prova vulnerabilidade;
  `fn_acompanhar_pedido` é o caso concreto.

## Gates para liberar venda self-service

1. Corrigir CTO-C1 a CTO-C6.
2. Tornar divisão e fechamento de mesa transacionais.
3. Zerar achados ALTOS da varredura na loja de demonstração.
4. Homologar iFood/WhatsApp e publicar saúde real.
5. Retirar alegações sem evidência do site e das redes.
6. Executar conta nova de ponta a ponta em ambiente descartável.
7. Repetir TypeScript, testes, build, SQL de integridade, Security Advisor e os
   cinco percursos.

## Atestado honesto

**Atestado técnico condicional — 20/09/2026:** a base compila, a suíte disponível
passa e existem controles server-side relevantes para preço, cupom, entrega,
estados e estoque. Os bloqueadores acima impedem atestar prontidão para venda
self-service ou emitir garantia de funcionamento integral. A aprovação deve
ser reavaliada apenas depois dos gates e de suas evidências.
