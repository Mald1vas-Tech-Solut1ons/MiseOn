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
- **Diagnóstico Atual**: Oportunidades claras de automação e correção de divergências e PEPS duplicado.

## 6. Estado de Pedidos
- **Diagnóstico Atual**: Múltiplos caminhos de criação de pedido espalhados pela base, o que gera inconsistências, regras duplicadas e brechas.
- **Visão**: Unificar a criação e manipulação em um pipeline previsível de intenção, validação e consolidação.

## 7. Estado do KDS
- **Diagnóstico Atual**: Módulo maduro que será mantido, porém com deficiência conceitual em modelagem de estações e modificadores.
- **Modelo Futuro (Incremental)**: Estação → Workflow → Etapas; Item → Roteamento → Estação; Item → Modificadores/Requisitos de Preparo (ex: "ponto da carne" deve ser modificador, não etapa de workflow).

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
- Desacoplar etapas de KDS de modificadores de produto (roteamento inteligente).

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

## 19. Sprint Atual
- **SPRINT 0: Go-Live e Integridade do Sprint Anterior** (Veja definição abaixo).

## 20. Decisões do Dono
- Focar sempre na redução da carga cognitiva e esforço operacional do restaurante. O sistema deve aprender a operação, não o inverso.
- O modelo técnico e arquitetural deve garantir flexibilidade para monetização modular (planos, TEF, ecossistema, módulos premium) sem engessar a base.

## 21. Architectural Decision Records (ADRs)
*(Este espaço receberá documentação e contexto sobre decisões estruturais (ex: escolha do formato de modelagem das capacidades, contratos do Payment Core) conforme o andamento das Sprints).*
