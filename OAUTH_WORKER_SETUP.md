# 📋 Checklist e Instruções Exatas para o Desenvolvedor: Google OAuth + Cloudflare Worker

Este documento contém os 4 pontos exatos que o desenvolvedor precisa revisar e confirmar no **Google Cloud Console** e no **Cloudflare Worker** para garantir o funcionamento 100% estável.

---

## 1. 🔑 Google Cloud Console: Client ID, Redirect URIs e JavaScript Origins

No painel: [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials):

1. **Tipo de Credencial:** OAuth 2.0 Client ID (Web Application / Single Page Application).
2. **Origens JavaScript Autorizadas (Authorized JavaScript origins):**
   - Para desenvolvimento local: `http://localhost:3000` e `http://localhost:5173`
   - Para produção Web / PWA: `https://seu-dominio.com` ou `https://seu-app.pages.dev`
3. **URIs de Redirecionamento Autorizados (Authorized redirect URIs):**
   - `http://localhost:3000`
   - `https://seu-dominio.com`
   - Se estiver usando Cloudflare Worker como callback direto: `https://<seu-worker>.workers.dev/oauth/callback`

---

## 2. 🛡️ Escopos de Autenticação (OAuth Consent Screen)

No painel: [Google Cloud Console > APIs & Services > OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent):

Certifique-se de que os escopos autorizados são exatamente estes:
- `openid`
- `https://www.googleapis.com/auth/userinfo.email` (`email`)
- `https://www.googleapis.com/auth/userinfo.profile` (`profile`)

> [!NOTE]
> Se desejar que a chamada à IA Gemini seja autorizada diretamente pelo token do usuário (sem exigir que ele forneça uma API Key separada), adicione também:
> - `https://www.googleapis.com/auth/generative-language.tuning` ou escopo de acesso ao Google Generative Language API.

---

## 3. ⚙️ Cloudflare Worker: Validação de Token e Troca de Chave

No arquivo [`worker.js`](file:///C:/Users/ERLANE/Documents/lovable/EMIA.EDU/worker.js):

1. **Validação do Token de Acesso:**
   O worker recebe o header `Authorization: Bearer <access_token>` e faz a validação em:
   ```javascript
   const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
     headers: { Authorization: `Bearer ${googleToken}` }
   });
   ```
2. **Resgate da Chave de API no KV:**
   Ao obter o `email` autenticado, o Worker busca no Cloudflare KV a chave de API registrada para aquele usuário:
   ```javascript
   targetApiKey = await env.USER_KEYS_KV.get(`user_key:${userEmail}`);
   ```
3. **Encaminhamento para o Google AI (Gemini):**
   O worker repassa o prompt com a chave para:
   `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${targetApiKey}`

---

## 4. 🚀 Resumo para o Desenvolvedor

- **Arquitetura Imutável:** O fluxo OAuth + Cloudflare Workers é o padrão de mercado mais estável (State-of-the-Art).
- **Ajuste Único:** Uma vez que o **Client ID**, os **Domínios Autorizados** e o **KV Namespace ID** estiverem preenchidos no `wrangler.toml` e no `App.tsx`, nenhuma alteração adicional na arquitetura será necessária.
