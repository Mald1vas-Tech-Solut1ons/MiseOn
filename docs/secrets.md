# Diretrizes de Gestão de Segredos e Segurança — MiseOn SaaS 🛡️

Este documento define os protocolos de segurança, manuseio de chaves privadas, rotação de credenciais e comunicação mTLS adotados na plataforma MiseOn.

---

## 1. Princípios Fundamentais de Segurança

1. **Zero Hardcoded Credentials**: Nenhuma chave privada, token de API, senha de banco de dados ou certificado deve residir em arquivos de código-fonte versionados no Git.
2. **Repositório Público Blindado**: O repositório do MiseOn é público. Todo commit é verificado antes de ser efetuado pelo script `scripts/verificar-segredos.mjs`.
3. **Escopo Mínimo de Acesso**: As chaves públicas (`VITE_SUPABASE_ANON_KEY`) possuem privilégios restritos regidos por políticas RLS no PostgreSQL. A chave administrativa (`SUPABASE_SERVICE_ROLE_KEY`) é de uso exclusivo de Edge Functions no lado do servidor.
4. **Isolamento de Tenants (RLS)**: Os dados entre lojistas são isolados no PostgreSQL através de Row Level Security. Nenhuma consulta do cliente final tem acesso a dados de outros estabelecimentos.

---

## 2. Varredura Automática de Segredos (Pre-Commit)

A plataforma implementa uma barreira automática contra vazamento acidental de credenciais via Git Hooks (Husky) e Node.js.

### Como funciona a verificação
O script `scripts/verificar-segredos.mjs` analisa os arquivos modificados buscando padrões conhecidos de credenciais:
- Chaves Privadas RSA/EC/OpenSSH (`-----BEGIN [TIPO] PRIVATE KEY-----`)
- Tokens de Acesso Pessoal Supabase (`sbp_...`)
- Chaves de API de IA (Groq `gsk_...`, OpenAI `sk-...`)
- Tokens do GitHub (`ghp_...`, `gho_...`)
- Chaves de Acesso AWS (`AKIA...`)
- Tokens JWT (`eyJ...`) e atribuições literais de senhas

### Como executar manualmente
```bash
# Executar a varredura em toda a árvore do repositório
node scripts/verificar-segredos.mjs --tudo
```

---

## 3. Manuseio de Certificados Digitais e mTLS

### A. Certificado de Autenticação Efí Bank (Pix mTLS)
- A API Pix do Efí Bank exige mTLS (Mutual TLS authentication).
- O certificado `.p12` emitido no painel do banco deve ser convertido para Base64 antes de ser armazenado como secret no Supabase:

```bash
# Converter o certificado .p12 para Base64 em linha única (Linux / Mac)
base64 -w 0 certificado_efi.p12 > efi_base64.txt

# No Windows PowerShell:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado_efi.p12")) | Set-Content efi_base64.txt
```

### B. Certificado Digital A1 de Emissão de NFS-e (SEFAZ SP)
- O certificado A1 (`.pfx`) utilizado para assinar as requisições SOAP de emissão de NFS-e é convertido da mesma forma e armazenado de forma criptografada no Supabase Vault ou cadastrado via Edge Function administrativa.

---

## 4. Protocolo de Rotação de Segredos em Caso de Vazamento

Caso qualquer chave ou secret seja exposto acidentalmente:

1. **Rotacionar Imediatamente**: Acesse o provedor do serviço (Supabase, Efí Bank, Google Cloud, Meta) e revogue a chave exposta, gerando uma nova.
2. **Atualizar Cofre de Produção**: Aplique o novo secret via `supabase secrets set` ou painel do Vercel.
3. **Limpar Histórico se Necessário**: Utilize `git filter-repo` ou `BFG Repo-Cleaner` caso um arquivo sensível tenha sido commitado. Nota: alterar o histórico não substitui a rotação da chave no provedor!

---

## 5. Auditoria e Logs

- Requisições enviadas para Edge Functions registram IP e usam limitação de taxa (Rate-Limiting) via `_shared/rate-limit.ts`.
- Operações de autenticação e tentativas com privilégios de superadmin são registradas em logs de auditoria do banco de dados.
