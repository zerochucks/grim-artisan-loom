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

    const imagePrompt = `Pixel art game sprite of: ${prompt}

Style: Dark fantasy grimdark pixel art, inspired by Stoneshard and Darkest Dungeon.
Asset type: ${assetType}
Target resolution: ${width}x${height} pixels
${paletteDescription ? `Color palette: ${paletteDescription}` : ""}
${modifierText ? `Style modifiers: ${modifierText}` : ""}

Requirements:
- Clean pixel art with no anti-aliasing
- Centered on transparent/dark background
- Strong silhouette and readable at small sizes
- Gritty, textured, atmospheric
- Muted earth tones with sparse warm accents
- Hue-shifted shadows (purple/blue shadows, warm gold highlights)
- Game-ready asset, single subject, no text or UI`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          { role: "user", content: imagePrompt },
        ],
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
    
    // Extract image from response - Gemini image models return base64 inline
    const content = data.choices?.[0]?.message?.content;
    let imageBase64 = "";

    if (typeof content === "string") {
      // If content is a base64 string directly
      if (content.startsWith("data:image")) {
        imageBase64 = content;
      } else if (content.length > 100 && !content.includes(" ")) {
        // Likely raw base64
        imageBase64 = `data:image/png;base64,${content}`;
      }
    } else if (Array.isArray(content)) {
      // Multi-part content with image
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

    // Also check for inline_data in parts (Gemini format)
    const parts = data.choices?.[0]?.message?.parts;
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
