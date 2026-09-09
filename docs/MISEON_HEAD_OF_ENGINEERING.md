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

**Atualização de planejamento — 09/09/2026:** a sequência operacional proposta e os critérios de lançamento estão em [PLANO-LANCAMENTO-NATUREBA-KIOSK.md](PLANO-LANCAMENTO-NATUREBA-KIOSK.md). Ela substitui a priorização histórica NOW/NEXT/LATER abaixo para o próximo Planning; não declara os novos sprints iniciados ou concluídos.

O PO confirmou o primeiro cliente: Natureba monta baguetes de 15/30 cm, vende marmitex, bebidas, salgados fritos/assados; atende mesas com garçom, iFood e delivery próprio, balcão/retirada online e retirada por motoboy com identificação/senha; precisa de crédito e Pix. Hoje usa Anota.ai e quer substituição com melhoria operacional. Rodízio permanece no plano de expansão; não foi indicado para o primeiro dia da Natureba. Data e dependências técnicas da Bravus ainda não informadas.

Reconciliado o handoff com `main` em `e1076b6`, árvore inicialmente limpa. Há base de modificadores/estações, mas “6 de 7” não é aceite de lançamento. Confirmado no código o despacho com `ON CONFLICT DO NOTHING` e a conferência OCR não consumida pelo modal. Registrar como hipóteses a reproduzir, seguindo toda a cadeia SQL: despacho antes da inserção de opções; papel exclusivo de garçom no despacho; preço e validação de opções da RPC de comanda. Não afirmar falha efetiva em produção sem essa verificação.

Kiosk inspecionado é simulador local (`MENU_MOCK`, aprovação por timer). Homologação operacional e afirmações de POS homologado na landing precisam de evidência. Bravus deve informar hardware/SO/periféricos e provedor/protocolo de pagamento; não presumir que o fabricante é o gateway. Painel de senhas já permite configurar DELIVERY entre os tipos: validar e evoluir a separação cliente/motoboy sem alterar indevidamente o destino do pedido.

Sequência detalhada em [SPRINTS-E-UX-LANCAMENTO-MISEON.md](SPRINTS-E-UX-LANCAMENTO-MISEON.md): Sprint 15, assinatura/NFS-e; 16, pagamento, notificações e iFood; 17, estoque; 18, montagem/KDS; 19, virada Natureba/Anota.ai; 20, Cast; 21, operação mista/rodízio; 22, Kiosk Bravus. Descoberta Bravus e inventário de migração começam cedo. Plano contém backlog com IDs, dependências, responsáveis, UX por papel, DoD, ensaio, critérios de liberação e contingência. Escopo do objetivo 17 precisa ser repartido pela capacidade no Planning; não é compromisso de entrega em uma semana.

Validação desta sessão de planejamento: TypeScript **PASS**; Vitest **363 PASS / 14 SKIPPED**, 31 arquivos aprovados e 6 pulados. Credencial de integração local ausente; testes pulados não certificam RPC/RLS/triggers. `npm` global com launcher inválido: usados entrypoints locais de TypeScript/Vitest; Vitest executado fora do sandbox após autorização devido ao bloqueio de leitura do esbuild. Banco remoto, hardware, pagamentos reais, Deno, lint, build completo e E2E operacional **NOT RUN**. Esse era o estado ao final da investigação; a execução posterior está registrada abaixo.

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
- **SPRINT 9: "Cupom volta a existir, pedido online espera pagamento" — CONCLUÍDO (08/09)**. Ver seção 20-D.
- **SPRINT 10: "Entrega nasce da localização" — CONCLUÍDO (08/09)**. Ver seção 20-E.
- **SPRINT 11: "Carrinho não toca campainha" — CONCLUÍDO LOCALMENTE (08/09)**. Ver seção 20-F.
- **SPRINT 12: "Bar não é cozinha com outro nome" — CONCLUÍDO LOCALMENTE (08/09)**. Ver seção 20-G.
- **SPRINT 13: "Comanda viva, cupom distribuível e operação acessível" — CONCLUÍDO LOCALMENTE (08/09)**. Ver seção 20-H.
- **SPRINT 14: "Migrations 9–13 publicadas + comanda buffet acessível ao garçom" — CONCLUÍDO (09/09)**. Ver seção 20-J.
- **Próximo passo obrigatório**: reverter a conta de cartão de PF para PJ assim que a Efí liberar o limite operacional da Maldivas Tech (ver 20-J); revisar e publicar o código novo da Edge Function `cartao-pagar` (separação de secrets por ambiente) que ainda está só no working tree.

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

