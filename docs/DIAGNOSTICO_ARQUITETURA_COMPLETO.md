# Diagnóstico Arquitetural Completo: MiseOn SaaS (Sprints 0 a 9+)

Atendendo à visão estratégica de negócio (HEAD OF ENGINEERING), realizei uma varredura profunda no código-fonte, nas *migrations* de banco de dados e nos componentes de frontend. O objetivo deste documento é contrastar a **Visão do Produto** com o **Estado Real do Código**, apontando exatamente o que já está alinhado e onde a arquitetura precisará evoluir ao longo dos Sprints.

---

## 1. Fonte de Verdade por Conceito e Criação de Pedidos (Alvo Sprint 0)

### 📌 Diagnóstico Real
- **Problema de Múltiplos Caminhos:** O sistema atual permite que componentes do frontend criem pedidos inserindo dados diretamente no banco via Supabase (`.insert()`). Isso acontece em `src/lib/pedidos.ts`, `PainelGarcomMobile.tsx`, `PDV.tsx`, `PainelBalanca.tsx` e `CartSidebar.tsx`.
- **Risco Operacional:** Em `PainelGarcomMobile.tsx`, por exemplo, o pedido é inserido mas a RPC de baixa de estoque (`fn_baixar_estoque`) **não é chamada**. O frontend está contornando as regras de negócio e assumindo uma autoridade que deveria ser exclusiva do backend.
- **Solução (Sprint 0):** Criar uma Edge Function ou RPC atômica (`create_order`) e remover todas as permissões de `.insert` direto na tabela `pedidos` via RLS.

## 2. Estoque e CMV (Alvo Sprints 1, 2 e 3)

### 📌 Diagnóstico Real
- **O que já está pronto (Base de Dados):** O backend passou por uma massiva refatoração recente (05/09/2026). As migrations (`20260905120000_estoque_autoridade_peps.sql`) já consolidaram o motor de PEPS. A função `fn_movimentar_estoque` é a nova fonte de verdade transacional, e os estornos já devolvem lotes com seus custos originais.
- **Onde o sistema falha:** Apesar do banco estar pronto, a camada de aplicação ainda não tira proveito total. A DRE e o cálculo do CMV em tempo real no dashboard ainda precisam centralizar a leitura dos eventos gerados por essas novas triggers.
- **Integração Inteligente (Sprint 3):** Já existem indícios de lógica no `src/lib/parseNFeXml.ts`, mas a conversão automática (XML → classificação de insumo → lote PEPS → fornecedor) ainda precisa de orquestração via Edge Functions (IA interpretando, humano confirmando).

## 3. Capacidades Operacionais vs Segmentos (Alvo Sprint 4)

### 📌 Diagnóstico Real
- **Estado do Código:** A tipagem (`src/types.ts`) e as configurações da loja ainda carregam vestígios de condicionais baseadas no segmento (ex: `segmento === 'pizzaria'`).
- **Visão:** O modelo deve migrar para **Capacidades**. Já existem propriedades na tabela de lojas como `usa_balanca`, mas o onboarding e a arquitetura devem abraçar abstrações reais: `tem_rodizio`, `usa_comandas`, `usa_kds`, `tem_multiplas_marcas`. O sistema deve reagir a essas capacidades combinadas.

## 4. KDS: Estações e Workflows (Alvo Sprint 5)

### 📌 Diagnóstico Real
- **Deficiência de Domínio Confirmada:** Em `src/pages/admin/KDS.tsx` e `src/types.ts`, a "estação de preparo" de um produto é um enum simples: `'COZINHA' | 'DIRETO'`. O KDS filtra os itens via *hardcode* (`filtroEstacao === 'BAR'`, `filtroEstacao === 'COZINHA'`).
- **Problema:** Não existe um "Roteador" flexível. Modificadores (como "ponto da carne") são frequentemente tratados como etapas isoladas, poluindo o fluxo de produção.
- **Evolução Necessária:** Implementar as tabelas de domínio `ESTAÇÃO → WORKFLOW → ETAPAS`. Produtos devem possuir roteamento de preparo e as etapas do KDS devem espelhar a montagem física de cada tipo de restaurante.

## 5. Payment Core e Desacoplamento (Alvo Sprint 6)

### 📌 Diagnóstico Real
- **Acoplamento Extremo:** O cliente web (`src/pages/Cardapio.tsx`) possui alto acoplamento com a Efí. O código injeta scripts diretamente da operadora (`window.EfiPay`) e a tabela de loja (`src/types.ts`) tem colunas literais como `efi_payee_code` e `efi_configurado`.
- **Risco:** Inviabiliza a entrada fácil de parceiros estratégicos (BRAVUS, totens e TEFs).
- **Evolução Necessária:** Construir a camada `PAYMENT CORE` (ex: Edge Function `processar-pagamento`). O domínio do MiseOn deve conhecer apenas `PaymentIntent`, `authorized`, `declined`. Os *adapters* para Efí ou Bravus ficam restritos ao backend.

## 6. MiseOn Displays e Pareamento (Alvo Sprint 7)

### 📌 Diagnóstico Real
- **Estado atual da TV:** Em `src/pages/PainelTV.tsx`, a exibição de senhas é regida pela URL acessada (com tokens e loja_id injetados no link). Se o operador errar a URL, não funciona.
- **Problema:** É estático e suscetível a erros de cópia e cola por operadores leigos.
- **Visão do Produto:** Transição para o modelo `DISPLAY DEVICE + DISPLAY SESSION`. O operador abre a TV, que mostra um código de 6 dígitos. No celular, o gerente pareia e diz "esta tela será o Cardápio de Promoções" ou "esta tela chamará as Senhas". 

## 7. UX, Automação e Escalabilidade (Alvo Sprints 8 e 9+)

### 📌 Diagnóstico Real
- **Telas Pesadas:** Componentes como `Loja.tsx` (110kb) e `Estoque.tsx` (78kb) concentram muita regra e chamadas que sobrecarregam o ciclo de vida do React.
- **Escalabilidade (Multiloja):** O RLS hoje isola perfeitamente as lojas (tenant_id). No entanto, para suportar a capacidade de **Múltiplas Marcas ou Dark Kitchens** sob a mesma operação compartilhando estoque, o banco exigirá o conceito de "Rede/Org" contendo várias "Lojas".
- **Observabilidade:** O modelo de jobs/filas e polling precisará de idempotência, algo que a fundação das *migrations* mais recentes começou a endereçar, mas que o Node.js precisará suportar firmemente.

---

## 🎯 Veredito do Head of Engineering

O MiseOn não precisa de um *rewrite*. Suas fundações financeiras (ledger de dupla entrada), sistema nutricional, RLS e PEPS são módulos de alta complexidade que funcionam muito bem e devem ser preservados.

O fator limitante para a expansão SaaS profissional é o **Vazamento de Domínio**:
1. O frontend está tomando decisões financeiras e de estoque que deveriam estar travadas no backend.
2. Módulos fundamentais (KDS, Pagamentos, TVs) ainda não possuem as abstrações estruturais (interfaces) que permitam escalar clientes maiores e adicionar fornecedores variados.

O **Sprint 0 (Go-Live e Integridade)** e o **Roadmap Proposto** mapeiam exatamente as feridas identificadas no código. A transição gradual (uma fonte de verdade por vez) garantirá estabilidade e viabilizará a monetização futura.
