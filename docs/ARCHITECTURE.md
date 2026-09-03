# Arquitetura do Sistema: MiseOn SaaS 🏗️

Bem-vindo(a) à documentação arquitetural do MiseOn. O objetivo deste documento é permitir que novos desenvolvedores entendam a estrutura do sistema, o fluxo de dados e os princípios de segurança em poucos minutos.

---

## 1. Diagrama de Containers (Modelo C4 Simplificado)

O MiseOn é uma plataforma Cloud-Native *serverless*. Toda a complexidade de infraestrutura é abstraída por serviços gerenciados de alto desempenho, reduzindo custos e maximizando a escala.

```mermaid
C4Container
    title Arquitetura de Containers: MiseOn SaaS

    Person(lojista, "Lojista/Garçom", "Acessa o Painel e o PDV.")
    Person(cliente, "Cliente Final", "Acessa o Cardápio via QR Code na mesa ou Delivery.")

    System_Boundary(c1, "MiseOn Cloud") {
        Container(spa, "Single Page App (Vite + React)", "Hospedado no Vercel", "Interface rica. Gerencia estado com Zustand. Realiza as chamadas diretas (sem backend) via SDK do Supabase.")
        Container(supabase, "Supabase (Backend-as-a-Service)", "PostgreSQL, Auth, Realtime", "Coração dos dados e segurança (RLS). Mantém conexões WebSocket para atualizações em tempo real (Painel/KDS).")
        Container(edge, "Deno Edge Functions", "Supabase Edge", "Código seguro rodando próximo ao usuário. Usado exclusivamente para interações com APIs externas que exigem segredos corporativos.")
    }

    System_Ext(efi, "Efí Bank", "Gateway de Pagamentos Pix e Split.")

    Rel(lojista, spa, "Gerencia lojas e vendas via", "HTTPS")
    Rel(cliente, spa, "Navega e pede via", "HTTPS")
    
    Rel(spa, supabase, "Lê/Escreve dados autenticados via", "REST / WebSocket")
    Rel(spa, edge, "Invoca funções seguras via", "HTTP")
    
    Rel(edge, efi, "Gera cobrança e vincula split via", "mTLS (Certificado)")
    Rel(efi, edge, "Informa pagamentos via", "HTTP Webhook")
    Rel(edge, supabase, "Atualiza status do pagamento", "Service Role (Ignora RLS)")
```

---

## 2. Padrão de Multi-Tenancy e Segurança de Dados

O MiseOn é um sistema **B2B SaaS**, o que significa que atende centenas de clientes (Lojas) em um mesmo banco de dados compartilhado. A blindagem entre dados de lojas concorrentes é crítica.

**Como funciona o isolamento?**
- Todas as tabelas sensíveis no PostgreSQL (`produtos`, `pedidos`, `categorias`, `mesas`, `pagamentos`, etc.) possuem a coluna `loja_id`.
- A segurança **NÃO** depende do Frontend ou de lógicas de "filtragem" no código (`WHERE loja_id = X`).
- Utilizamos o poder do **Row Level Security (RLS)** do PostgreSQL. 

**Fluxo RLS na Prática:**
1. O usuário (dono da loja) faz login via *Supabase Auth*. Um token JWT é gerado.
2. Este usuário está cadastrado na tabela de permissões (`perfis_lojas`) com acesso ao seu respectivo `loja_id`.
3. As políticas SQL cadastradas no Supabase (RLS Policies) interceptam a query. Se o dono da *Loja A* tentar consultar a tabela de pedidos, o Postgres examinará o JWT dele e **automaticamente cortará** da resposta todos os pedidos da *Loja B*, mesmo que a query SQL do front-end fosse `SELECT * FROM pedidos`. 

---

## 3. Fluxo de Pagamento Pix (End-to-End)

Pagamentos financeiros exigem segurança, certificados TLS e confirmações assíncronas. Como não temos um backend Node.js tradicional, o fluxo intercala o Client e o Edge Computing.

