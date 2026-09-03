# Matriz de Variáveis de Ambiente — MiseOn SaaS 🌐

Este documento especifica a matriz de variáveis de ambiente necessárias para a execução do frontend (Vite/React) e do backend/Edge Functions (Supabase Deno).

> [!IMPORTANT]
> **Regra de Ouro**: Nenhuma variável de ambiente de produção ou chave privada deve ser commitada neste repositório. Utilize arquivos `.env.local` (que estão no `.gitignore`) para desenvolvimento local e o cofre de secrets da plataforma para produção.

---

## 1. Variáveis Globais de Frontend (`.env.local` / Vercel)

As variáveis prefixadas com `VITE_` são injetadas no bundle JavaScript do navegador durante a compilação do Vite. **Não coloque chaves privadas ou senhas nessas variáveis**.

| Nome da Variável | Descrição / Finalidade | Onde Configurar | Exemplo de Valor (Placeholder) |
|---|---|---|---|
| `VITE_SUPABASE_URL` | URL de conexão pública do projeto Supabase | `.env.local` & Vercel | `https://<seu-projeto>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Chave pública anônima do Supabase (opera com RLS) | `.env.local` & Vercel | `eyJhbGciOiJIUzI1Ni...` |
| `VITE_MISEON_EFI_PAYEE_CODE` | Identificador Payee Code da plataforma no Efí Bank | `.env.local` & Vercel | `1a2b3c4d5e6f7g8h9i0j` |

---

## 2. Segredos de Edge Functions (`Supabase Secrets`)

Estas variáveis são acessadas exclusivamente no servidor pelas Deno Edge Functions via `Deno.env.get('NOME')`. **Elas nunca vazam para o navegador**.

### Segredos do Supabase (Nativos)
| Nome da Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL interna do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave administrativa (bypassa RLS — acesso restrito às Edge Functions) |
| `SUPABASE_ANON_KEY` | Chave anônima para chamadas autenticadas |

### Segredos de Pagamento (Efí Bank)
| Nome da Variável | Descrição |
|---|---|
| `EFI_CLIENT_ID` | Client ID da conta Efí Bank da plataforma |
| `EFI_CLIENT_SECRET` | Client Secret da conta Efí Bank da plataforma |
| `EFI_PIX_CLIENT_ID` | Client ID específico para operações Pix (ou fallback `EFI_CLIENT_ID`) |
| `EFI_PIX_CLIENT_SECRET` | Client Secret específico para operações Pix |
| `EFI_COBRANCAS_CLIENT_ID` | Client ID específico para cobranças de cartão/boleto |
| `EFI_COBRANCAS_CLIENT_SECRET` | Client Secret específico para cobranças de cartão/boleto |
| `EFI_PIX_KEY` | Chave Pix cadastrada da plataforma MiseOn |
| `EFI_CERT_BASE64` | Certificado `.p12` da Efí Bank convertido para Base64 (mTLS) |
| `EFI_SANDBOX` | Define ambiente sandbox (`true`) ou produção (`false`) |

### Segredos Fiscais (NFS-e Prefeitura SP / Certificado A1)
| Nome da Variável | Descrição |
|---|---|
| `NFSE_SP_CNPJ_PRESTADOR` | CNPJ da empresa prestadora dos serviços (MiseOn) |
| `NFSE_SP_IM_PRESTADOR` | Inscrição Municipal do prestador na Prefeitura de SP |
| `NFSE_SP_CERT_PFX_BASE64` | Certificado Digital A1 (`.pfx`) convertido para Base64 |
| `NFSE_SP_CERT_PASSWORD` | Senha de proteção do certificado digital A1 |

---

## 3. Comando para Aplicação de Segredos via Supabase CLI

```bash
# Aplicação de segredos para Edge Functions em produção
supabase secrets set \
  EFI_CLIENT_ID="<SEU_CLIENT_ID>" \
  EFI_CLIENT_SECRET="<SEU_CLIENT_SECRET>" \
  EFI_PIX_KEY="<SUA_CHAVE_PIX>" \
  EFI_CERT_BASE64="$(cat efi_cert_base64.txt)" \
  EFI_SANDBOX="false" \
  NFSE_SP_CNPJ_PRESTADOR="<CNPJ_NUMERICO>" \
  NFSE_SP_IM_PRESTADOR="<IM_NUMERICA>" \
  NFSE_SP_CERT_PFX_BASE64="$(cat cert_pfx_base64.txt)" \
  NFSE_SP_CERT_PASSWORD="<SENHA_DO_CERTIFICADO>" \
  --project-ref <SEU_SUPABASE_PROJECT_REF>
```