**Continuação:** os itens (d)–(g) foram tratados nos Sprints 11–13 abaixo. A recusa Efí permanece uma pendência comercial da conta quando o provedor realmente devolve o código 4600037, mas o produto agora deixa de oferecer cartão até a conta ser regularizada e não expõe o texto técnico ao cliente.

## 20-E. Sprint 10 — Entrega nasce da localização (08/09)

**Objetivo:** impedir que uma falha de localização seja convertida silenciosamente em uma taxa por bairro e garantir que o frete continue tendo uma única autoridade.

**Causa:** o checkout e `fn_taxa_entrega_calculada` aplicavam uma cascata `distância → bairro → taxa padrão`. Quando a loja não tinha coordenadas ou o endereço não era geocodificado, o cliente escolhia um bairro pré-definido e recebia uma taxa que não representa a distância real. O servidor repetia a mesma aproximação, então o POST continuava aceito.

**Entregue:**
- checkout só calcula e exibe frete depois de localizar o endereço completo; a tabela de bairros não é carregada nem exibida;
- raio, faixas comerciais e frete grátis por valor mínimo seguem como políticas aplicadas sobre a distância real;
- `fn_taxa_entrega_calculada` exige coordenadas da loja e do destino; não existe mais fallback de bairro/taxa padrão no checkout. Isso também protege POST direto;
- loja legada em modo `BAIRRO` é apresentada como `DISTANCIA` ao ser reconfigurada, exigindo georreferência antes de salvar;
- testes unitários cobrem distância + frete grátis e proíbem regressão para taxa de bairro; a integração passou a exigir rejeição para endereço sem coordenadas.

**Critérios de aceitação:** cliente não escolhe bairro para definir preço; endereço fora do raio é barrado; falha de geocodificação explica o que corrigir; frete grátis legítimo continua possível; o banco não aceita uma cobrança sem localização.

**Validação:** `tsc --noEmit` passou; `src/lib/geo.test.ts` e `__tests__/pedido-pix.test.ts` passaram (9 testes). A integração com Supabase exige as credenciais de ambiente e deve ser executada após aplicar a migration.

**Backlog registrado:**
- **P0 — go-live:** aplicar no banco as migrations 20260908130000–20260908180000 e publicar as functions de pagamento antes de validar o cardápio público; o código local sozinho não altera a vitrine em produção.
- **P1 — entrega:** mover a geocodificação para o servidor; hoje o frete não cai mais para bairro, mas ainda recebe do cliente a coordenada usada no cálculo.
- **P1 — KDS:** modelar modificadores estruturados (incluindo ponto da carne) e versões de ficha técnica para preservar o preparo histórico quando a receita mudar.

## 20-F. Sprint 11 — Carrinho não toca campainha (08/09)

**Separação de identidade operacional:** `AGUARDANDO_PAGAMENTO` é intenção de compra, não pedido aceito. Painel, dashboard, KDS e central de notificações agora usam a mesma regra: só entram na operação no INSERT de um pedido já operacional ou na transição de aguardando pagamento para aceito. Isso elimina o alerta ao abrir o formulário do cartão e também corrige métricas de venda/primeira venda contaminadas por carrinhos.

**Rótulo incorreto de buffet:** a mensagem “Lançado na Comanda (Consumo Salão / Buffet)” era aplicada a qualquer pedido sem cozinha. O rótulo agora deriva de `tipo_pedido` e `origem`: só salão/balança fala em comanda; delivery e retirada falam em pagamento confirmado e separação/expedição.

**Cartão:** a configuração de sandbox/produção e as credenciais Efí foram separadas; o split não cria repasse para o próprio recebedor. Recusa de conta (como limite operacional) bloqueia temporariamente o cartão da loja e apresenta Pix/outro meio ao cliente, enquanto o admin vê o motivo técnico e pode reativar depois da regularização. A confirmação do gateway continua sendo a única transição que coloca cartão/Pix na operação.

## 20-G. Sprint 12 — Bar não é cozinha com outro nome (08/09)

