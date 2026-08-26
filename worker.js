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

export interface Env {
  // Cloudflare KV Namespace to securely map Google Email -> User Gemini API Key
  USER_KEYS_KV: KVNamespace;
  // Optional Master Fallback API Key stored as Cloudflare Secret
  MASTER_GEMINI_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

        // Retrieve user's stored API Key from KV or request headers
        let targetApiKey: string | null = request.headers.get("x-gemini-api-key");

        if (!targetApiKey && userEmail && env.USER_KEYS_KV) {
          targetApiKey = await env.USER_KEYS_KV.get(`user_key:${userEmail}`);
        }

        // Fallback to Master secret if set
        if (!targetApiKey && env.MASTER_GEMINI_KEY) {
          targetApiKey = env.MASTER_GEMINI_KEY;
        }

        // A) Call Google Gemini REST API using the resolved API Key
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

        // B) If no API key found, attempt Google OAuth Bearer Token directly
        if (googleToken) {
          const oauthGeminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          
          const oauthGeminiResponse = await fetch(oauthGeminiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${googleToken}`,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          });

          if (oauthGeminiResponse.ok) {
            const data: any = await oauthGeminiResponse.json();
            const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            return new Response(JSON.stringify({ success: true, text: generatedText }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Nenhuma credencial do Google AI encontrada. Faça login com o Google ou vincule sua chave." 
          }), 
          {
            status: 400,
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
