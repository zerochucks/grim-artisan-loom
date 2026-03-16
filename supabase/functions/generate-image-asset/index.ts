import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildPrompt(
  prompt: string,
  assetType: string,
  width: number,
  height: number,
  paletteDescription: string,
  modifierText: string
): string {
  // Determine aspect descriptor for framing cues
  const isPortrait = height > width;
  const isSquare = height === width;
  const aspectHint = isSquare ? "1:1 square" : isPortrait ? "portrait aspect" : "landscape aspect";

  // Sprite-size safeguards: bolted onto every asset type
  const isSmallSprite = width <= 64 || height <= 64;
  const spriteSafeguards = isSmallSprite
    ? "high contrast value grouping, readable silhouette at small size, simplified midtones, clean shape massing over micro-texture, avoid dithering noise at downscale, group values into 3-4 clear tonal bands"
    : "high detail materials, readable silhouette, strong value separation";

  const rimLightNote = isSmallSprite
    ? "slightly brighter rim light (saturated cyan-blue, not neon), ensure rim reads at small size"
    : "cold rift glow rim light";

  // Asset-type specific prompt templates with photography-style framing
  const templates: Record<string, { subject: string; framing: string; negatives: string }> = {
    character: {
      subject: `${prompt}, morally-gray low-fantasy world, gritty realism, shoulders squared, direct gaze, slight low angle`,
      framing: `cinematic torchlight warm key light with ${rimLightNote}, 35mm, shallow depth of field, clean readable composition, subject centered, ${spriteSafeguards}, high detail materials (worn leather, oiled steel, weathered fabric)`,
      negatives: "no anime, no cartoon, no chibi, no extra limbs, no deformed hands, no blurred face, no modern clothing, no sci-fi, no neon, no text, no watermark, no background scenery, no clutter, no sparkly dithering, no noisy micro-texture",
    },
    equipment: {
      subject: `${prompt}, product-photography style, single item on dark surface`,
      framing: `studio lighting with warm key and cold fill, macro lens, sharp focus on material detail, ${spriteSafeguards}, high detail textures (worn leather, oiled steel, iron, parchment), clean dark background`,
      negatives: "no characters, no hands, no readable text, no logos, no modern plastic, no clutter pile, no blur, no anime, no cartoon, no noisy dithering",
    },
    icon: {
      subject: `${prompt}, ability icon design, centered composition`,
      framing: `flat dramatic lighting, clean circular or square vignette, bold readable silhouette, high contrast, graphic clarity at small sizes, ${spriteSafeguards}`,
      negatives: "no 3D perspective, no characters, no text, no watermark, no complex background, no blur, no anime, no noisy micro-texture",
    },
    item: {
      subject: `still-life close-up: ${prompt}, placed on a wooden surface`,
      framing: `product-photography realism, torchlight + cold rift glow accents, sharp focus, props clearly separated, ${spriteSafeguards}, high detail textures (linen, leather, iron, parchment, glass)`,
      negatives: "no characters, no hands, no readable text, no logos, no modern plastic, no clutter pile, no blur, no anime, no noisy dithering",
    },
    environment: {
      subject: `${prompt}, low-fantasy interior or exterior detail`,
      framing: `cinematic wide or medium shot, warm torchlight, subtle cold rift glow, clear silhouette shapes, atmospheric depth, gritty realism, ${spriteSafeguards}`,
      negatives: "no characters, no readable text, no modern signage, no neon, no fisheye distortion, no extreme clutter, no anime, no noisy micro-texture",
    },
    tileset: {
      subject: `${prompt}, seamless tileable pattern, top-down or front-facing view`,
      framing: `flat even lighting, consistent texture density, clean edges for tiling, ${spriteSafeguards}`,
      negatives: "no perspective distortion, no characters, no text, no watermark, no 3D depth, no anime",
    },
    ui: {
      subject: `${prompt}, gothic UI frame or panel element`,
      framing: `flat front-facing view, ornate iron/stone detail, clean interior space, symmetric composition, dark background, ${spriteSafeguards}`,
      negatives: "no characters, no readable text, no modern design, no rounded corners, no blur, no anime, no 3D perspective",
    },
    effect: {
      subject: `${prompt}, VFX particle or impact effect`,
      framing: `isolated on dark/transparent background, dynamic motion trail, high contrast glow, clean readable shape at small sizes, ${spriteSafeguards}`,
      negatives: "no characters, no text, no watermark, no background scenery, no blur, no anime",
    },
  };

  const template = templates[assetType] || templates.character;

  return `Generate a single high-quality game art asset image.

Subject: ${template.subject}

Style direction:
- Dark fantasy grimdark art inspired by Stoneshard and Darkest Dungeon
- Asset type: ${assetType}
- ${aspectHint} composition, render at high resolution for downscaling to ${width}x${height}
${paletteDescription ? `- Color direction: ${paletteDescription}` : ""}
${modifierText ? `- Style modifiers: ${modifierText}` : ""}

Visual execution:
- ${template.framing}
- Muted earth tones with sparse warm accents (reds, golds)
- Hue-shifted shadows (purple/blue undertones in dark areas)
- Warm gold highlights on light-facing edges
- Gritty, textured, atmospheric feel
- Strong readable silhouette
- Value separation: ensure coat/armor, shirt/skin, and background occupy clearly distinct tonal bands
- Avoid compressing midtones into a single mass — keep at least 3 distinct value steps in the main subject

Negative constraints:
- ${template.negatives}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, assetType, width, height, paletteDescription, styleModifiers, skipQuantize } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const modifierText = (styleModifiers || []).join(", ");
    const imagePrompt = buildPrompt(prompt, assetType, width, height, paletteDescription || "", modifierText);

    console.log("Render prompt:", imagePrompt.substring(0, 200));

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
    
    const msg = data.choices?.[0]?.message;
    const content = msg?.content;
    let imageBase64 = "";

    // 1. Check message.images[]
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

    // 4. Check message.parts[]
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

    return new Response(JSON.stringify({ image: imageBase64, skipQuantize: skipQuantize ?? true }), {
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
