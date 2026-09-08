# MISEON - Head of Engineering Document

## 1. Visão do Produto
O MiseOn é uma plataforma SaaS multi-tenant para FOOD SERVICE. A visão é atender diferentes modelos operacionais (à la carte, quilo, self-service, buffet, rodízio, pizzaria, hamburgueria, dark kitchen, múltiplas marcas, etc.) sem obrigar o sistema a virar um conjunto de condicionais específicas por segmento.

> "O MiseOn deve entender a operação do restaurante e esconder a complexidade do sistema do operador."

O sistema deve reduzir configuração manual, decisões, cadastro repetitivo e erros, aumentando a automação, sugestões, defaults inteligentes e facilidade de operação.

## 2. Princípios de Arquitetura
- **Uma fonte de verdade por conceito**: Um preço, um pedido, um estoque, um PEPS, um CMV, uma DRE, uma regra de autorização.
- **Não reescrever o MiseOn**: Evolução incremental. Preservar o que funciona (KDS atual, iFood, WhatsApp, nutrição, RLS/RBAC, ledger de dupla entrada, idempotência de Pix, motores de unidade/conversão, PEPS, fluxo de NF existente).
- **Sem "Feature Inflation"**: Toda feature deve ter um propósito claro de negócio, reduzir dor e gerar valor. Se não houver justificativa forte, vai para o BACKLOG.
- **Segurança no Backend**: Regras críticas (RLS, tenant isolation, webhooks, autorização) permanecem no backend/banco, nunca no frontend.
- **Código focado no Negócio**: O sucesso não é "código bonito", mas problema real resolvido com menor risco, testes passando, operação preservada e menor complexidade.

## 3. Modelo de Domínio Atual
- **Segmento como Preset**: Segmentos não ditam a arquitetura, funcionam como presets de configuração inicial.
- **Verdade baseada em Capacidades**: A operação é definida pelas capacidades do tenant e não por `if (segmento === 'pizzaria')`.

## 4. Modelo de Capacidades
A arquitetura suporta a composição de capacidades para formar operações complexas.
**Exemplos de capacidades**: mesas, comandas, balança, por_peso, buffet, rodizio, kds, producao, ficha_tecnica, delivery, retirada, ifood, whatsapp, totem, tef, multiplas_marcas.
O onboarding deve configurar as capacidades baseadas em perguntas de negócio ("Como sua operação funciona?"), inferindo a complexidade sistêmica.

## 5. Estado do Estoque
- **Visão Estratégica**: NF/XML → interpretação → classificação → fornecedor → unidade → conversão → lote → validade → custo → estoque → disponibilidade → ficha técnica → CMV → sugestão de compra.
- **Regras**: Determinístico (regras invariantes de negócio), IA (interpreta/classifica/sugere), Humano (confirma decisões críticas). IA nunca dita saldo, preço ou transação.
- **Reconciliação 08/09** — risco "IA confunde quantidade com valor total" (qCom/vUnCom/vProd): rastreei as 3 rotas de entrada (`parseNFeXml.ts` p/ XML, `nfe-ocr-cupom` p/ foto via Gemini com schema tipado, SEFAZ QR) até `fn_importar_nfce`. As três já separam `qtd`/`unidade`/`valor_unitario`/`valor_total` corretamente, e `ModalImportarNFCe.tsx` usa `qtd_nota` (não `valor_total`) pra montar o payload. `custoComDesconto()` rateia o desconto proporcionalmente entre os itens — sem isso o CMV subiria ~3% de forma invisível. **Não é bug vivo hoje**; risco arquitetural real é a falta de testes de fixture (Regra 23) travando essa separação contra regressão futura — registrado no backlog.
- **Diagnóstico Atual**: Oportunidades de automação seguem válidas; investigar divergências e PEPS duplicado citadas em diagnósticos anteriores exige reconciliação própria antes de agir (não foi o foco desta rodada).

## 6. Estado de Pedidos
- **Diagnóstico Atual**: Múltiplos caminhos de criação de pedido espalhados pela base, o que gera inconsistências, regras duplicadas e brechas.
- **Visão**: Unificar a criação e manipulação em um pipeline previsível de intenção, validação e consolidação.

