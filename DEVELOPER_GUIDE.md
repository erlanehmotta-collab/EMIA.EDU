# 🛡️ Guia Técnico de Segurança, Arquitetura e Conformidade Legal para Desenvolvedores
**Projeto:** EMIA.EDU / EMIA.EDUTECH  
**Data:** 2026-08-26  
**Autor:** Antigravity Engineering  

---

## 1. 🔐 Google Cloud Console & Consentimento do Usuário (Tela de Permissões)

### 📌 O que o usuário precisa autorizar?
Quando o usuário clica em **"Entrar com o Google"**, ele autoriza apenas os escopos mínimos necessários (Princípio do Menor Privilégio):
- `openid` (Identificação única segura)
- `email` (E-mail para vincular o histórico e créditos)
- `profile` (Nome e foto de perfil)

> [!IMPORTANT]
> **Consent Screen (Tela de Consentimento OAuth):**
> No [Google Cloud Console](https://console.cloud.google.com/apis/credentials/consent):
> 1. Adicione a **URL da Política de Privacidade** e **Termos de Serviço** do aplicativo.
> 2. Mantenha os escopos como **Não-Sensíveis** (`email`, `profile`, `openid`).
> 3. Isso evita a necessidade de processo demorado de verificação restrita pelo Google.

---

## 2. 🛡️ Segurança de Chaves e Armazenamento (Zero Exposure)

### 🔑 Chaves de API do Usuário (KV Criptografado)
1. **Nunca exponha chaves no Client-Side (Navegador/Mobile):** O aplicativo mobile/web nunca deve expor a chave de API mestre do backend.
2. **Armazenamento no Cloudflare KV:**
   - As chaves de API vinculadas por usuário devem ser armazenadas com chave hash: `user_key:<sha256(email)>`.
   - Para conformidade estrita, use criptografia AES-GCM antes de gravar no KV se armazenar chaves de terceiros.
3. **Secrets no Cloudflare:**
   - Guarde a chave mestre de contingência (`MASTER_GEMINI_KEY`) usando:
     ```bash
     wrangler secret put MASTER_GEMINI_KEY
     ```

---

## 3. ⚖️ Conformidade Legal (LGPD / GDPR e Termos de Uso)

Para você **não ter nenhum problema jurídico ou de bloqueio**:

### A) Política de Privacidade e Termos de Serviço
Adicione no rodapé ou no fluxo de cadastro um checkbox/aviso claro:
> *"Ao utilizar o EMIA.EDU, você concorda que o processamento dos textos será realizado por meio de inteligência artificial generativa segura (Google AI) e que seus dados não serão utilizados para treinamento público de modelos."*

### B) Retenção de Dados
- Não armazene documentos acadêmicos completos permanentemente no banco sem consentimento expresso.
- Permita ao usuário o botão **"Limpar meus dados / Excluir histórico"** (exigência direta da LGPD - Art. 18).

---

## 4. ⚡ Estabilidade, Rate Limiting e Prevenção contra Abusos

### 🛑 Proteção contra Ataques de Negação de Serviço (DDoS) & Abuso de Quotas
1. **Rate Limiting no Cloudflare Worker:**
   - Configure limite de requisições por IP ou por usuário (ex: máximo de 10 gerações por minuto por conta):
     ```toml
     [ratelimit]
     namespace_id = "1001"
     simple = { limit = 10, period = 60 }
     ```
2. **Timeouts e Fallbacks:**
   - A chamada ao Gemini deve ter timeout máximo de 45 segundos.
   - Trate o erro `429 (Too Many Requests)` com retry exponencial (1s, 2s, 4s).

---

## 5. 🚀 Checklist de Deploy para Produção

- [ ] **Google OAuth Client ID:** Adicionar o domínio final de produção nos *Domínios Autorizados* e *Origens JavaScript Autorizadas*.
- [ ] **CORS Headers:** Restringir `Access-Control-Allow-Origin` de `*` para o domínio exato do seu app mobile/web em produção.
- [ ] **HTTPS Obrigatório:** Cloudflare Workers já operam 100% com SSL/TLS ativo.
- [ ] **Variáveis de Ambiente:** Confirmar que nenhuma credencial está 'hardcoded' no código-fonte do frontend.
