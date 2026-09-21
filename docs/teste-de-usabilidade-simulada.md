# Teste de usabilidade simulada — MiseOn

**Data:** 20/09/2026

**Código avaliado:** `228ecd3` + alterações locais não publicadas

**Ambientes:** produção (`miseon.app.br`) e build local validado (`127.0.0.1:4174`)

**Loja usada nos testes autenticados:** `lanchepaulista`

## Veredito executivo

O MiseOn **não está pronto para venda self-service sem acompanhamento**. O produto
tem uma base operacional ampla e vários controles de servidor corretos, mas o
primeiro valor é interrompido por falhas confirmadas no PDV, na configuração
inicial e em regras de salão/pagamento. Para venda hoje, o formato defensável é
**piloto assistido**, com escopo e integrações declarados por escrito.

Este documento não é uma certificação de ausência de defeitos. É um registro
reproduzível do que foi testado, do que falhou e do que ainda não pôde ser
executado sem criar transações reais em produção.

## Método e limites

- Páginas públicas, preço, suporte, cadastro e primeiro acesso foram percorridos
  no navegador.
- O painel foi percorrido em produção com a conta autenticada da loja de testes.
- Cardápio, carrinho, cupom, entrega, KDS, mesas, produto e integrações foram
  inspecionados sem salvar alterações.
- Nova conta, gravação de produto, finalização de pedido, cobrança real e envio
  por integrações externas não foram executados porque criariam dados ou
  transações em produção.
- Comportamentos não concluídos na interface foram confrontados com o código e,
  quando necessário, com as funções reais do banco de produção.

Legenda: **[UI-prod]** interface publicada; **[UI-local]** build local;
**[código]** código-fonte; **[banco-prod]** consulta somente de leitura.

## O que funcionou

- TypeScript, 558 testes automatizados e build Vite aprovados.
- Prerender de 32 rotas e sitemap com 30 URLs.
- O caminho local `/cadastre-se` → `/admin/login?novo=1` comunica criação de
  loja e permite Google ou link por e-mail. **[UI-local]**
- A vitrine de `lanchepaulista` mostrou 17 produtos; carrinho e checkout
  abriram. **[UI-prod] [banco-prod]**
- Cupom inválido explicou o motivo; cupom válido atualizou desconto e total.
  **[UI-prod]**
- A taxa de entrega por distância foi recalculada e possui cálculo autoritativo
  no servidor. **[UI-prod] [banco-prod]**
- Fechar o checkout sem concluir não criou pedido. **[UI-prod] [banco-prod]**
- O formulário de produto cobre categoria, preço, fotos, estação do KDS, ficha
  técnica, nutrição e personalizações. **[UI-prod]**
- KDS por estação, mesas, divisão de conta e produção existem no painel.
  **[UI-prod]**
- Preço e suporte existem nas páginas públicas, embora distantes do início.
  **[UI-local]**

---

## Perfil 1 — Hamburgueria com delivery e dois funcionários

### Percurso

1. A landing comunica cardápio, KDS, estoque e iFood.
2. O CTA leva ao cadastro e ao acesso para criar a loja.
3. O cadastro pede dados fiscais/empresariais antes da experimentação.
4. Informar delivery não configura taxa, raio, entregadores nem horários.
5. Cadastrar produto é compreensível, mas há campos sem rótulo acessível.
6. O primeiro pedido de balcão ficou bloqueado: o PDV publicado mostrou
   “Nenhum produto encontrado”, embora a loja tivesse 17 produtos disponíveis.
7. Preço e suporte aparecem apenas perto do final.

**Dúvidas:** regra de taxa; estado real do iFood; convite/permissão dos dois
funcionários; qual canal usar no primeiro pedido.

**Desistiria:** no PDV vazio.

**Confiaria:** vendo produto próprio → pedido → KDS → estoque de ponta a ponta.

**Escolheria concorrente:** se ele demonstrar balcão + delivery antes de pedir
dados fiscais.

---

## Perfil 2 — Lanchonete de balcão e WhatsApp

### Percurso

1. A landing explica PDV, comandas, estoque, Pix e WhatsApp, mas é longa e
   repetitiva.
2. O cadastro funciona localmente, porém a operação nasce genérica.
3. WhatsApp é tratado como integração opcional.
4. Em produção, a tela mostrou **DESCONECTADO** e nenhum número conectado.
5. O assistente, simultaneamente, marcava WhatsApp como “Feito”.
6. O pedido de balcão ficou bloqueado pelo PDV sem produtos.
7. O plano é único: R$ 169,90/mês ou R$ 149,90/mês no anual.

