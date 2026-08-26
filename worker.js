/**
 * Cloudflare Worker for EMIA.EDU / EMIA Edutech
 * Handles API requests and serves static assets from Vite dist/
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Standard CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-gemini-api-key, x-google-api-key, x-ai-provider",
    };

    // Handle preflight CORS requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "ok", app: "emia-edutech", timestamp: new Date().toISOString() }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // AI Generation Proxy for Google Gemini
    if (url.pathname === "/api/generate" && request.method === "POST") {
      try {
        const body = await request.json();
        const apiKey = request.headers.get("x-gemini-api-key") || 
                       request.headers.get("x-google-api-key") || 
                       env.GEMINI_API_KEY || 
                       env.GOOGLE_API_KEY;

        if (!apiKey) {
          return new Response(JSON.stringify({ error: "Chave Gemini não configurada." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const model = body.model || "gemini-3.6-flash";
        const prompt = body.prompt || "";

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: body.temperature || 0.9,
                topP: 0.95
              }
            })
          }
        );

        const data = await geminiRes.json();
        return new Response(JSON.stringify(data), {
          status: geminiRes.status,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message || "Erro no Worker" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // Serve Static Assets (Vite React app in dist/)
    if (env.ASSETS) {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
        // SPA Fallback: serve index.html for unknown routes
        return await env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
      } catch (assetErr) {
        console.error("Asset fetch error:", assetErr);
      }
    }

    return new Response("EMIA.EDU Worker Online", {
      headers: { "Content-Type": "text/plain", ...corsHeaders }
    });
  }
};
