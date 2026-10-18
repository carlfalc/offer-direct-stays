// findastay — ai-router edge function (OpenAI version)
// Powers the AI concierge, offer drafting, onboarding, extraction and intent.
// Deploy to Supabase Edge Functions as "ai-router".
// Set a secret in Supabase: OPENAI_API_KEY = sk-...  (Edge Functions → Secrets)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AiRequest = {
  type?: "concierge" | "offer" | "onboarding" | "extract" | "intent";
  message: string;
  context?: Record<string, unknown>;
};

const SYSTEM_PROMPTS: Record<string, string> = {
  concierge: `You are findastay's premium concierge for accommodation across New Zealand and Australia. Be warm, concise, and confident. Ask one question at a time. Always summarize before searching. When a traveller names a region or city, ask whether they mean the central area, a specific suburb, or the wider surrounds, then help them narrow it. You can mention weather and events when the location is known. Remind travellers that the map is interactive and can be moved anytime. Never promise availability or pricing — the property answers each offer.`,
  offer: `You draft polite, concise offer messages. Include dates, guests, nightly offer, and total offer. Use the suggested average offer if provided and clamp within the budget if given. End with: "Let me know if this works for you."`,
  onboarding: `You guide a property owner through onboarding. Collect: business name, property type, address, contact, NZBN/ABN, and payout preference. Confirm a summary and ask for approval. One question per turn.`,
  extract: `Extract structured info from the chat: destination, check_in, check_out, adults, children, budget_min, budget_max, must_haves, trip_reason, flexibility, ev_charging_required. Return JSON only.`,
  intent: `Classify the user's intent into one of: search_start, refine_search, make_offer, onboarding, support, other. Return JSON only.`,
};

const getPrompt = (type: string) => SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.concierge;

// JSON-returning types get JSON mode; chat types stream back prose.
const JSON_TYPES = new Set(["extract", "intent"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as AiRequest;
    const type = body.type || "concierge";
    const message = body.message || "";
    const context = body.context || {};

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = "gpt-4o-mini";
    const system = getPrompt(type);
    const contextNote =
      Object.keys(context).length > 0 ? `Context (for reference): ${JSON.stringify(context)}` : "";

    const payload: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: system },
        ...(contextNote ? [{ role: "system", content: contextNote }] : []),
        { role: "user", content: message },
      ],
      temperature: 0.7,
    };
    if (JSON_TYPES.has(type)) {
      payload.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit or quota exceeded — please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const text = await response.text();
      console.error("OpenAI error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI provider error", detail: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