## 7. Estado do KDS
- **Sprint 5 entregue (08/09)**: `kds_estacoes` → `kds_workflows` → `kds_tickets` implementado em paralelo ao pipeline legado (`pedidos.etapa_kds_atual`), sem rewrite. Um ticket por pedido por estação, ponteiro de etapa independente — testado de ponta a ponta (pedido misto cozinha+bar, avanço independente, conclusão só quando todos os tickets ficam PRONTO, isolamento entre lojas). Telas novas: `KDSEstacao.tsx` (por estação) e `KDSExpeditor.tsx` (sincronização por pedido). `KDS.tsx` legado intocado, só ganhou um link condicional pro modelo novo.
- **Achado corrigido nesta entrega**: a integração com a máquina de estados existente (`fn_valida_transicao_pedido`/`fn_valida_estacao_pedido`, o passa-bastão balcão↔cozinha) não estava feita — a conclusão automática de um pedido com item de cozinha ia estourar exceção. `fn_trg_despachar_kds_ao_aceitar` agora adianta as mesmas transições que o clique manual faria.
- **Ainda não feito (backlog, não bloqueador)**: seletor de estação/workflow por produto está na tela do Cardápio; falta "Modificadores estruturados" (ex: "ponto da carne") como Sprint 5.4 — hoje seria texto livre em `observacao`.

## 8. Estado Financeiro
- **Diagnóstico Atual**: Problemas de CMV, riscos financeiros diagnosticados, dados que dificultam conciliação.
- **Visão**: Consolidação da fonte de verdade para indicadores financeiros (DRE, CMV), garantindo invariantes fortes que protegem caixa, estoque e precificação.

## 9. Estado de Pagamentos
- **Diagnóstico Atual**: Acoplamento direto com clientes/providers (ex: Efí). Falta de um Payment Core abstrato.
- **Visão**: PAYMENT CORE → adapter → provider. O domínio usa conceitos padronizados (PaymentIntent, PaymentResult, authorized, pending, cancelled, etc.) sem expor detalhes do fornecedor para as regras de negócio.

## 10. Estado das Integrações
- Integrações existentes (iFood, WhatsApp) serão preservadas.
- O sistema prepara terreno para ecossistema (parceria BRAVUS, totens, TEF, vouchers) sem acoplar o núcleo a um fornecedor específico.

## 11. Estado do Multi-Tenant
- Arquitetura sustentada por RLS, isolamento de tenant e RBAC no banco.
- **Visão de Escala**: Monitorar agressivamente queries N+1, polling excessivo, e estruturas não indexadas, visando suportar 10.000+ lojas de forma suave e suportar cenários de múltiplas marcas sob a mesma operação.

## 12. UX
- **Foco no Operador**: Reduzir atrito, minimizar cliques e necessidade de cadastros manuais.
- A máquina infere, o usuário confirma. Defaults inteligentes, recuperação de falhas clara e em português simples, mensagens contextuais que dispensam treinamento.

## 13. Automação e IA
- **Pragmatismo**: Automação operacional real (OCR/leitura de XML de NF para cadastrar fornecedor/insumo, classificação, conversão, lotes, sugestões baseadas em dados).
- **Limite de Autoridade**: IA é um assistente, não um tomador de decisão final sobre aspectos financeiros, fiscais ou de acesso.

## 14. Escalabilidade
- Evitar otimização prematura, mas bloquear proativamente designs que quebram com escala (ex: blob JSON sem contrato usado para regra de negócio, falta de idempotência).
- Garantir segurança via backend, jobs idempotentes e processamento resiliente.

## 15. Segurança e Fiscal
- Fiscal é domínio de alto risco. Nunca "hardcodar" regras fiscais; tratar com rastreabilidade, regras claras e testes.
- Segurança nunca no frontend.

## 16. Riscos
- Risco operacional de regressão em refatorações críticas (pedidos/kds).
- Dados difíceis de conciliar hoje devido à falta de invariantes em pedidos/estoque.
- Acoplamento estrutural em partes que inibem novas parcerias (ex: TEF/Totem).

## 17. Backlog Consolidado (Baseado no Diagnóstico)
- Unificar caminhos de criação de pedidos.
- Consolidar motor de PEPS (remover duplicidades).
- Corrigir fontes de divergência de estoque e CMV.
- Remover autoridade do frontend sobre dados/segurança sensíveis.
- Refatorar acoplamento Efí para um Payment Core abstrato.
- Estruturar Display Device / Session para controle de telas/TVs via pareamento.
- Desacoplar etapas de KDS de modificadores de produto (roteamento inteligente). — **KDS por estação entregue no Sprint 5; falta o modificador estruturado (Sprint 5.4).**
- Fixtures de teste para a entrada fiscal (KG/UN/CX/PC/LT, desconto rateado, conversão) — a separação qtd/valor está correta hoje mas sem teste que a proteja de regressão.
- Geocodificação no servidor: hoje o lat/lng do endereço vem do cliente e a taxa é derivada dele (Sprint 6). Subdeclarar a coordenada ainda pode baixar a faixa de frete.
- `taxas_entrega.ativo` é ignorado tanto pelo cardápio quanto por `fn_taxa_entrega_calculada` (espelhamento deliberado, para não mudar preço no deploy do Sprint 6). Decidir se a coluna vale e aplicar nos dois lados.

