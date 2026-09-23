# Teste de usabilidade simulada — MiseOn

**Data:** 23/09/2026

**Código avaliado:** `6426cf0` (produção)

**Ambiente:** produção (`miseon.app.br`)

**Loja usada para inspeção de dados:** `lanchepaulista` (tenant de provas)

**Reexecução de:** [`docs/teste-de-usabilidade-simulada.md`](.) versão de 20/09/2026
(código `228ecd3`). Este documento **substitui** a versão anterior e marca
explicitamente o que mudou.

## Veredito executivo

Desde 20/09 a operação central ficou sensivelmente mais sólida: dos 6
problemas **críticos** listados na rodada anterior, **4 foram corrigidos e
verificados nesta rodada** (PDV vazio, preço dobrado na divisão de conta,
cashback preso, dado fiscal como porta de entrada). Dois continuam abertos e
são os mesmos de sempre — **iFood em 403** e **pizza meio a meio, que
nenhuma tela ou rota pública anuncia hoje, mas que também nunca foi
escrita** — porque um depende do portal do iFood, não do código, e o outro
nunca saiu do papel.

(Correção sobre a primeira versão desta rodada: o artigo de blog sobre pizza
meio a meio citado abaixo está marcado como rascunho e **não está publicado**
— a rota não resolve em produção. Verificado navegando até ela depois de
escrever a primeira versão deste documento. Fica registrado aqui porque
"eu quase escrevi um achado que não se sustentava" é exatamente o tipo de
erro que este método existe para evitar.)

A descoberta mais importante desta rodada **não estava na lista anterior**: a
correção que fechou o vazamento de dados do acompanhamento público de pedido
(UUID sem token) criou, como efeito colateral, um buraco novo — pedido feito
sem login (cliente "convidado") fica **sem nenhuma forma de acompanhar o
próprio pedido depois de fechar a aba**. Isso não é hipotético: 9 dos 65
pedidos de cardápio/mesa na loja de provas têm `cliente_user_id` nulo.

O produto continua **não pronto para self-service sem acompanhamento** — mas
o motivo mudou. Antes, o motivo era "o sistema quebra no meio do primeiro
pedido". Agora, o motivo é "duas integrações centrais (iFood, e por
consequência qualquer canal que dependa dela) e um perfil de negócio
(pizzaria) batem num muro que o onboarding não avisa antes de a pessoa
chegar lá".

## Método e limites

- Páginas públicas (`/`, `/cadastre-se`, `/contato`) e o início do fluxo de
  criação de loja (`/admin/login?novo=1`) foram percorridos no navegador,
  em produção, sem completar o cadastro.
- **Não foi criada uma conta nova.** Continua faltando senha de login de
  usuário de teste (ver `credenciais_testes.md`) e o cadastro real usa Google
  OAuth ou link mágico por e-mail — nenhum dos dois pode ser completado por
  este agente sem usar a identidade de alguém. Preencher e enviar o
  formulário criaria uma loja de verdade, uma linha em `assinatura_dados_
  cadastro` e um e-mail transacional real — o mesmo motivo que a rodada
  anterior já havia registrado para não ir além.
- Todo comportamento pós-login (wizard de configuração, PDV, divisão de
  conta, onboarding) foi verificado lendo o código-fonte publicado e
  confrontando com `pg_get_functiondef`/consultas somente-leitura em
  produção — não com clique real. Isso é mais forte que opinião sobre a
  tela, porque é o que o servidor de fato faz, mas não substitui gravar um
  vídeo do fluxo completo (ver "Critério para repetir").
- Nenhuma escrita foi feita em produção além do que já estava em andamento
  na sessão (varredura de integridade do Sprint 20 — documentada à parte em
  `docs/MISEON_HEAD_OF_ENGINEERING.md`).

Legenda: **[UI-prod]** interface publicada; **[código]** código-fonte lido
nesta rodada; **[banco-prod]** consulta somente-leitura em produção nesta
rodada; **[antigo]** achado da rodada de 20/09 não reverificado agora.

## O que mudou desde 20/09 (verificado, não é lista de intenção)

