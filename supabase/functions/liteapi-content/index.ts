// findastay — liteapi-content edge function
// Content/static-data layer ONLY (hotel names, photos, room types, coordinates).
// NOT a booking engine and NOT a pricing source — findastay's offer model is the price.
// Deploy to Supabase Edge Functions as "liteapi-content".
// Set a secret in Supabase: LITEAPI_KEY = sand_... (sandbox) or prod_... (live)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE = "https://api.liteapi.travel/v3.0";

type ContentRequest = {
  // searchHotels = list hotels by city/country/geo; hotelDetails = full content for one hotel
  action?: "searchHotels" | "hotelDetails";
  // For searchHotels: any LiteAPI /data/hotels query params, passed straight through.
  // e.g. { countryCode: "NZ", cityName: "Whanganui", limit: 20 }
  //  or  { countryCode: "NZ", latitude: -39.9312, longitude: 175.0486, radius: 5000 }
  params?: Record<string, string | number | boolean | null | undefined>;
  // For hotelDetails:
  hotelId?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LITEAPI_KEY");
    if (!apiKey) return json({ error: "Missing LITEAPI_KEY secret" }, 500);

    const body = (await req.json().catch(() => ({}))) as ContentRequest;
    const action = body.action || "searchHotels";

    let url: string;

    if (action === "hotelDetails") {
      if (!body.hotelId) return json({ error: "Missing hotelId" }, 400);
      url = `${BASE}/data/hotel?hotelId=${encodeURIComponent(body.hotelId)}`;
    } else {
      // searchHotels — pass every supplied param straight through to /data/hotels
      const qs = new URLSearchParams();
      const params = body.params || {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== "") {
          qs.append(key, String(value));
        }
      }
      // Sensible default so an empty call still returns something to look at
      if (!qs.has("limit")) qs.append("limit", "20");
      url = `${BASE}/data/hotels?${qs.toString()}`;
    }

    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        accept: "application/json",
      },
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error("LiteAPI error:", upstream.status, text);
      return json({ error: "LiteAPI error", status: upstream.status, detail: text }, 502);
    }

    // LiteAPI wraps results in { data: [...] } — return as-is so the frontend can read .data
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return json(data, 200);
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Unexpected error", detail: String(err) }, 500);
  }
});