## 18. Roadmap
**NOW**
- Sprint 0: Go-Live e Integridade do Sprint Anterior
- Sprint 1: Financeiro / DRE / CMV — Uma Verdade
- Sprint 2: Estoque — Consolidação da Fonte de Verdade

**NEXT**
- Sprint 3: Estoque Inteligente / NF/XML / Classificação
- Sprint 4: Capacidades Operacionais / Onboarding
- Sprint 5: KDS Multiestação / Workflows

**LATER**
- Sprint 6: Payment Core / Bravus / TEF / Vouchers
- Sprint 7: MiseOn Displays / Pareamento / Casting
- Sprint 8: UX / Automação / Redução de Fricção

**NEVER (Neste ciclo)**
- Rewrite completo ou migração prematura para microsserviços.
- Refatorações puramente estéticas em módulos maduros.

## 20-B. Sprint 7 — Estoque tem uma autoridade só (08/09)
**Medido antes de mexer:** 54 de 92 insumos da loja de provas com saldo divergente dos lotes. Natureba (cliente real) está com 0 insumos ativos, então **nenhum cliente estava contaminado** — mas a fábrica estava ligada e ia junto na primeira carga de NF-e.

**Duas causas, ambas reproduzidas no banco:**
1. **Dupla contagem ao criar insumo** — o cadastro gravava `quantidade_atual` no INSERT e logo depois chamava `fn_movimentar_estoque` ENTRADA com a mesma quantidade, que soma de novo. Criar insumo com saldo 10 gravava **saldo 20 / lote 10**. Todo insumo nascido com saldo inicial nasceu torto.
2. **Ledger gravável por fora** — `anon` e `authenticated` tinham INSERT/UPDATE/DELETE diretos em `movimentacoes_estoque`, `lotes_estoque` e no saldo. Como nenhum gatilho dessas tabelas mantém saldo nem consome lote, escrita direta produz estado impossível.

**Fechado:** insumo nasce zerado (saldo entra pela RPC); revogada a escrita direta no ledger e nos lotes; em `insumos` o revoke é **por coluna** — e a primeira tentativa **não pegou**, porque `REVOKE UPDATE (coluna)` não vale contra `GRANT UPDATE` de tabela: foi preciso revogar a tabela e reconceder coluna a coluna, com verificação que aborta a migration se a porta continuar aberta.

**Ferramenta que faltava:** `fn_reconciliar_estoque(insumo, contado, obs)` acerta **saldo E lotes** contra a contagem física, com movimentação de rastro. `fn_ajustar_inventario` não servia: compara com o cache, então em item já divergente responde "bate com o sistema" e não conserta nada. Editar o saldo pela tela agora passa por essa RPC — virou contagem, com rastro.

**Guarda de regressão:** `fn_privilegios_de_escrita_estoque()` devolve as permissões de escrita que não deveriam existir; a suíte trava em zero linhas, para um `GRANT` distraído no futuro não reabrir isso em silêncio.

**Deliberadamente NÃO feito:** derivar o saldo do ledger por gatilho (o conserto definitivo) exige reescrever as 8 funções que hoje atualizam o saldo à mão — refatorar o caminho do dinheiro na véspera de entregar a cliente é risco que não se corre. Fica como próximo sprint, com o caminho já mapeado.

## 20-C. Sprint 8 — A nota vira dado com origem, e tudo continua corrigível (08/09)
**Gatilho:** o lojista importou duas notas (QR real e foto/IA) e a categorização veio errada. Pedido dele: *"tudo precisa ser editável, não podemos hardcoded no banco tudo que for lido"*.

**Causa raiz (medida, não suposta):** a classificação era calculada e **descartada no salvamento**. O modal resolvia gênero/categoria (catálogo + IA), mas o payload enviado a `fn_importar_nfce` levava só nome/unidade/quantidade/custo — a RPC nunca gravou `categoria_insumo` nem `tipo_item`. Todo insumo importado nascia sem categoria e a tela mostrava "Ingrediente". Contagem no banco: **4 itens de Descartáveis e 1 de Limpeza gravados como INGREDIENTE**, entrando em ficha técnica e nutrição como comida — exatamente o caso da água sanitária (Regra 10).