Produto passa a declarar `ALIMENTO`, `DRINK` ou `BEBIDA_PRONTA`; drink pode registrar ABV e volume da porção. O despacho KDS usa estação/workflow explícitos e tira da ficha técnica o snapshot de ingredientes, calorias, volume e teor alcoólico. O workflow padrão do bar virou “Separar ingredientes → Misturar/montar → Finalizar e servir”, preservando fluxos já personalizados.

A tela da estação exibe badge de drink, ABV, ml, kcal e ingredientes. As RPCs de despacho e avanço de ticket foram endurecidas com autorização por tenant/papel e `search_path` vazio; auxiliares e triggers deixaram de ser executáveis por `anon`/usuário autenticado.

## 20-H. Sprint 13 — Comanda viva, cupom distribuível e operação acessível (08/09)

**Comanda buffet:** a pesagem virou uma RPC transacional. A primeira leitura de cartão abre/reutiliza uma comanda individual; cada pesagem acumula numa conta ativa; o painel mostra somente comandas vivas com saldo e meio de pagamento. Receber grava o pagamento antes da finalização (preservando o ledger), fecha a comanda e a remove dos seletores operacionais, sem apagar o histórico rastreável. Código de barras/cartão e seleção manual usam o mesmo ciclo.

**Cupons:** cupom pode liberar frete grátis sem substituir a taxa por distância antes da validação; pode ser vinculado a um cliente; e a recuperação gera um `VOLTA####` individual, de uso único e 48 horas. WhatsApp abre com a mensagem pronta e o e-mail entra na fila central, respeitando consentimento, janela e deduplicação. A interface explica sucesso/erro e o botão tem carregamento, estado desabilitado e feedback visual.

**Sidebar:** módulos ganharam busca e grupos sanfonados com preferência persistida. O footer deixou de ocupar três linhas fixas e virou uma barra compacta para Loja Online, Conta e Sair, mantendo rótulos e tooltips quando a coluna está expandida ou recolhida.

## 20-I. Validação e estado de publicação (08/09)

- `tsc --noEmit`: passou.
- ESLint direcionado aos arquivos alterados: passou sem warnings.
- Vitest direcionado: 13 testes passaram; 2 integrações foram puladas porque `SUPABASE_SERVICE_ROLE_KEY` não está disponível nesta sessão.
- Bundle Vite de produção: gerado com sucesso (há somente o warning já conhecido de chunks acima de 600 kB).
- `git diff --check`: passou.
- **Não publicado nesta rodada:** migrations 20260908180000–20260908210000 e o código local da Edge Function precisam de deploy controlado. Portanto "concluído localmente" não significa que a vitrine de produção já mudou.

## 20-J. Sprint 14 — Publicação real das migrations 9–13, garçom acessa a comanda do buffet, cartão de crédito diagnosticado (09/09)

**Migrations aplicadas em produção nesta sessão** (todas as do Sprint 9–13 que só existiam localmente): `20260908170000_cartao_bloqueia_quando_conta_recusa`, `20260908180000_entrega_exige_localizacao`, `20260908190000_comanda_buffet_ciclo_de_vida`, `20260908200000_kds_drinks_ficha_e_perfil`, `20260908210000_cupom_frete_gratis`. Confirmado por consulta direta ao catálogo (colunas/funções) antes e depois de cada apply — não presumido pelo nome do arquivo.

