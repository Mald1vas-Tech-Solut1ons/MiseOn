# Incidente de credenciais expostas — apuração e plano de resposta

Apurado em 2026-07-22 · Repositório `github.com/MaldivaSky/MiseOn` — **público**

---

## 1. Fato

O repositório é público desde o primeiro commit (2026-07-13). Três credenciais
reais foram versionadas e estão no histórico do Git, portanto **mundialmente
legíveis** e presumidamente já coletadas: bots varrem o GitHub em busca
exatamente disso, normalmente em minutos após o push.

| # | Credencial | Onde | Commits afetados | Gravidade |
|---|---|---|---|---|
| C1 | Senha de app do Gmail | `supabase/functions/send-transactional-email/index.ts` | ~20 | **Crítica** |
| C2 | Senha do superadmin da plataforma | `src/pages/superadmin/Login.tsx` | ~145 | **Crítica** |
| C3 | Senha fixa do tenant de provas | `supabase/seed_lanchepaulista_usuarios.sql` | ~105 | Média |

**Não vazaram** (verificado): `.env`/`.env.local` nunca foram commitados;
nenhum token pessoal Supabase (`sbp_`), chave Groq (`gsk_`), chave AWS ou
service role key aparece no histórico. Os únicos JWT encontrados são as chaves
de demonstração do Supabase **local**, públicas por definição.

### Por que C2 é a mais grave

C1 dá acesso à caixa de e-mail pessoal. C3 atinge só dados de teste.

C2 era a senha do painel **superadmin**, em texto puro dentro do bundle
JavaScript servido ao navegador — ou seja, exposta duas vezes: no repositório
público e para qualquer visitante do site. Esse painel enxerga **todos os
tenants**, o que inclui dados pessoais de clientes finais (nome, telefone,
endereço, histórico de pedidos).

---

## 2. O que já foi feito no código

- C1, C2 e C3 removidos da árvore de trabalho.
- O seed do tenant de provas passou a sortear a senha em execução e exibi-la
  apenas no `NOTICE` — nunca gravada em arquivo.
- `validacao/validar-rastreio3d.mjs` passou a exigir `MISEON_SEED_SENHA` do
  ambiente.
- A chave de exemplo em `.env.local.example` virou placeholder.
- **Barreira de pre-commit**: `scripts/verificar-segredos.mjs`, ligado ao husky.

O scanner reconhece chaves privadas, tokens de Supabase/Groq/OpenAI/GitHub/AWS,
senha de app do Gmail, JWT e senha literal em atribuição. Padrões inconfundíveis
disparam **sempre**, mesmo que a linha contenha "example" ou leia de variável de
ambiente — porque a forma exata do vazamento C1 era
`Deno.env.get('X') || 'segredo-literal'`, e um filtro ingênuo ficaria cego
justamente para ela.

Varredura completa: `node scripts/verificar-segredos.mjs --tudo`

---

## 3. O que só você pode fazer — e é o que de fato resolve

> **Remover do código não desfaz o vazamento.** O histórico do Git é permanente
> e o repositório é público: clones, forks, caches do GitHub e scrapers já
> copiaram. A partir do momento em que um segredo é publicado, ele deve ser
> considerado comprometido para sempre. **A única correção real é rotacionar.**

### R1 — Senha de app do Gmail (fazer primeiro)

1. Acesse a conta Google → Segurança → Verificação em duas etapas → Senhas de app.
2. **Revogue** a senha de app existente usada pelo MiseOn.
3. Gere uma nova senha de app.
4. Atualize o secret `GMAIL_APP_PASSWORD` no Supabase
   (Project Settings → Edge Functions → Secrets).
5. Revise a atividade recente da conta Google e encerre sessões desconhecidas.

O envio de e-mail para de funcionar entre os passos 2 e 4 — a fila segura os
e-mails como `PENDENTE` e reenvia depois, sem perda.

### R2 — Senha do superadmin

1. Troque a senha da conta superadmin no Supabase Auth (Dashboard →
   Authentication → Users), usando senha forte e única.
2. Confirme que ela **não é reutilizada** em nenhum outro serviço; se for,
   troque nos outros também.
3. Ative MFA nessa conta.
4. Audite `auth.audit_log_entries` procurando logins que você não reconheça.

### R3 — Tenant de provas

Rode novamente o `seed_lanchepaulista_usuarios.sql` já corrigido, que gera senha
nova. As contas antigas são recriadas.

### R4 — Prevenção na plataforma

Ative no GitHub (Settings → Code security):
**Secret scanning** e **Push protection**. Push protection bloqueia o envio
antes do segredo chegar ao servidor — é a rede que pega o que passar do hook
local (por exemplo, um `commit --no-verify`).

---

## 4. Decisão pendente: reescrever o histórico?

