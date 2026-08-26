/**
 * Cloudflare Worker for EMIA.EDU
 * 
 * Flow:
 * 1. Listens for incoming HTTP requests from the mobile / web application.
 * 2. Authenticates Google OAuth 2.0 access_token to verify user identity.
 * 3. Securely retrieves the user's stored Google Gemini API key from Cloudflare KV.
 * 4. Forwards the request (with the user's API key) to the Google AI (Gemini) service.
 * 5. Returns the generated response back to the application.
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-gemini-api-key, x-user-email",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-gemini-api-key, x-user-email",
    };

    // Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(JSON.stringify({ status: "online", service: "EMIA.EDU Cloudflare Worker" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Authentication Layer: Verify Google OAuth Token
    const authHeader = request.headers.get("Authorization") || "";
    const googleToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    let userEmail: string | null = null;

    if (googleToken && googleToken.length > 20) {
      try {
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${googleToken}` },
        });

        if (userInfoRes.ok) {
          const userData: any = await userInfoRes.json();
          userEmail = userData.email || null;
        }
      } catch (err) {
        console.warn("[OAuth Verification Warning]:", err);
      }
    }

    // Fallback: check custom user email header if OAuth token not sent directly
    if (!userEmail) {
      userEmail = request.headers.get("x-user-email");
    }

    // 3. Endpoint: Securely store / bind user's API Key to their Google Account in KV
    if (url.pathname === "/api/save-user-key" && request.method === "POST") {
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "Autenticação Google obrigatória." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body: any = await request.json().catch(() => ({}));
      const apiKey = body.apiKey?.trim();

      if (!apiKey || apiKey.length < 10) {
        return new Response(JSON.stringify({ error: "Chave de API inválida." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (env.USER_KEYS_KV) {
        await env.USER_KEYS_KV.put(`user_key:${userEmail}`, apiKey);
      }

      return new Response(JSON.stringify({ success: true, message: "Chave de API vinculada com sucesso à sua conta Google." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Endpoint: Forward Generation Requests to Google AI (Gemini Service)
    if (url.pathname === "/api/generate" && request.method === "POST") {
      try {
        const reqBody: any = await request.json();
        const prompt = reqBody.prompt || "Escreva um trabalho acadêmico.";
        const model = reqBody.model || "gemini-2.5-flash";

        // Prioridade 1: MASTER_GEMINI_KEY (modelo SaaS — você paga, cobra do usuário)
        let targetApiKey = env.MASTER_GEMINI_KEY || null;

        // Prioridade 2: chave do usuário no header (opcional)
        if (!targetApiKey) {
          targetApiKey = request.headers.get("x-gemini-api-key");
        }

        // Prioridade 3: chave do usuário no KV (opcional)
        if (!targetApiKey && userEmail && env.USER_KEYS_KV) {
          targetApiKey = await env.USER_KEYS_KV.get(`user_key:${userEmail}`);
        }

        // A) Chama Google Gemini REST API usando a API Key resolvida
        if (targetApiKey) {
          const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${targetApiKey}`;
          
          const geminiResponse = await fetch(geminiApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.9,
                topP: 0.95,
              },
            }),
          });

          if (!geminiResponse.ok) {
            const errData = await geminiResponse.text();
            return new Response(JSON.stringify({ success: false, error: `Google AI Error: ${errData}` }), {
              status: geminiResponse.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const data: any = await geminiResponse.json();
          const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

          return new Response(JSON.stringify({ success: true, text: generatedText }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Nenhuma credencial MASTER_GEMINI_KEY configurada no Cloudflare Worker." 
          }), 
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );

      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message || "Erro interno no Worker" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Unmatched Route
    return new Response(JSON.stringify({ error: "Rota não encontrada no Worker" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
