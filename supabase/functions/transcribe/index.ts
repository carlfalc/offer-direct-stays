// findastay — transcribe edge function
// Records come from the browser as base64 audio; we send them to OpenAI Whisper
// and return the text. Reliable + consistent across devices (unlike the Web Speech API).
// Deploy as "transcribe". Uses the existing OPENAI_API_KEY secret.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return json({ error: "Missing OPENAI_API_KEY" }, 500);

    const { audio, mime } = await req.json();
    if (!audio) return json({ error: "No audio provided" }, 400);

    // base64 -> bytes
    const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
    const type = mime || "audio/webm";
    const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";

    const form = new FormData();
    form.append("file", new Blob([bytes], { type }), `audio.${ext}`);
    form.append("model", "whisper-1");
    form.append("language", "en");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("Whisper error:", r.status, detail);
      return json({ error: "Transcription failed", detail }, 502);
    }

    const data = await r.json();
    return json({ text: (data.text || "").trim() });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Unexpected error", detail: String(err) }, 500);
  }
});
