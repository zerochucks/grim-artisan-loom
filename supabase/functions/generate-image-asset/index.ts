import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── BRAND GUIDELINES (server-side mirror) ────────────────────────
// These are the production art-direction rules, kept in sync with
// src/lib/brand-guidelines.ts but self-contained for edge deployment.

const BRAND = {
  identity: "Grimdark low-fantasy, morally-gray, gritty, weathered, lived-in. Inspired by Stoneshard, Darkest Dungeon, Kingdom Death. Late medieval / early renaissance. Never clean, never heroic, never sci-fi.",
  
  lighting: {
    key: "warm torchlight / candlelight, directional from upper-left, golden-amber temperature",
    rim: "cold cyan-blue rim light along ONE consistent edge (right side preferred), brighter than mid-values, saturated but NOT neon. Must serve as readable outline at small sizes.",
    fill: "minimal cool ambient fill from opposite side, just enough to prevent total black crush",
    shadows: "hue-shifted shadows: purple/blue undertones in dark areas, never pure black or pure grey",
    rule: "Warm key + cold rim is the SIGNATURE look. Rim MUST be consistent along ONE side — no patchy outline.",
  },

  values: {
    sprite: "CRITICAL — minimum 4 clearly distinct tonal bands: deep shadow, mid-shadow, mid-light, highlight. Each major form (head, torso, arms) needs its own tonal identity. Torso must NOT collapse into a single dark mass. Force value breaks: brighter lapel edge, lighter shirt under coat, subtle highlight on collar/shoulder seam.",
    large: "6+ tonal bands with smooth transitions. Still maintain clear silhouette separation between major forms.",
  },

  color: {
    temperature: "Overall muted/desaturated. Warm accents are EARNED — only on key focal points (wounds, fire, gold details).",
    accents: "Reds and golds are accent colors, used sparingly for emphasis. Never uniform warm wash.",
    shadows: "Shadows shift toward purple/blue/violet. Never pure black. Never pure grey.",
    highlights: "Highlights shift toward warm gold/amber on light-facing edges. Never pure white.",
    saturation: "Low overall saturation with strategic pops. Most saturated element = deliberate focal point.",
  },

  materials: {
    metals: "oiled steel, tarnished iron, cold-forged, pitted and worn — never chrome or polished mirror",
    leather: "cracked, oil-darkened, sweat-stained, visible grain and stitching",
    fabric: "coarse linen, wool, heavy canvas, frayed edges — never silk or synthetic",
    skin: "weathered, scarred, age-lined — never smooth or porcelain",
    wood: "dark oak, weathered pine, worm-eaten, visible grain and age marks",
    stone: "rough-hewn, lichen-spotted, mortar-cracked, with chips and wear",
    paper: "yellowed parchment, wax-sealed, ink-faded, foxing and water stains",
    glass: "thick, bubbled, slightly greenish tint — medieval blown glass",
  },
};

// Sprite readability safeguards by max dimension
function getSpriteSafeguards(w: number, h: number): string {
  const size = Math.max(w, h);
  if (size <= 32) {
    return "EXTREME SIMPLIFICATION: 2-3 colors per form maximum. Bold outline. No interior detail that won't survive downscale. Silhouette must read as a single recognizable blob. Flat color fills with minimal shading.";
  }
  if (size <= 64) {
    return "HIGH CONTRAST VALUE GROUPING: minimum 4 tonal bands. Simplified midtones — group similar values, avoid gradual gradients. Clean shape massing over micro-texture. NO dithering noise. Rim light bright enough to serve as outline. FORCE value breaks on torso (brighter lapel/collar/shirt edge). Minimal micro-texture. Consistent rim light along ONE side only.";
  }
  if (size <= 128) {
    return "Moderate detail allowed but forms must still read as clear shapes. Value separation between major body parts. Some texture acceptable but subordinate to form.";
  }
  return "Full detail allowed. Maintain readable silhouette and strong value structure.";
}

// Composition rules per asset type
const COMPOSITION: Record<string, string> = {
  character: "Chest-up or waist-up, centered subject, slight low angle for authority. Direct eye contact, shoulders squared, grounded weight. Tight crop — subject fills 70-80% of frame. 35mm equivalent, shallow DOF.",
  equipment: "Product-shot style, single item, slight 3/4 angle. Material detail visible, wear marks tell a story. Macro lens, sharp focus. Clean dark background, item isolated.",
  icon: "Centered, fills frame to edges, bold graphic shape. Silhouette must read at 16x16. Flat/orthographic, no perspective distortion. Minimal negative space.",
  item: "3/4 top-down angle, items clearly separated with breathing room. Deliberate still-life arrangement on contextual surface. 85mm macro, entire arrangement in focus.",
  environment: "Wide establishing shot, rule-of-thirds, horizon in lower/upper third. 3 clear depth planes. Intentional negative space for UI. 24-35mm wide, deep DOF. Volumetric haze/smoke.",
  tileset: "Top-down or front-facing, perfectly flat. Even lighting. Consistent texture density. Clean edges for seamless tiling.",
  ui: "Flat front-facing, symmetric. Ornate iron/stone detail. Clean interior space. Dark background.",
  effect: "Isolated on dark/transparent background. Dynamic motion implied. High contrast glow. Clean shape at small sizes.",
};