| Achado de 20/09 | Status agora | Prova |
|---|---|---|
| C1 — PDV mostra "Nenhum produto" com loja cheia | **Corrigido** | `ProductGrid.tsx`/`PDV.tsx` distinguem `carregando` / `erro` (com botão "Tentar novamente") / vazio real; comentário no código cita o próprio bug antigo. **[código]** |
| C2 — item dividido por assento recebia preço integral em cada fração | **Corrigido** | Migration `20260920114221_comercializacao_fluxos_criticos.sql`: `fn_lancar_item_dividido_comanda` grava só `participantes_assentos`, nunca reescreve `preco_unitario`/`quantidade`; `ModalDivisaoProdutoCaixa.tsx` divide `valorTotal / participantes.length`. **[código]** |
| C3 — cashback paga mas pedido fica em `AGUARDANDO_PAGAMENTO` | **Corrigido** | A varredura `supabase/tests/fluxo_pedidos.sql` (Sprint 20, rodada de hoje) tem checagem dedicada para essa contradição e retornou **zero ocorrências** em toda a base. **[banco-prod]** |
| A3 — "já pago" somava pagamento `PENDENTE`/`CANCELADO` | **Corrigido** | `Mesas.tsx` agora filtra `pg.status === 'PAGO'` nas duas somas usadas para fechamento. **[código]** |
| A7 — onboarding marcava iFood/WhatsApp como "Feito" por existir cadastro, não por saúde | **Corrigido** | `StoreSetupWizard.tsx` usa `fn_whatsapp_status` (conexão real) e `integracao_ifood_saude.estado === 'OK'` (resultado do polling), não a mera presença de `merchant_id`. **[código]** |
| M3 — CNPJ/razão social/endereço pedidos antes do primeiro valor | **Corrigido** | `TornarSeLojista.tsx` (reescrito 22/09) pede só nome da loja + segmento; dado fiscal foi movido para a tela de Assinatura, só quando a pessoa decide pagar. O próprio commit registra a lead real que abandonou por causa disso. **[código]** |
| A6 — divergências saldo × lote no estoque | **Muito reduzido** | 2 de 101 insumos divergentes na loja de provas hoje, contra 54/92 (09/09) e 57/187 (10/09) em rodadas anteriores. Não é zero, mas não é mais o quadro geral. **[banco-prod]** |
| B1 — `/cadastre-se` é uma etapa extra antes do acesso | **Melhorado, não eliminado** | Continua em duas telas (`/cadastre-se` → `/admin/login?novo=1`), mas cada uma ficou mínima: um CTA na primeira, e-mail/Google na segunda. **[UI-prod]** |
| C5 — iFood vinculado, HTTP 403 | **Continua aberto** | `integracao_ifood_saude`: estado `SEM_PERMISSAO`, HTTP 403, "No permissions granted to client", **269 falhas seguidas**, última tentativa hoje (23/09 03:36). É ação no portal do parceiro, não código. **[banco-prod]** |
| C6 — "pizza meio a meio" sem implementação | **Continua aberto** | Não existe composição de sabor duplo no código de pedido/ficha técnica. Existe um artigo de blog inteiro sobre o tema ("Engenharia para Pizzarias: Como Gerenciar Pedidos Meio a Meio...") em `blogData.ts`, mas está marcado `rascunho: true` — `Blog.tsx`/`BlogPost.tsx` filtram rascunho da listagem e da rota, e a navegação confirmou que o link não resolve em produção. Não é uma promessa pública hoje; é um risco represado para quando alguém publicar o rascunho sem checar se o recurso existe. **[código] [UI-prod]** |
| A1 — perfil de salão/entrega não configura a operação | **Continua aberto** | `TornarSeLojista.tsx` agora pergunta "Salão com garçom?" e "Faço entregas?", mas a Edge Function `saas-tornar-se-lojista` só grava essas respostas em `assinatura_dados_cadastro` (para a nota fiscal da assinatura depois). Nenhuma mesa é criada, nenhum garçom é convidado, nenhuma taxa de entrega é configurada. **[código]** |
| A2 — conta já vinculada não pode criar segunda loja | **Continua aberto** | A mesma Edge Function recusa com HTTP 409 "Esta conta já está vinculada a uma loja" e não oferece nenhum caminho alternativo de self-service. **[código]** |
| A5 — acompanhamento público por UUID devolvia PII/pagamento | **Corrigido, mas trocou de problema** | `fn_acompanhar_pedido` agora exige `auth.uid()` e (`cliente_user_id = auth.uid()` ou vínculo de equipe) — UUID sozinho não abre mais nada. Ver **N1** abaixo. **[código] [banco-prod]** |
| C4 — falha de pagamento tentava cancelar sem permissão do cliente | **Não reverificado nesta rodada** | Não foi localizada uma RPC de "cliente cancela o próprio pedido pendente"; tratar como ainda aberto até nova checagem. **[antigo]** |
| A4 — fechamento de mesa não atômico | **Não reverificado nesta rodada** | **[antigo]** |
| A8 — vitrine e checkout com frete contraditório | **Não reverificado nesta rodada** | **[antigo]** |