**Comanda do buffet ganhou ciclo de vida completo e o garçom deixou de ficar de fora:**
- Nova migration `20260909000000_garcom_acessa_comanda_buffet.sql`: RPC `fn_lancar_item_avulso_comanda` (papel garçom incluso) lança bebida/sobremesa/repique em qualquer comanda ABERTA (mesa ou individual) sem depender de mesa_id; `fn_registrar_pesagem_comanda` passa a abrir um chamado de atendimento automático na 1ª pesagem, configurável por loja via `lojas.modulos_ativos.buffet_aciona_garcom` (ausente = ligado).
- Corrigido bug bloqueante: o papel `garcom` não tinha rota nem item de menu para `/admin/garcom-mobile` (`src/lib/permissoes.ts`, `AdminLayout.tsx`) — nenhum garçom conseguia abrir a tela.
- `PainelGarcomMobile.tsx` ganhou a seção "Comandas do Buffet Abertas" com modal de lançamento de item.
- `PainelBalanca.tsx`: o modal de recebimento tinha sido escrito só como lógica (estados + função), sem o JSX de renderização — corrigido; agora mostra lista de itens consumidos, tempo em aberto e seleção de forma de pagamento.
- `PedidoActions.tsx`: o menu "Imprimir via" ficava cortado pelo `overflow-hidden` do card do pedido (dropdown `position:absolute` dentro de um container com cantos arredondados). Corrigido com `createPortal` direto no `body`, posição calculada a partir do botão real.
- Completado um "prometido e não implementado": o Dashboard já avisava "reative o cartão em Configurações da Loja" quando o cartão online é bloqueado por recusa de conta, mas não existia botão nenhum. Adicionado botão "Já resolvi — reativar cartão" direto no banner do Dashboard, chamando `fn_liberar_cartao_online`.

