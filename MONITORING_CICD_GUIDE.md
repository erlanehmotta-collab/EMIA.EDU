# 🚀 Guia de CI/CD, Monitoramento em Tempo Real e Versionamento de APIs

Este guia orienta o desenvolvedor na configuração de **Integração Contínua (CI/CD)**, **Versionamento de APIs**, e **Monitoramento com Logs e Alertas em Tempo Real** (com planos 100% gratuitos).

---

## 1. 🔄 CI/CD Automatizado: GitHub Actions (100% Gratuito)

O repositório já conta com o fluxo configurado em [`.github/workflows/ci.yml`](file:///C:/Users/ERLANE/Documents/lovable/EMIA.EDU/.github/workflows/ci.yml).

### O que ele faz a cada `git push` ou `Pull Request`:
1. **Verificação de Tipos e Sintaxe:** Executa `tsc --noEmit` para garantir que nenhum erro quebre o código.
2. **Build Automatizado:** Testa a compilação do Frontend (Vite) e Backend (esbuild).
3. **Smoke Tests:** Valida a integridade dos artefatos gerados (`dist/index.html` e `dist/server.cjs`).
4. **Deploy Automático (Opcional):** Pode disparar o deploy direto no Cloudflare Workers / Pages.

---

## 2. 📊 Monitoramento de Erros e Logs em Tempo Real: Sentry (Plano Grátis)

O **Sentry** captura qualquer erro ou falha que aconteça na tela do usuário ou no servidor e envia um alerta instantâneo com a linha exata do problema.

### Como Ativar (Passo a Passo para o Desenvolvedor):
1. Crie uma conta gratuita em [https://sentry.io](https://sentry.io).
2. Crie um projeto **React / Node.js**.
3. Instale o SDK:
   ```bash
   bun add @sentry/react @sentry/node
   ```
4. Inicialize no arquivo principal:
   ```javascript
   import * as Sentry from "@sentry/react";

   Sentry.init({
     dsn: "SEU_SENTRY_DSN_AQUI",
     tracesSampleRate: 1.0,
   });
   ```

---

## 3. 📌 Versionamento e Blindagem de APIs (Prevenção contra Quebras)

Para evitar que mudanças repentinas do Google AI ou de provedores quebrem o aplicativo:

1. **Fixar Versões de Modelos:**
   - Use sempre identificadores versionados nos endpoints: `models/gemini-2.5-flash` ou `models/gemini-1.5-pro`.
   - Evite aliases voláteis sem controle de versão.
2. **Versionamento das Rotas da sua API:**
   - Adote o padrão de rotas versionadas: `/api/v1/generate`, `/api/v1/correct-spelling`.
   - Isso permite lançar melhorias na `v2` sem interromper os usuários da versão atual no aplicativo mobile/web.
3. **Fallback Graceful:**
   - Se a API externa retornar `429 (Rate Limit)` ou `503 (Indisponível)`, o backend automaticamente aciona o motor de contingência estocástico, garantindo que o usuário nunca receba uma tela em branco ou travada.

---

## 4. 📈 Cloudflare Analytics & Logs de Borda

No painel do Cloudflare Worker:
- Acesse **Workers & Pages > emia-edu-worker > Observability / Logs**.
- Ative o **Real-time Logs** para acompanhar as requisições em tempo real sem custo adicional.