### N1 — Novo: pedido de convidado (sem login) perde o link de acompanhamento (crítico)

A correção de A5 é correta para o vazamento de dado, mas trocou o critério de
acesso de "eu sei o UUID" para "eu estou logado como o dono do pedido". O
problema: nem todo pedido tem dono logado. **[banco-prod]**: na loja de
provas, 9 dos 65 pedidos de cardápio/mesa (`origem in ('link','mesa')`) têm
`cliente_user_id` nulo — pedido de convidado. Para esses, `fn_acompanhar_
pedido` nunca retorna nada a ninguém, porque `p.cliente_user_id = auth.uid()`
nunca é verdadeiro quando o lado esquerdo é `NULL`. **[código]**

Na prática: o cliente que pede pela mesa/QR sem criar conta — o caminho mais
comum para reduzir fricção em delivery e salão — perde o link de
acompanhamento assim que fecha a aba do navegador ou troca de aparelho. Não
foi possível confirmar em tela (exigiria criar um pedido de convidado de
verdade), mas a regra está inequívoca no código e nos dados: não há caminho
de acesso para esse caso.

---

## Perfil 1 — Hamburgueria com delivery e dois funcionários

### Percurso

1. A home comunica cardápio, KDS, estoque e iFood — mas é uma página muito
   longa (mais de uma dezena de seções) até chegar em preço e suporte.
   **[UI-prod]**
2. O CTA leva a `/cadastre-se`, uma tela com um único botão. **[UI-prod]**
3. `/admin/login?novo=1` pede e-mail (link mágico) ou Google — sem senha,
   sem cartão. **[UI-prod]**
4. Depois do login, `TornarSeLojista` pede nome da loja, segmento
   ("Hamburgueria") e dois toggles opcionais: "Salão com garçom" e "Faço
   entregas". Marcar "Faço entregas" **não** cria taxa, raio ou pede
   entregador — só fica salvo para a nota fiscal da assinatura. **[código]**
5. O primeiro pedido de balcão no PDV agora funciona (C1 corrigido) — o
   catálogo carrega, e se falhar, mostra o erro com botão de tentar de novo
   em vez de "loja vazia". **[código]**
6. Delivery de verdade (raio, taxa por km, entregador) precisa ser montado à
   mão depois, sem o onboarding indicar isso.
7. iFood: se o dono tentar vincular, cai no mesmo 403 que a loja de provas
   enfrenta hoje. **[banco-prod]**

**Dúvidas:** marcar "Faço entregas" configurou alguma coisa? Onde defino a
taxa por km? O iFood vai funcionar quando eu vincular?

**Desistiria:** ao configurar delivery e descobrir que marcar o toggle não
fez nada — tem que procurar em outro lugar do painel (`/admin/loja`) sem
aviso.

**Confiaria:** primeiro pedido real de balcão indo do PDV ao KDS sem erro —
isso já funciona hoje.

**Escolheria concorrente:** se o concorrente configurar taxa de entrega no
mesmo passo em que pergunta "faço entregas", em vez de perguntar e não usar
a resposta.

---

## Perfil 2 — Lanchonete de balcão e WhatsApp

### Percurso

1. A home dedica uma seção inteira a "WhatsApp Business Platform" com
   promessa clara: "a IA não fecha pedido sozinha", "decisão sempre sua".
   Copy honesta, sem contradição visível na própria página. **[UI-prod]**
2. Cadastro segue o mesmo caminho leve do Perfil 1.
3. WhatsApp aparece como passo **opcional** no wizard de configuração — e
   agora só marca "Feito" quando a função de status real confirma conexão
   (A7 corrigido). Antes da correção, a tela podia dizer "Feito" com o
   número desconectado; hoje não pode mais. **[código]**
4. Na loja de provas, o estado real é: WhatsApp sem nenhuma linha de conexão
   registrada — ou seja, nunca foi conectado por lá. Isso é estado de dado
   de teste, não falha de produto. **[banco-prod]**
5. Primeiro pedido de balcão: funciona (mesma correção do Perfil 1).
6. Plano único, R$ 149,90/mês (anual) ou R$ 169,90/mês (mensal), visível na
   home. **[UI-prod]**