**Dúvidas:** IA fecha pedido ou só conversa; contratação da Meta; contingência;
plano menor.

**Desistiria:** na contradição “desconectado” × “feito”.

**Confiaria:** teste no próprio número e indicador único de saúde.

**Escolheria concorrente:** se oferecer prova imediata no WhatsApp e preço de
entrada.

---

## Perfil 3 — Restaurante com salão e quatro garçons

### Percurso

1. A landing comunica comanda, mesas, garçons, KDS, DRE e fiscal.
2. O cadastro pergunta por salão e funcionários.
3. As respostas não criam mesas, não convidam garçons e não adaptam o wizard.
4. Mapa de mesas e lançamento por garçom existem.
5. Na divisão por assento, a tela calcula uma fração, mas o trigger real repõe o
   preço integral do produto em cada item fracionado.
6. “Já pago” soma pagamentos sem filtrar status; PENDENTE/CANCELADO pode reduzir
   o saldo.
7. O fechamento 3D não verifica cada erro e pode imprimir após falha parcial.

**Dúvidas:** convite/permissão dos garçons; taxa no DRE; modos de divisão;
contingência de rede.

**Desistiria:** na primeira cobrança incorreta ou fechamento parcial.

**Confiaria:** transação única, idempotente e testada sob falhas.

**Escolheria concorrente:** se divisão e fechamento já forem consolidados.

---

## Perfil 4 — Pizzaria com alto volume

### Percurso

1. A landing fala de KDS de forno, entregas, iFood e custeio de preparos.
2. Usa “100% organização”, “100% precisão” e “iFood + Site” sem medição.
3. KDS por estação e gestão de entrega existem.
4. O iFood publicado está **vinculado, sem receber**: 131 tentativas seguidas,
   última verificação em 20/09/2026, HTTP 403.
5. Não existe fluxo implementado de pizza meio a meio/bordas; há flag de módulo
   e conteúdo público que cria essa expectativa.
6. Não foi comprovada adequação a alto volume.

**Dúvidas:** precificação e estoque de duas metades; capacidade por hora;
contingência.

**Desistiria:** no iFood 403 e na ausência de meio a meio.

**Confiaria:** pedido real com duas metades, borda, KDS e estoque sob carga.

**Escolheria concorrente:** se demonstrar o fluxo específico em vez de módulos
genéricos.

---

## Perfil 5 — Administrador de duas unidades

### Percurso

1. A home não explica cobrança, limites nem visão consolidada por unidade.
2. O painel local possui seletor para vínculos existentes e preserva a escolha.
3. A Edge Function rejeita qualquer usuário que já possua vínculo; a segunda
   unidade não pode ser criada no self-service.
4. Não há onboarding de rede, preço adicional nem consolidação.
5. A troca real não pôde ser executada porque a conta de teste tem uma loja.

**Dúvidas:** preço por loja/CNPJ/usuário; DRE consolidado; funcionários em duas
lojas; cópia de cardápio.

**Desistiria:** no conflito ao cadastrar a segunda unidade.

**Confiaria:** fluxo explícito, seletor, permissões e consolidação.

**Escolheria concorrente:** se multiunidade for padrão e tiver preço claro.

---

## Problemas priorizados, correção e medição

### Críticos

| ID | Problema confirmado | Correção concreta | Como medir/aceitar |
|---|---|---|---|
| C1 | PDV mostra zero produtos; loja tem 17 disponíveis. | Separar produtos de grupos/opções, tratar erro e adicionar E2E autenticado. | 17 produtos no cardápio e no PDV; erro nunca vira lista vazia. |
| C2 | Item fracionado recebe preço integral em cada fração. | RPC transacional que preserve um total e modele participantes. | Produto de R$ 40 dividido por 4 soma R$ 40. |
| C3 | Cashback integral paga, mas deixa pedido `AGUARDANDO_PAGAMENTO`. | Transicionar `NOVO` ou `AGUARDANDO_PAGAMENTO` para `ACEITO` na RPC. | Pedido `ACEITO`, pagamento `PAGO`, uma baixa de estoque. |
| C4 | Falha de Pix/cartão tenta cancelamento sem permissão; erros são ignorados. | RPC do cliente para cancelar o próprio pedido pendente. | Falha simulada não deixa pedido/pagamento pendente. |
| C5 | iFood vinculado não recebe: 131 HTTP 403. | Liberar módulos e homologar webhook/polling. | Cinco pedidos consecutivos, sem 403 nem duplicidade. |
| C6 | Conteúdo de pizzaria cria expectativa de meio a meio não implementado. | Implementar composição ou remover a promessa. | E2E de duas metades + borda + ficha/estoque. |