> **REGISTRO DE DECISÃO (05/09/2026) — pendência encerrada.**
> Decisão do dono: **não rotacionar** e **não reescrever o histórico**.
> Forense exata (508 commits no repo): C1 presente em **22 revisões**
> (introduzida `dda7efa` 21/07, removida `b8b965b` 22/07); C2 em **144 revisões**
> (`b8a475d` 14/07 → removida `8e376fd` 22/07); C3 em **104 revisões**
> (`cc662de` 14/07 → removida `8e376fd` 22/07). Nenhum outro segredo no
> histórico (verificado: tokens `sbp_`, chaves Efí, service role key e
> certificados nunca foram commitados — `.gitignore` os capturou desde o início).
> **Risco residual assumido e formalmente registrado**: os 3 valores são
> públicos e devem ser considerados comprometidos para sempre; o painel
> superadmin da época compartilhava lógica de autenticação com a senha exposta
> (removida da árvore, mas o valor permanece utilizável até rotação). A
> recomendação de rotação (R1–R3) permanece de pé e é pré-requisito
> recomendado antes do primeiro cliente pagante.

Depois de rotacionar, as credenciais antigas viram inúteis e o histórico deixa
de ser um risco ativo. Reescrever é opcional e tem custo.

| | Manter o histórico | Reescrever (`git filter-repo` + push forçado) |
|---|---|---|
| Risco após rotação | Nenhum: valores inválidos | Nenhum |
| Esforço | Zero | Médio |
| Efeito colateral | Segredos antigos seguem legíveis | Todos os SHA mudam; clones/forks quebram; PRs abertos precisam ser refeitos |
| Eficácia | — | **Parcial**: não alcança forks, clones locais nem caches do GitHub sem abrir chamado no suporte |

**Recomendação:** rotacionar (R1–R4) e **não** reescrever agora. A reescrita dá
sensação de limpeza sem entregar segurança — o que protege é a rotação. Se o
objetivo for higiene do repositório para due diligence ou investidor, vale
fazer, mas como tarefa planejada e depois da rotação.

**Alternativa mais simples e honesta:** se o código não precisa ser público,
**tornar o repositório privado** elimina a exposição contínua com um clique, e
o histórico deixa de estar acessível a estranhos.

---

## 5. LGPD — o que a lei exige aqui

**Papéis (Art. 5º).** O MiseOn é **operador** dos dados dos clientes finais
(trata por conta do restaurante) e **controlador** dos dados dos lojistas.
Cada restaurante é **controlador** dos dados dos seus clientes. Isso precisa
estar escrito no contrato — hoje não está.

**Comunicação de incidente (Art. 48).** Há dever de comunicar ANPD e titulares
quando o incidente "possa acarretar risco ou dano relevante". Avaliação deste
caso:

- C2 dava acesso potencial a dados pessoais de clientes finais.
- A plataforma está em **pré-lançamento, sem cliente pagante**, e os tenants
  existentes são de demonstração e provas. Não há indício de acesso indevido.
- **Conclusão:** risco de dano relevante a titulares reais é baixo, e a
  comunicação formal provavelmente não é exigida. **Registre esta avaliação
  com data** — o Art. 48 exige demonstrar a análise, não só o resultado.

**A partir do primeiro cliente pagante, essa conclusão muda.** Com dados reais
em produção, incidente equivalente exige comunicação à ANPD em prazo razoável e
aos titulares afetados.

### Pendências contratuais antes do lançamento

1. **Contrato de operador** (Art. 39) entre MiseOn e cada lojista: finalidade,
   escopo, medidas de segurança, subcontratados (Supabase, Vercel, Efí, Google,
   Groq) e destino dos dados no encerramento.
2. **Transferência internacional** (Art. 33): Supabase e Vercel hospedam fora
   do Brasil. O projeto Supabase está em `us-west-2` — precisa de base legal e
   informação ao titular. Migrar para `sa-east-1` simplificaria bastante.
3. **Política de retenção**: hoje nada expira. Definir prazo para pedidos,
   `email_log`, `chat_messages` e localização de entregador — dado que não
   existe mais não vaza.
4. **Canal do titular** (Art. 18): acesso, correção, portabilidade e eliminação.
   O descadastro de e-mail (`/email/descadastro`) já cobre a parte de marketing.
5. **Encarregado (DPO)** nomeado e publicado (Art. 41).

---

## 6. Ordem recomendada

1. **R1** — revogar e trocar a senha de app do Gmail. *(hoje)*
2. **R2** — trocar a senha do superadmin e ativar MFA. *(hoje)*
3. **R4** — ligar secret scanning e push protection no GitHub. *(hoje)*
4. Commitar as correções deste documento e do scanner.
5. **R3** — recriar as contas do tenant de provas.
6. Decidir sobre repositório privado vs. reescrita de histórico.
7. Contratos e política de retenção — antes do primeiro cliente pagante.