**Dúvidas:** a IA fecha pedido ou só conversa? (a home já responde: só
conversa e manda o link do cardápio — mas isso só aparece perto do fim da
página). Como funciona a homologação da Meta?

**Desistiria:** se a homologação do WhatsApp na conta própria travar por
motivo fora do produto (Meta pode recusar número, isso não é algo que o
MiseOn controla) e o onboarding não tiver um "e agora?" claro para esse
caso.

**Confiaria:** ver o próprio número conectado com um indicador único de
saúde — que já existe hoje (`fn_whatsapp_status`).

**Escolheria concorrente:** se ele prometer WhatsApp funcionando em minutos,
sem processo de aprovação da Meta pelo meio — mesmo que essa promessa seja
mais frágil que a do MiseOn.

---

## Perfil 3 — Restaurante com salão e quatro garçons

### Percurso

1. A home tem uma solução dedicada ("Salão 3D & Comanda... Modal Mesa &
   Divisão por Assento") e módulo "PDV, Mesas 3D e Comandas" nos recursos.
   **[UI-prod]**
2. `TornarSeLojista` pergunta "Salão com garçom?" — marcar isso não cria
   mesa nem convida ninguém (mesmo problema do Perfil 1, achado A1).
   **[código]**
3. Mapa de mesas e comanda por garçom existem como telas no painel
   (`/admin/mesas`, `garcom-mobile`). Não foi possível abrir com conta real
   nesta rodada.
4. **A divisão de conta por assento agora preserva o preço total** — cada
   participante paga `valor_total_do_item / número_de_participantes`, e o
   preço do item nunca é reescrito. O bug de "preço em dobro" da rodada
   anterior está corrigido. **[código]**
5. O fechamento de comanda (`fn_fechar_comanda_buffet`, usado no fluxo de
   balança/buffet) foi corrigido nesta mesma sessão: antes um único
   pagamento carregava a soma de todos os pedidos da comanda e ficava preso
   a um pedido qualquer — os outros pedidos da mesa viravam "FINALIZADO" sem
   nenhum pagamento próprio registrado. Agora cada pedido da comanda recebe
   seu próprio registro de pagamento. **[código] [banco-prod]**
6. Não foi possível reverificar nesta rodada se o fechamento de mesa
   (encerramento completo, fora do fluxo de buffet) é uma transação única
   com rollback em caso de falha parcial (achado A4 antigo).

**Dúvidas:** como convido os quatro garçons? Isso precisa ser feito manual
em "Equipe" depois — o wizard não leva a pessoa até lá.

**Desistiria:** se, ao tentar dividir a conta de uma mesa de verdade,
encontrar qualquer sinal de que o total não fecha — mesmo com o bug de
preço corrigido, a confiança de quem já foi mordido por isso (mesmo que
nunca tenha sido cliente) exige ver funcionando, não só ser avisado que foi
corrigido.

**Confiaria:** uma transação de fechamento de mesa real, com 4 participantes,
formas de pagamento diferentes, e o total batendo centavo a centavo — hoje
verificável só por leitura de código, não por vídeo.

**Escolheria concorrente:** se ele demonstrar publicamente uma divisão de
conta de restaurante lotado, sexta à noite, sem erro.

---

## Perfil 4 — Pizzaria com alto volume

### Percurso

1. A home fala de "KDS Cozinha & Forno" e "iFood unificado" para pizzaria.
   **[UI-prod]**
2. **Pizza meio a meio continua sem composição no código de pedido/ficha
   técnica** — o mesmo achado da rodada anterior (C6), ainda aberto. Existe
   um artigo de blog pronto sobre o tema, mas está marcado como rascunho e
   não é acessível em produção — não é uma promessa pública hoje, mas é um
   texto pronto para publicar por engano antes do recurso existir.
   **[código] [UI-prod]**
3. iFood: vinculado, mas em `SEM_PERMISSAO` (HTTP 403) há tempo suficiente
   para acumular 269 tentativas seguidas de falha. Uma pizzaria de alto
   volume que dependa do iFood não recebe nenhum pedido por esse canal até
   isso ser resolvido no Portal do Desenvolvedor iFood — fora do controle
   do código. **[banco-prod]**
4. KDS por estação existe e é anunciado como divisão por praça (forno,
   cozinha) — não verificado sob carga real nesta rodada.

**Dúvidas:** como cadastro uma pizza meio a meio? (resposta real hoje: não
dá — o recurso simplesmente não existe). Quando o iFood volta a funcionar?

**Desistiria:** ao tentar montar o cardápio de pizza meio a meio e não achar
a opção em lugar nenhum — ou ao tentar vincular o iFood e cair no mesmo 403.

**Confiaria:** um pedido real de pizza meio a meio, com borda recheada,
passando por KDS e baixando o estoque das duas metades corretamente — hoje
isso não pode ser demonstrado porque não existe.

**Escolheria concorrente:** imediatamente, se o concorrente já tiver meio a
meio pronto — é o tipo de ausência que uma pizzaria de verdade não perdoa.

---

## Perfil 5 — Administrador de duas unidades

### Percurso

1. A home não fala de multi-unidade em nenhum lugar — nem na seção de
   planos, nem nos recursos. **[UI-prod]**
2. Criar a primeira loja segue o fluxo padrão dos outros perfis.
3. Ao tentar abrir uma segunda loja pela mesma conta, a Edge Function
   `saas-tornar-se-lojista` devolve **HTTP 409 "Esta conta já está vinculada
   a uma loja"** — sem nenhuma alternativa de self-service oferecida (criar
   com outro e-mail, pedir upgrade, qualquer coisa). **[código]**