// Negative constraint banks
function buildNegatives(assetType: string, w: number, h: number): string {
  const universal = [
    "no anime", "no cartoon", "no chibi", "no cel-shading",
    "no modern clothing", "no sci-fi elements", "no neon lighting",
    "no text overlays", "no watermarks", "no lens flare",
    "no chromatic aberration", "no AI artifacts (extra fingers, merged limbs, floating objects)",
  ];

  const typeNeg: Record<string, string[]> = {
    character: ["no extra limbs", "no deformed hands", "no blurred face", "no background scenery", "no heroic pose", "no clean/pristine clothing", "no sparkly effects"],
    equipment: ["no characters", "no hands holding items", "no readable text", "no modern materials", "no clutter pile"],
    icon: ["no 3D perspective", "no characters", "no text", "no complex background"],
    item: ["no characters", "no hands holding items", "no readable text", "no modern materials", "no clutter pile"],
    environment: ["no characters present", "no readable text/signage", "no fisheye distortion", "no extreme Dutch angle"],
    tileset: ["no perspective distortion", "no characters", "no text"],
    ui: ["no characters", "no readable text", "no modern design", "no 3D perspective"],
    effect: ["no characters", "no text", "no background scenery"],
  };

  const spriteNeg = Math.max(w, h) <= 128
    ? ["no noisy micro-texture", "no sparkly dithering", "no compressed midtones", "no sharpening artifacts"]
    : [];

  return [...universal, ...(typeNeg[assetType] || []), ...spriteNeg].join(", ");
}

// Material cues per asset type
function getMaterialCues(assetType: string): string {
  const relevant: Record<string, (keyof typeof BRAND.materials)[]> = {
    character: ["metals", "leather", "fabric", "skin"],
    equipment: ["metals", "leather", "wood"],
    item: ["metals", "leather", "glass", "paper"],
    environment: ["wood", "stone"],
    tileset: ["stone", "wood"],
    ui: ["metals", "stone", "wood"],
    icon: [],
    effect: [],
  };
  const keys = relevant[assetType] || ["metals", "leather"];
  return keys.map((k) => `${k}: ${BRAND.materials[k]}`).join("; ");
}

function buildPrompt(
  prompt: string,
  assetType: string,
  width: number,
  height: number,
  paletteDescription: string,
  modifierText: string
): string {
  const isPortrait = height > width;
  const isSquare = height === width;
  const aspectHint = isSquare ? "1:1 square" : isPortrait ? "portrait aspect" : "landscape aspect";

  const isSmallSprite = Math.max(width, height) <= 64;
  const valueRules = isSmallSprite ? BRAND.values.sprite : BRAND.values.large;
  const safeguards = getSpriteSafeguards(width, height);
  const composition = COMPOSITION[assetType] || COMPOSITION.character;
  const materials = getMaterialCues(assetType);
  const negatives = buildNegatives(assetType, width, height);

  return `Generate a single high-quality game art asset image.

═══ BRAND ART DIRECTION ═══
${BRAND.identity}

═══ SUBJECT ═══
${prompt}
Asset type: ${assetType} | ${aspectHint} | Target resolution: ${width}×${height}

═══ COMPOSITION ═══
${composition}

═══ LIGHTING (SIGNATURE LOOK) ═══
Key light: ${BRAND.lighting.key}
Rim light: ${BRAND.lighting.rim}
Fill: ${BRAND.lighting.fill}
Shadows: ${BRAND.lighting.shadows}
RULE: ${BRAND.lighting.rule}

═══ VALUE STRUCTURE ═══
${valueRules}

═══ SPRITE READABILITY ═══
${safeguards}

═══ COLOR DIRECTION ═══
Temperature: ${BRAND.color.temperature}
Accents: ${BRAND.color.accents}
Shadows: ${BRAND.color.shadows}
Highlights: ${BRAND.color.highlights}
Saturation: ${BRAND.color.saturation}
${paletteDescription ? `Palette guidance: ${paletteDescription}` : ""}

═══ MATERIAL LANGUAGE ═══
${materials}

${modifierText ? `═══ STYLE MODIFIERS ═══\n${modifierText}` : ""}

═══ NEGATIVE CONSTRAINTS (DO NOT INCLUDE) ═══
${negatives}

═══ PRODUCTION NOTES ═══
- Render at high resolution, designed for clean downscaling to ${width}×${height}
- Every major form must have its own tonal identity — no value collapsing
- Rim light must be consistent along ONE edge — no patchy outline
- Prioritize shape clarity and value separation over surface detail
- This is for a shipping game asset — it must read instantly in-game at target size`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, assetType, width, height, paletteDescription, styleModifiers, skipQuantize, referenceImage } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const modifierText = (styleModifiers || []).join(", ");
    const imagePrompt = buildPrompt(prompt, assetType, width, height, paletteDescription || "", modifierText);

    console.log("Render prompt (first 300 chars):", imagePrompt.substring(0, 300));

    // Build message content — text-only or multimodal with reference image
    const messageContent: any = referenceImage
      ? [
          { type: "text", text: imagePrompt + "\n\nIMPORTANT: Use the attached reference image as a STYLE GUIDE. Match its color palette, lighting style, level of detail, and overall aesthetic. The new image should look like it belongs in the same game/set as the reference." },
          { type: "image_url", image_url: { url: referenceImage } },
        ]
      : imagePrompt;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: messageContent },
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