**O que passou a existir:**
- `classificacao_categorias` — a regra "categoria → natureza / entra em ficha / entra em nutrição" virou **tabela**, não lista de 49 KB no bundle do front.
- `fn_classificar_insumo(categoria, nome, ncm)` — **NCM primeiro** (capítulo fiscal é fato: 34 limpeza, 02 carnes, 22 bebidas), categoria depois, `Outros`/baixa confiança como piso — e o piso fica **fora** da ficha técnica, porque incluir errado contamina CMV em silêncio.
- `insumos.classificacao_origem / _confianca / _revisada` — Regra 9: dá para saber o que é fato (XML/NCM) e o que é palpite (IA), e o que já foi revisado por gente.
- `parseNFeXml` passou a **ler o NCM**, que ele vinha jogando fora — sem isso o classificador determinístico não tinha o sinal mais forte da nota.
- `fn_definir_classificacao_insumo` — o que o lojista escolhe na tela vira `origem = USUARIO`, e **nenhuma importação futura sobrescreve**. Categoria própria ("Molhos Especiais da Casa") é preservada como escrita; só categoria conhecida deriva o tipo.
- `vw_insumos_a_revisar` — fila do que é palpite ou está vazio.

**Provado no banco, ponta a ponta:** `20 KG × 18,90 = 378,00` → quantidade **20**, unitário **18,90** (378 nunca virou quantidade); água sanitária com IA dizendo "Mercearia" → **NCM 34 venceu**, virou Limpeza fora da ficha; `10 CX × fator 12` → **120 UN**; e reimportar a nota **não** desfez a correção do lojista.

**Testes:** `__tests__/parseNFeXml.test.ts` — 7 fixtures de NFe modelo 55 (KG, CX, fracionado, NCM, desconto rateado, XML inválido). É a rota que o lojista não consegue testar (não tem XML) e que era a única sem prova nenhuma.

**Backlog que fica:** o catálogo de 179 gêneros continua no bundle (só a regra de categoria virou tabela); a rota SEFAZ/QR não traz NCM, então lá a classificação continua por categoria; `nfe-ocr-cupom` não devolve NCM.

## 19. Sprint Atual
- **SPRINT 5: KDS Multiestação — CONCLUÍDO (08/09)**. Ver seção 7.
- **SPRINT 6: "O servidor decide" — CONCLUÍDO (08/09)**. Ver seção 20-A.
- **SPRINT 7: "Estoque tem uma autoridade só" — CONCLUÍDO (08/09)**. Ver seção 20-B. CI verde nos dois workflows.
- **SPRINT 8: "A nota vira dado com origem" — CONCLUÍDO (08/09)**. Ver seção 20-C.
- **Próximo candidato**: reconciliar PEPS (SQL vs TS) e a divergência saldo×lotes com o mesmo rigor — o diagnóstico de 05/09 apontava motor duplicado, mas o S1-C já mexeu nisso e a informação precisa ser reconfirmada contra o código antes de virar sprint. Alternativa: Sprint 5.4 (modificadores estruturados do KDS, ex. "ponto da carne").

## 20-A. Sprint 6 — O servidor decide: preço, taxa e porta (08/09)
**Problema:** a blindagem de 20260819042904 tirou do cliente a autoridade sobre preço de item e cupom, mas três autoridades continuavam no navegador, e as três mexem em dinheiro:

| # | Defeito | Impacto |
|---|---------|---------|
| D1 | `fn_criar_pedido_completo` gravava `taxa_entrega` do payload como veio | POST com `"taxa_entrega": 0` = entrega grátis, invisível no fechamento |
| D2 | `preco_original` ("De: R$ X") fixado por NOME de produto no bundle do cardápio | Preço de uma loja aparecia em qualquer loja com produto de nome parecido; a coluna nem existia no banco |
| D3 | "Loja aberta" decidido com `new Date()` do navegador | Relógio errado ou POST direto derruba pedido na cozinha com a loja fechada |