4. Não existe preço, plano ou menção pública a rede de lojas em nenhuma
   página institucional verificada nesta rodada.

**Dúvidas:** dá para ter duas lojas? Quanto custa a segunda? Um funcionário
pode operar as duas? Existe DRE consolidado?

**Desistiria:** no exato momento do 409 — não porque o erro é técnico, mas
porque não vem acompanhado de nenhuma explicação ("fale com nosso time para
adicionar uma unidade", por exemplo).

**Confiaria:** um caminho explícito — mesmo que manual/assistido — para
adicionar uma segunda unidade, com preço claro.

**Escolheria concorrente:** se o concorrente tratar multi-loja como recurso
de primeira classe, com preço e fluxo publicados.

---

## Problemas priorizados, correção e medição

### Críticos

| ID | Problema confirmado agora | Correção concreta | Como medir/aceitar |
|---|---|---|---|
| N1 | Pedido de convidado (`cliente_user_id` nulo) nunca pode ser acompanhado via `/pedido/:id` depois de fechar a aba — 9/65 pedidos na loja de provas estão nesse estado. | Gerar um token de acompanhamento (aleatório, por pedido, sem PII) na criação do pedido e aceitar esse token em `fn_acompanhar_pedido` como alternativa a `auth.uid()`, além do vínculo de conta. | Pedido de convidado consegue reabrir `/pedido/:id` a partir do link enviado (e-mail/WhatsApp) sem estar logado; UUID sozinho continua não bastando. |
| C5 | iFood vinculado, HTTP 403 "No permissions granted", 269 falhas seguidas (23/09). | Resolver no Portal do Desenvolvedor iFood (liberação de módulos/permissões); enquanto não resolvido, o onboarding e a tela de iFood devem avisar isso ANTES de a pessoa tentar vincular, não só depois. | Cinco pedidos consecutivos do iFood, sem 403 nem duplicidade; e, até lá, aviso visível na etapa de vínculo. |
| C6 | Pizza "meio a meio" não existe no código de pedido/ficha técnica — recurso central do segmento pizzaria, um dos que a home lista como solução dedicada. Um artigo de blog sobre o tema já está escrito (`blogData.ts`, `rascunho: true`) e represado para publicar. | Implementar composição de sabores (preço/estoque proporcional por metade) antes de publicar qualquer conteúdo sobre o tema; travar a publicação do rascunho a essa entrega. | Pedido de teste com duas metades diferentes: ficha técnica debita as duas, preço reflete a regra escolhida (maior valor, média, etc., decidida e documentada) — só então o artigo de blog sai do rascunho. |

### Altos

| ID | Problema confirmado agora | Correção concreta | Como medir/aceitar |
|---|---|---|---|
| A1 | "Salão com garçom" e "Faço entregas" são perguntados no cadastro mas só gravam metadado de nota fiscal — não criam mesa, não convidam garçom, não configuram taxa de entrega. | Ligar as respostas a ações reais: perfil "salão" pré-cria N mesas e leva ao convite de equipe; perfil "entrega" leva direto para a configuração de taxa/raio. | Loja criada com "salão" marcado nasce com pelo menos 1 mesa; loja com "entrega" marcado é redirecionada para configurar taxa antes de poder ativar delivery. |
| A2 | Conta já vinculada a uma loja recebe 409 ao tentar criar outra, sem alternativa de self-service. | Regra de plano explícita ("Adicionar unidade") ou, no mínimo, a mensagem de erro linkar para o WhatsApp comercial com contexto pré-preenchido. | Usuário com uma loja consegue, sem sair do painel, iniciar o processo de adicionar uma segunda (mesmo que vá para atendimento humano) em vez de esbarrar num 409 mudo. |
| C4 | (não reverificado) Falha de pagamento tentava cancelar pedido sem checar permissão do cliente. | RPC dedicada para o próprio cliente cancelar seu pedido pendente, com guarda de posse (`cliente_user_id = auth.uid()` ou token de convidado, ver N1). | Falha de pagamento simulada não deixa pedido/pagamento em estado ambíguo; cancelamento só funciona para o dono do pedido. |
| A4 | (não reverificado) Fechamento de mesa apontado como não atômico na rodada anterior. | Consolidar em uma RPC transacional única (pagamento + pedidos + comanda), com teste de falha injetada. | Falha no meio do fechamento não deixa comanda meio fechada nem pagamento duplicado/perdido. |
| A8 | (não reverificado) Vitrine e checkout podiam mostrar frete diferente para o mesmo endereço. | Derivar os dois valores da mesma função de cálculo de frete e validar antes de publicar. | Vitrine, checkout e pedido final mostram o mesmo valor de frete para o mesmo endereço/subtotal. |

### Médios

| ID | Problema confirmado agora | Correção concreta | Como medir/aceitar |
|---|---|---|---|
| M1 | Home é uma página muito longa; preço e suporte só aparecem perto do fim. | Resumo de preço e link de suporte logo após a primeira dobra, mantendo o conteúdo completo abaixo. | Usuário novo encontra preço e um jeito de falar com suporte em até 30s de rolagem. |
| M2 | (não reverificado nesta rodada) Campos/botões do formulário de produto sem rótulo acessível. | `label`, `htmlFor`, `aria-label` nos campos restantes. | Auditoria Axe/Lighthouse sem essa violação. |
| M3 | Home usa termos fortes ("100% organização", "elimina perdas") ao lado de linguagem cuidadosa em outros pontos ("prévia demonstrativa", "configurável") — a mistura passa insegurança sobre o que é medido e o que é promessa. | Padronizar: todo número/superlativo na home carrega a mesma disciplina que já existe na seção de comparativo ("Prévia visual estruturada; automação contábil ainda não concluída"). | Revisão de copy: zero superlativo sem qualificador ao lado, em toda a home. |

### Baixos

| ID | Problema confirmado agora | Correção concreta | Como medir/aceitar |
|---|---|---|---|
| B1 | `/cadastre-se` continua sendo uma tela extra antes do login, mesmo que leve. | Levar o CTA da home direto para `/admin/login?novo=1`, ou fundir as duas telas. | Um clique da home até a tela de login/cadastro, não dois. |
| B2 | (não reverificado) Wizard de configuração visualmente igual para operações diferentes. | Trilha específica por segmento dentro do próprio wizard. | Amostra de usuários reconhece o próximo passo certo para o próprio segmento. |

## Onde cada perfil desistiria (atualizado)

| Perfil | Ponto | Gravidade |
|---|---|---|
| Hamburgueria | descobrir que "faço entregas" não configurou nada | Alto |
| Lanchonete | homologação do WhatsApp travar sem "e agora" no onboarding | Médio |
| Restaurante | falta de confiança visual na divisão de conta, mesmo corrigida no código | Alto |
| Pizzaria | ausência de pizza meio a meio — recurso central do segmento, sem previsão | Crítico |
| Duas unidades | HTTP 409 mudo ao tentar abrir a segunda loja | Alto |

## Critério para repetir

Reexecutar com conta nova de verdade (exige senha de teste — ver
`credenciais_testes.md`) e loja descartável, cobrindo especificamente:
1. Um pedido de convidado (sem login) do início ao acompanhamento via link,
   provando N1 corrigido ou não.
2. Vínculo de iFood do zero, para confirmar se o 403 é específico da loja de
   provas ou de qualquer loja nova.
3. Fechamento de mesa com múltiplos participantes e formas de pagamento
   mistas, gravado em vídeo — não só lido em código.

O aceite comercial continua exigindo vídeo + logs de `cadastro →
configuração → produto → pedido → pagamento → KDS → estoque → financeiro`,
sem intervenção manual no banco.
