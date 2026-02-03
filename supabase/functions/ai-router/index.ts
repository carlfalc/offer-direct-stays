import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AiRequest = {
  type?: "concierge" | "offer" | "onboarding" | "extract" | "intent";
  message: string;
  context?: Record<string, unknown>;
};

const SYSTEM_PROMPTS: Record<string, string> = {
  concierge: `You are FindAStay's premium concierge. Be warm, concise, and confident. Ask one question at a time. Always summarize before searching. You can mention weather and events when location is known. Remind: the map is interactive and can be moved anytime. Never promise availability or pricing.`,
  offer: `You draft polite, concise offer messages. Include dates, guests, nightly offer, total offer. Use suggested average offer if provided and clamp within budget if given. End with: "Let me know if this works for you."`,
  onboarding: `You guide a property owner through onboarding. Collect: business name, property type, address, contact, NZBN/ABN, payout preference. Confirm summary and ask for approval. One question per turn.`,
  extract: `Extract structured info from chat: destination, check_in, check_out, adults, children, budget_min, budget_max, must_haves, trip_reason, flexibility, ev_charging_required. Return JSON only.`,
  intent: `Classify user intent into one of: search_start, refine_search, make_offer, onboarding, support, other. Return JSON only.`,
};

const getPrompt = (type: string) => SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.concierge;

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

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = "google/gemini-3-flash-preview";
    const system = getPrompt(type);
    const contextNote = Object.keys(context).length > 0 ? `Context (for reference): ${JSON.stringify(context)}` : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        messages: [
          { role: "system", content: system },
          ...(contextNote ? [{ role: "system", content: contextNote }] : []),
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error", detail: text }), {
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