**Cartão de crédito do checkout online — diagnosticado e contornado, não "consertado por código":**
- A recusa (Efí, código `4600037`: "o valor da emissão é superior ao limite operacional da conta") não é bug de integração. Confirmado por: (1) autenticação OAuth bem-sucedida com as credenciais certas — logo não é credencial inválida; (2) o mesmo `payee_code` já configurado no banco bate com a conta citada no erro; (3) o Pix funciona normalmente na mesma conta, isolando o problema ao produto "Cobranças/Cartão"; (4) o histórico de `pagamentos` mostra uma cobrança de R$5,00 **aprovada de verdade em 15/07/2026** (`gateway_txid 1037783079`) — só que naquela época com as credenciais da conta **pessoal**, não da PJ.
- **Decisão temporária do Rafael:** processar cartão pela conta Efí **pessoal** dele até a Efí liberar o limite operacional da conta **PJ** ("Maldivas Tech"). Trocado: `configuracoes_fiscais_plataforma.efi_payee_code` e `lojas.efi_payee_code` (das lojas que apontavam para o payee da PJ) para o identificador da conta pessoal; secrets `EFI_COBRANCAS_CLIENT_ID/SECRET` (as que a Edge Function publicada usa) trocadas para as credenciais da conta pessoal. Os identificadores e credenciais reais das duas contas (PF e PJ) ficam só em `C:\Users\rafae\Dev\Doc_EfiBank\` (fora do repositório) e no banco (secrets do Supabase) — nunca em texto plano neste arquivo.
- **RISCO REGISTRADO — reverter depois:** enquanto essa configuração estiver no ar, o dinheiro do cartão cai no CPF do Rafael, não no CNPJ da Maldivas Tech. Isso é aceitável como medida de curtíssimo prazo para não perder venda, mas precisa ser revertido (voltar `efi_payee_code` e as secrets para os valores da PJ, documentados em `Doc_EfiBank/conta_pj/Credenciais_EfiBank.txt`) assim que o suporte da Efí liberar o produto de Cobranças da PJ. Quem herdar este código deve checar isso ANTES de assumir que "cartão funciona" significa "cartão funciona na conta certa".
- Código-fonte da Edge Function (`supabase/functions/cartao-pagar/index.ts`) não foi alterado nesta sessão — a correção foi só de configuração (secrets + payee_code no banco). O diff já existente no working tree (separação `EFI_CARTAO_PROD/HOMOLOG_CLIENT_ID/SECRET`, escrito antes desta sessão) continua pendente de revisão e deploy; as secrets desse esquema novo já foram populadas com os valores da PJ como preparação, e precisam ser atualizadas para a pessoal também caso esse código seja publicado antes da reversão acima.

**Validação desta sessão:** `tsc --noEmit` limpo após cada leva de edições de frontend. Migrations verificadas por introspecção direta do catálogo antes/depois do apply. Autenticação OAuth testada em produção para ambas as contas Efí (PF e PJ) — sem nenhuma chamada de cobrança real de teste (não insiro dados de cartão). `vitest run` completo: 363 passaram, 14 puladas (sem `SUPABASE_SERVICE_ROLE_KEY`). Todo o trabalho desta sessão foi commitado em módulos separados (ver `git log`).

**Achado ao vivo, corrigido na mesma sessão:** durante o teste do Rafael pelo app do garçom, um pedido de Coca-Cola (revenda direta, `estacao_preparo='DIRETO'`) virou ticket na fila da cozinha, na etapa "Ponto da carne" — `fn_despachar_kds_tickets` nunca filtrou por `estacao_preparo`, bug presente desde o Sprint 5 (08/09) e herdado sem revisão suficiente na reescrita do Sprint 12. Corrigido em duas migrations (20260909010000, 20260909020000): a regra final é DIRETO só fica fora do KDS quando o produto não tem NENHUMA `estacao_kds_id` configurada — com estação explícita (ex.: bebida "pronta" que o Bar ainda serve com copo/gelo), o item passa por ela normalmente. Ver `[[miseon-backlog-kds-operador-e-cartao]]` (memória) para o backlog decorrente: fluxo do KDS personalizável por operador logado (pedido pelo Rafael, não implementado — mudança de escopo, precisa de sprint própria).

- **Publicado nesta rodada:** todas as migrations do Sprint 9–14 aplicadas em produção (verificado por introspecção, não presumido); todo o código de frontend commitado em módulos. **Não publicado:** o código novo da Edge Function `cartao-pagar` (separação `EFI_CARTAO_PROD/HOMOLOG_CLIENT_ID/SECRET`) segue só commitado, não deployado — a correção de cartão desta sessão foi por configuração (secrets + payee_code), não por código novo. Nenhum `git push` foi feito ainda nesta sessão.


## Execução de 09/09 — cadastro fiscal e confirmação de pedido

**Entregue no banco:** migração `20260909160006_email_pedido_somente_apos_entrada_operacional`. O gatilho de confirmação agora ignora checkout pendente/cancelado e acompanha a entrada após pagamento integral. A reserva da fila retém confirmações antigas enquanto o pedido aguarda pagamento. Corrigida divergência de produção: regex com escapes duplicados rejeitava e-mails válidos. Privilégios internos mantidos (worker/service role). Deduplicação original preservada.

**Prova executada no banco:** `supabase/tests/email-pedido-operacional.sql`, somente na loja de provas, com subtransação revertida. PASS para intenção pendente, chamada direta à fila, fila antiga, aprovação, repetição, cancelamento, salão com cobrança posterior e ausência das fixtures ao terminar. Nenhum envio de teste, cobrança ou emissão fiscal foi disparado.

**Entregue na função fiscal:** `fiscal-pdf-nfse` versão 5. Cadastro de produção comparado com contrato social fornecido em arquivo privado: já estava correto. O defeito era a identidade/endereço fixos no gerador. PDF passa a ler a configuração fiscal e retirar RPS inventado, competência baseada no dia da impressão e afirmações tributárias fixas. Só disponibiliza registro emitido com número, código e data. Identifica o arquivo como resumo auxiliar do cadastro atual e oferece consulta oficial. PDF real baixado após deploy: razão social, endereço e complemento conferem com o contrato; sem endereço fictício nem RPS inventado. Não equivale à prova de autorização fiscal: consulta da Prefeitura não carregou nesta sessão.

**Frontend local:** cancelamento e estados finais não geram alerta de pedido novo. Ainda depende de publicação do frontend.

**Validação:** TypeScript PASS; Vitest 377 PASS / 14 SKIPPED; ESLint dos arquivos alterados PASS; Deno check/lint do gerador PASS; teste Deno do handler completo com HTTP simulado PASS; PDF de fixture renderizado e inspecionado. A prova SQL acima complementa a suíte de integração indisponível localmente; não comprova todos os fluxos do restaurante. Advisors executados: não há apontamento específico nas três funções alteradas; permanecem avisos preexistentes do projeto.

**Gates fiscais ainda abertos:** autorização consultável e recebimento real no assinante; cobrança/renovação/recusa/cancelamento e conciliação; snapshot histórico do prestador; controle de acesso do link legado (público por UUID, comportamento preservado); emissão com RPS sequencial seguro e idempotência. Não reprocessar fatura ambígua só para obter demonstração: produção tem registros em erro/processamento a reconciliar.

**Natureba:** os bloqueios de montagem/rodadas KDS, teste real de iFood, carga do catálogo, UX operacional, ensaio e migração seguem no plano. Não declarar cliente pronto nem POS/Cast/Kiosk homologados a partir destas correções.