### Altos

| ID | Problema confirmado | Correção concreta | Como medir/aceitar |
|---|---|---|---|
| A1 | Perfil de salão/equipe/delivery não configura a loja. | Persistir perfil, semear e gerar passos condicionais. | Lojas de salão criam mesa/equipe sem suporte. |
| A2 | Usuário vinculado não cria segunda unidade. | Regra de plano + ação “Adicionar unidade”. | Criar, alternar e isolar duas lojas. |
| A3 | “Já pago” soma qualquer status. | Somar apenas `PAGO` em cálculo autoritativo. | PENDENTE/CANCELADO não reduz saldo. |
| A4 | Fechamento de mesa é não atômico; 3D ignora erros. | Uma RPC idempotente para pagamento, taxa, pedidos e comanda. | Falha injetada causa rollback integral. |
| A5 | Acompanhamento público usa apenas UUID e devolve PII/pagamento. | Token específico, expirável, e payload mínimo. | UUID sem token retorna 401/404. |
| A6 | Loja de teste tem 2 divergências saldo×lote, 1 custo em escala errada, 1 embalagem contraditória e 5 produtos sem ficha. A escala errada é compatível com a importação `kg→g` que antes assumia fator 1; há correção local, ainda não publicada. | Publicar a trava de conversão, reconciliar pela autoridade de estoque/custo e corrigir seeds. | Varredura retorna zero ALTA; demos sem ficha = zero; nenhum fator desconhecido é autoaprovado. |
| A7 | Onboarding mostra integrações concluídas por ID, não por saúde. | Publicar a correção local e unificar fonte de verdade. | Desconectado/403 nunca aparece como “Feito”. |
| A8 | Vitrine e checkout comunicam frete contraditório. | Derivar ambos da mesma RPC e validar antes de publicar. | Vitrine = checkout = pedido para mesmo endereço/subtotal. |

### Médios

| ID | Problema confirmado | Correção concreta | Como medir/aceitar |
|---|---|---|---|
| M1 | Preço e suporte ficam depois de uma página longa. | Resumo após o herói e redução de repetição. | Usuário encontra ambos em até 30 s. |
| M2 | Campos/botões do produto sem nome acessível. | `label`, `htmlFor` e `aria-label`. | Axe/Lighthouse sem essa violação. |
| M3 | Dados fiscais obrigatórios antes do primeiro valor. | Adiar para cobrança/fiscal. | Menor abandono e tempo até produto. |
| M4 | Checkout abre com loja fechada/abaixo do mínimo. | Bloquear antes e explicar no carrinho. | Zero abertura inválida. |
| M5 | Números e absolutos sem medição pública. | Remover ou anexar metodologia/fonte. | Zero alegação quantitativa sem fonte. |

### Baixos

| ID | Problema confirmado | Correção concreta | Como medir/aceitar |
|---|---|---|---|
| B1 | `/cadastre-se` adiciona uma etapa antes do acesso. | Incorporar o formulário ou avançar mantendo contexto. | Um CTA até o cadastro. |
| B2 | Wizard visualmente igual para operações diferentes. | Trilha específica por segmento. | 4/5 usuários reconhecem a próxima ação. |

## Onde cada perfil desistiria

| Perfil | Ponto | Gravidade |
|---|---|---|
| Hamburgueria | PDV sem produtos | Crítico |
| Lanchonete | WhatsApp desconectado marcado como concluído | Alto |
| Restaurante | divisão/fechamento sem integridade | Crítico |
| Pizzaria | iFood 403 e ausência de meio a meio | Crítico |
| Duas unidades | criação da segunda unidade bloqueada | Alto |

## Critério para repetir

Reexecutar após C1–C6, com conta nova e loja descartável. O aceite comercial
deve comprovar em vídeo e logs: `cadastro → configuração → produto → pedido →
pagamento → KDS → estoque → financeiro`, sem intervenção manual no banco.