```mermaid
sequenceDiagram
    participant C as Cliente (Frontend)
    participant S as Supabase (Banco)
    participant E as Edge Function (Criar Cobrança)
    participant F as Efí Bank (API Pix)
    participant W as Edge Function (Webhook)
    
    Note over C, S: Cliente no checkout escolhe pagar com Pix
    C->>S: 1. Cria Pedido (Status NOVO) e Pagamento (Status PENDENTE)
    C->>E: 2. Chama `pix-criar-cobranca` (Passa pedido_id)
    E->>S: 3. Lê Pedido e valida Valor com Função SQL p/ evitar spoofing
    E->>F: 4. Autentica com mTLS corporativo e envia Payload do Pix
    F-->>E: 5. Retorna `txid`, QR Code e Link Copia e Cola
    E->>S: 6. Salva o `txid` na tabela de Pagamentos
    E-->>C: 7. Devolve o QR Code para a tela
    
    Note over C, F: Cliente abre o app do banco e paga
    F->>W: 8. O Banco processa e chama o `pix-webhook` avisando o pagamento
    W->>F: 9. Webhook checa na Fonte (GET /cob/txid) para confirmar se foi pago de verdade (Segurança)
    W->>S: 10. Atualiza Pagamento p/ PAGO e Pedido p/ ACEITO
    S-->>C: 11. O canal WebSocket (Realtime) notifica a tela do cliente na hora, liberando-o!
```

---

## 4. Ledger Financeiro e Garantia Transacional (Fase 3)

Para lidar com finanças e comissões (iFood, etc.), o MiseOn implementa um sistema de **contabilidade de dupla entrada** diretamente no banco de dados.

**Arquitetura do Ledger:**
- Não calculamos o saldo de caixa ou o DRE somando o valor dos `pedidos`. 
- Ao invés disso, utilizamos a tabela `lancamentos_financeiros`. Cada entrada possui uma `conta_debitada`, uma `conta_creditada` e um `valor`.
- **Triggers Atômicas:** Quando um pedido atinge o status `FINALIZADO`, a trigger `fn_trg_status_pedido` executa `fn_lancar_receita_pedido`. Se o pedido é do iFood, a trigger automaticamente divide a receita líquida e a taxa retida em lançamentos separados.
- **Idempotência:** A coluna `receita_lancada` na tabela de pedidos garante que bugs na aplicação jamais resultem em receita duplicada no caixa.
- **DRE:** A *Demonstração de Resultado do Exercício* é materializada via a view `vw_dre_mensal`, calculando Lucro Bruto cruzando Receita, CMV e Estornos diretamente das naturezas contábeis.

---

## 5. Observabilidade em Tempo Real e Resiliência (Fase 3)

O sistema conta com um módulo de observabilidade ativa embarcado no cliente (`useLedgerAlerts`). 

O administrador da loja recebe alertas instantâneos via Toast caso o banco de dados reporte anomalias graves, ouvindo os canais do `Supabase Realtime`:
1. **Estorno Suspeito:** Um registro de estorno é criado muito tempo após a venda.
2. **Estoque Comprometido:** Um pedido foi Cancelado, mas o estoque já havia sido baixado (alerta para checagem física).
3. **Falhas Críticas de Webhook:** As Edge Functions enviam um broadcast no canal `webhook-erros` caso recebam requisições com assinatura HMAC inválida ou payloads corrompidos.

---

## 7. Engines WebGL 3D & Modelo Comercial SaaS 🚀

O MiseOn eleva o padrão dos sistemas B2B gastronômicos incorporando tecnologia gráfica WebGL de ponta diretamente no navegador:

