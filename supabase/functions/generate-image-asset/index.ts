import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, assetType, width, height, paletteDescription, styleModifiers } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const modifierText = (styleModifiers || []).join(", ");

    const imagePrompt = `Create a single pixel art game sprite.

Subject: ${prompt}

Style direction:
- Dark fantasy grimdark pixel art, inspired by Stoneshard and Darkest Dungeon
- Asset type: ${assetType}
- Target pixel resolution: ${width}x${height}
${paletteDescription ? `- Color palette: ${paletteDescription}` : ""}
${modifierText ? `- Style modifiers: ${modifierText}` : ""}

Art requirements:
- Clean hand-placed pixel art with NO anti-aliasing
- Centered single subject on a dark or transparent background
- Strong readable silhouette at small sizes
- Gritty, textured, atmospheric feel
- Muted earth tones with sparse warm accents (reds, golds)
- Hue-shifted shadows (purple/blue undertones in dark areas)
- Warm gold highlights on light-facing edges
- Game-ready sprite asset

Negative constraints:
- No text, no UI elements, no watermarks
- No anime or cartoon style
- No extra limbs or deformed anatomy
- No modern objects or sci-fi elements
- No blurry or soft edges — crisp pixels only
- Single subject only, no background scenery`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: imagePrompt },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Wait and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits depleted. Add funds to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${status}`);
    }

    const data = await response.json();
    
    // Extract image from response
    const msg = data.choices?.[0]?.message;
    const content = msg?.content;
    let imageBase64 = "";

    // 1. Check message.images[] (Gemini image model format)
    if (Array.isArray(msg?.images)) {
      for (const img of msg.images) {
        if (img.type === "image_url" && img.image_url?.url) {
          imageBase64 = img.image_url.url;
          break;
        }
      }
    }

    // 2. Check content as string
    if (!imageBase64 && typeof content === "string") {
      if (content.startsWith("data:image")) {
        imageBase64 = content;
      } else if (content.length > 100 && !content.includes(" ")) {
        imageBase64 = `data:image/png;base64,${content}`;
      }
    }

    // 3. Check content as array (multi-part)
    if (!imageBase64 && Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url") {
          imageBase64 = part.image_url?.url || "";
          break;
        }
        if (part.type === "image" && part.source?.data) {
          imageBase64 = `data:image/${part.source.media_type || "png"};base64,${part.source.data}`;
          break;
        }
      }
    }

    // 4. Check message.parts[] (inline_data format)
    const parts = msg?.parts;
    if (!imageBase64 && Array.isArray(parts)) {
      for (const part of parts) {
        if (part.inline_data) {
          imageBase64 = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
          break;
        }
      }
    }

    if (!imageBase64) {
      console.error("No image in response:", JSON.stringify(data).substring(0, 500));
      return new Response(JSON.stringify({ error: "AI did not return an image. Try again or use Forge mode." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ image: imageBase64 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image-asset error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