**O que foi feito:**
- `fn_taxa_entrega_calculada(loja, lat, lng, bairro, subtotal)` — espelha `src/lib/geo.ts` (distância→faixa→bairro→padrão, frete grátis, raio). A distância é recalculada por haversine a partir do lat/lng: mentir nela é mentir no endereço de entrega.
- `fn_loja_aberta(loja)` — horário no fuso da operação (America/Sao_Paulo), cobrindo turno que cruza a meia-noite; `aberto_manual` vence o horário.
- `fn_criar_pedido_completo` reescrita **sobre a definição de produção**: taxa nasce 0 e é derivada após o subtotal do servidor; fora de área e loja fechada recusam o pedido — mas pedido **agendado** continua passando com a loja fechada, igual à regra da tela.
- `produtos.preco_original` criada com backfill que reproduz exatamente o que o bundle fazia (nenhuma vitrine muda de aparência), e o campo entrou no formulário do Cardápio — a promoção virou dado do lojista, não deploy.
- `fn_agora_sao_paulo_hhmm()` — relógio da operação observável (havia bug histórico de painel apagando às 21h por fuso).

**Provado em produção (tenant de provas), não só em teste:** payload com `taxa_entrega: 0` e `distancia_km: 0.1` → gravado **R$ 7,00** e **2.00 km**; fora do raio recusado; loja fechada recusada; agendado com loja fechada aceito; frete grátis legítimo continua zerando.

**Trade-off assumido:** a geocodificação continua no cliente. O servidor deriva a taxa das suas próprias tabelas, mas confia no lat/lng informado — subdeclarar distância ainda encolhe a faixa. O vazamento é limitado pela tabela de faixas (não é mais arbitrário), e fechar isso exige geocodificação no servidor. **Registrado no backlog.**

## 20. Decisões do Dono
- Focar sempre na redução da carga cognitiva e esforço operacional do restaurante. O sistema deve aprender a operação, não o inverso.
- O modelo técnico e arquitetural deve garantir flexibilidade para monetização modular (planos, TEF, ecossistema, módulos premium) sem engessar a base.

## 21. Architectural Decision Records (ADRs)
*(Este espaço receberá documentação e contexto sobre decisões estruturais (ex: escolha do formato de modelagem das capacidades, contratos do Payment Core) conforme o andamento das Sprints).*

## 20-D. Sprint 9 — Cupom volta a existir, e pedido online espera o pagamento (08/09)

**Cupom (item "a" do relato):** `fn_validar_cupom` declarava `RETURNS TABLE(id, codigo, ...)` e o corpo filtrava por `codigo` sem qualificar a tabela. Esses nomes viram variáveis dentro da função → `42702 column reference "codigo" is ambiguous` em **toda** chamada. **Nenhum cupom jamais foi aplicado neste sistema**; o cliente via "Cupom inválido ou expirado" para cupom válido. Corrigido com alias, e cada recusa passou a ter motivo próprio (não existe / inativo / vencido / limite de usos / forma de pagamento / mínimo / primeira compra) — antes tudo colapsava numa frase só. Na tela: erro junto do campo (ia para o `erro` geral lá embaixo), botão com estado de carregando/desabilitado, cupom aplicado com opção de remover, e revalidação quando muda a forma de pagamento (cupom de Pix usado no cartão perdia o desconto no servidor, em silêncio).

**Pedido antes do pagamento (item "c", o mais grave):** `fn_criar_pedido_completo` criava o pedido como `NOVO` **antes** de gerar a cobrança. No instante em que o cliente abria a tela do cartão, o lojista recebia alerta sonoro e o pedido entrava em "Abertos" — ele aceitava pedido que ninguém pagou, e desistência virava comida perdida. Agora existe `AGUARDANDO_PAGAMENTO` no enum: PIX e CREDITO (os dois com confirmação de gateway) nascem nesse estado; DINHEIRO continua `NOVO` porque paga na entrega. O estado é invisível nos filtros do painel (lista branca `NOVO`/`ACEITO`) e o alerta de realtime o ignora.

**Efeito colateral que quase passou:** a baixa de estoque acontecia em `NEW.status='ACEITO' AND OLD.status='NOVO'`. Com o pedido online saindo de `AGUARDANDO_PAGAMENTO`, o estoque **não baixaria** — saldo alto e CMV baixo, em silêncio. `fn_trg_status_pedido` passou a aceitar as duas origens. Provado no banco: `estoque_baixado = t` após a confirmação.

**Ainda aberto do relato:** (b) taxa por bairro em vez de raio/distância — a loja de teste está em modo BAIRRO e sem lat/lng, o motor de distância do Sprint 6 já existe; (d) recusa do cartão pela Efí ("valor da emissão superior ao limite operacional") é resposta do provedor sobre a conta, não código; (e) ficha técnica de drinks no KDS; (f) sidebar com footer fixo ocupando espaço dos módulos; (g) ciclo de vida da comanda no buffet.