### A. Salão 3D Inteligente por Assentos (`Mesas3DEngine.ts`)
- **Graphics Core**: Desenvolvido sobre **Three.js** com renderizador WebGL, sombras dinâmicas, materiais PBR (Physics-Based Rendering), pós-processamento com filtro de *Unreal Bloom* (anéis LED de status) e Raycasting de alta velocidade $O(1)$ para clique em mesas e assentos numerados.
- **Divisão Inteligente de Comandas**: `GarcomMesaDrawer.tsx` gerencia 3 modalidades de comanda:
  1. **Por Assento (Cadeira Individual)**: Mapeamento de itens por `assento_numero` (1-indexed).
  2. **Divisão Igualitária**: Rateio automático do saldo da mesa entre $N$ clientes.
  3. **Valor Livre/Parcial**: Lançamento de pagamentos parciais avulsos.
- **Temporizador de Permanência**: Badges flutuantes na HUD de AR exibem em tempo real o tempo decorrido desde a abertura da comanda (`⏱️ Xh Ym`), alertando a brigada de garçons.

### B. Grafo 3D PEPS de Custeio de Estoque (`CostGraphEngine.ts`)
- **Visualização Causal 3D**: Renderiza em tempo real o Grafo de Transformação de Lotes e Insumos baseados no princípio PEPS (Primeiro que Entra, Primeiro que Sai).
- **Conservação de Valor**: Visualização interativa da migração de custos da compra do insumo bruto até a porção vendida no produto final, com mapas térmicos de densidade de valor por lote.

### C. Modelo Comercial SaaS & Checkout Híbrido (`Assinatura.tsx`)
- **Checkout Integrado Efí Bank**: Faturamento transparente sem retenção de recebíveis por marketplaces.
- **Estrutura de Planos**:
  - **Plano Mensal**: R$ 169,90 /mês (Cobrança recorrente flexível sem fidelidade; R$ 161,40 no Pix com 5% OFF).
  - **Plano Anual**: R$ 149,90 /mês (Cobrança em até 12x no cartão de R$ 1.798,80/ano ou R$ 1.708,86 no Pix com 5% OFF; **R$ 240,00 de economia por ano**).
- **Liberdade de Meio de Pagamento**: Suporte instantâneo a Pix (QR Code dinâmico + copia-e-cola com confirmação por Webhook) e Cartão de Crédito tokenizado.

---

## 8. Tecnologias Críticas e Padrões

Neste projeto adotamos tecnologias modernas e ferramentas otimizadas:

- **Frontend Core**: Vite + React 19 + TypeScript. Optamos por *Strict Mode* total para garantir que não haja vazamentos de tipagem em *runtime*. 
- **Estilização**: TailwindCSS v4 + Componentes Radix UI adaptados (para Acessibilidade e Teclado). A arquitetura visual é modular (arquivos `<component>.tsx`).
- **Gerenciamento de Estado**: Embora usemos React Query (implícito) para cacheadas, usamos `Zustand` para estado global que não depende de servidor (ex: Carrinho de Compras, Modal de Configurações, Permissões de Usuário na sessão atual).
- **Code-Splitting Avançado:** A aplicação usa configuração customizada de chunks (`manualChunks` no Vite) e `React.lazy()` extensivo. Isso divide a aplicação em pedaços lógicos, carregando sob demanda e isolando libs pesadas (Three.js, Recharts, Leaflet, Konva), despencando o LCP inicial.
- **Tempo Real e Sincronização**: *Não gerenciamos WebSockets crus (Socket.io)*. Assinamos diretamente os canais do `Supabase Realtime`, permitindo que o Painel do Lojista (PDV e Pedidos) reaja instantaneamente a mudanças no banco (ex: um INSERT na tabela pedidos vira uma notificação visual em ms).
- **QA e Performance:** 
  - Testes unitários/integração via **Vitest**, que se conectam ao Supabase via `service-role` testando garantias de Dupla Entrada, Estornos e concorrências de pedidos diretamente no banco.
  - Testes de Estresse via **K6**, simulando +200 requisições simultâneas de Webhook Pix e validando os SLAs operacionais e a ausência de *Race Conditions*.
- **DevOps e Qualidade**: O repositório roda com proteção **Husky** + **Lint-Staged** no pre-commit. Nenhum código quebra regras do *ESLint (Flat Config)* ou violações do *TypeScript* chega à `main`.

