import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── TYPES ────────────────────────────────────────────────────────

type AssetTier = "background" | "portrait" | "unit" | "icon" | "tile" | "node";

// ─── BRAND CORE (self-contained for edge deployment) ──────────────

const BRAND_IDENTITY =
  "Grimdark low-fantasy, morally-gray, gritty, weathered, lived-in. Inspired by Stoneshard, Darkest Dungeon, Kingdom Death. Late medieval / early renaissance. Never clean, never heroic, never sci-fi.";

const LIGHTING = {
  key: "warm torchlight / candlelight, directional from upper-left, golden-amber temperature",
  rim: "cold cyan-blue rim light along ONE consistent edge (right side preferred), brighter than mid-values, saturated but NOT neon. Must serve as readable outline at small sizes.",
  fill: "minimal cool ambient fill from opposite side, just enough to prevent total black crush",
  shadows: "hue-shifted shadows: purple/blue undertones in dark areas, never pure black or pure grey",
  rule: "Warm key + cold rim is the SIGNATURE look. Rim MUST be consistent along ONE side — no patchy outline.",
};

const COLOR_DIR = {
  temperature: "Overall muted/desaturated. Warm accents are EARNED — only on key focal points.",
  accents: "Reds and golds are accent colors, used sparingly for emphasis. Never uniform warm wash.",
  shadows: "Shadows shift toward purple/blue/violet. Never pure black. Never pure grey.",
  highlights: "Highlights shift toward warm gold/amber on light-facing edges. Never pure white.",
  saturation: "Low overall saturation with strategic pops.",
};

const MATERIALS: Record<string, string> = {
  metals: "oiled steel, tarnished iron, cold-forged, pitted and worn — never chrome",
  leather: "cracked, oil-darkened, sweat-stained, visible grain and stitching",
  fabric: "coarse linen, wool, heavy canvas, frayed edges — never silk",
  skin: "weathered, scarred, age-lined — never smooth or porcelain",
  wood: "dark oak, weathered pine, worm-eaten, visible grain",
  stone: "rough-hewn, lichen-spotted, mortar-cracked",
};

const UNIVERSAL_NEGATIVES = [
  "no anime", "no cartoon", "no chibi", "no cel-shading",
  "no modern clothing", "no sci-fi elements", "no neon lighting",
  "no text overlays", "no watermarks", "no lens flare",
  "no chromatic aberration", "no AI artifacts (extra fingers, merged limbs, floating objects)",
];

// ─── TIER-AWARE PROMPT BUILDER ────────────────────────────────────

function buildTierPrompt(
  tier: AssetTier,
  subject: string,
  width: number,
  height: number,
  paletteDescription: string,
  modifierText: string,
  referenceNote: string,
): string {
  switch (tier) {
    case "background":
      return buildBackgroundPrompt(subject, width, height, modifierText, referenceNote);
    case "portrait":
      return buildPortraitPrompt(subject, width, height, paletteDescription, modifierText, referenceNote);
    case "unit":
      return buildUnitPrompt(subject, width, height, paletteDescription, modifierText, referenceNote);
    case "icon":
    case "tile":
    case "node":
      return buildIconPrompt(tier, subject, width, height, paletteDescription, modifierText, referenceNote);
    default:
      return buildPortraitPrompt(subject, width, height, paletteDescription, modifierText, referenceNote);
  }
}

function buildBackgroundPrompt(subject: string, w: number, h: number, mods: string, refNote: string): string {
  return `Generate a single high-quality game background image.

═══ BRAND ═══
${BRAND_IDENTITY}

═══ SUBJECT ═══
${subject}
Target: ${w}×${h} (landscape, cinematic)

═══ COMPOSITION ═══
Wide establishing shot, 24-35mm, rule-of-thirds framing.
Empty negative space for UI overlay, readable silhouettes.
3 clear depth planes: foreground detail, midground subject, background atmosphere.
Volumetric haze/smoke, atmospheric depth.

═══ LIGHTING ═══
Key: ${LIGHTING.key}
Fill: ${LIGHTING.fill}
Shadows: ${LIGHTING.shadows}
Volumetric light rays where appropriate.

═══ COLOR ═══
${COLOR_DIR.temperature} ${COLOR_DIR.shadows} ${COLOR_DIR.highlights}

═══ MATERIALS ═══
${MATERIALS.wood}; ${MATERIALS.stone}

${mods ? `═══ STYLE ═══\n${mods}` : ""}
${refNote}

═══ NEGATIVE ═══
${UNIVERSAL_NEGATIVES.join(", ")}, no characters present, no readable text/signage, no fisheye, no extreme Dutch angle

═══ NOTES ═══
- Render at 1920×1080 for clean downscale to ${w}×${h}
- This is a PHOTOREALISTIC background — no pixel art processing
- Cinematic realism, NOT stylized pixel art
- Must read as atmospheric environment at final size`;
}

function buildPortraitPrompt(subject: string, w: number, h: number, palette: string, mods: string, refNote: string): string {
  return `Generate a single high-quality game portrait asset.

═══ BRAND ═══
${BRAND_IDENTITY}

═══ SUBJECT ═══
${subject}
Asset: portrait | ${w}×${h} | Render at 512×512 for cascaded downscale

═══ COMPOSITION ═══
Chest-up or waist-up, centered, slight low angle for authority.
Direct eye contact, shoulders squared. Subject fills 70-80% of frame.
35mm equivalent, shallow DOF.

═══ LIGHTING (SIGNATURE) ═══
Key: ${LIGHTING.key}
Rim: ${LIGHTING.rim}
Fill: ${LIGHTING.fill}
Shadows: ${LIGHTING.shadows}
RULE: ${LIGHTING.rule}

═══ VALUE STRUCTURE ═══
CRITICAL — minimum 4 distinct tonal bands: deep shadow, mid-shadow, mid-light, highlight.
Each major form (head, torso, arms) needs its own tonal identity.
Torso must NOT collapse into single dark mass.
Force value breaks: brighter lapel edge, lighter shirt, highlight on collar/shoulder seam.

═══ SPRITE READABILITY ═══
HIGH CONTRAST VALUE GROUPING. Simplified midtones — group similar values.
Clean shape massing over micro-texture. NO dithering noise.
Rim light bright enough to serve as outline. Consistent along ONE side only.
Minimal micro-texture at this size.

═══ COLOR ═══
${COLOR_DIR.temperature} ${COLOR_DIR.accents} ${COLOR_DIR.shadows} ${COLOR_DIR.highlights} ${COLOR_DIR.saturation}
${palette ? `Palette guidance: ${palette}` : ""}

═══ MATERIALS ═══
${MATERIALS.metals}; ${MATERIALS.leather}; ${MATERIALS.fabric}; ${MATERIALS.skin}

${mods ? `═══ STYLE ═══\n${mods}` : ""}
${refNote}

═══ NEGATIVE ═══
${UNIVERSAL_NEGATIVES.join(", ")}, no extra limbs, no deformed hands, no blurred face, no background scenery, no heroic pose, no clean/pristine clothing, no sparkly effects, no noisy micro-texture, no sparkly dithering, no compressed midtones, no sharpening artifacts

═══ NOTES ═══
- Render at high resolution for cascaded downscale to ${w}×${h}
- Every major form must have own tonal identity — no value collapsing
- Rim light consistent along ONE edge — no patchy outline
- Prioritize shape clarity and value separation over surface detail
- Production game asset — must read instantly in-game`;
}

function buildUnitPrompt(subject: string, w: number, h: number, palette: string, mods: string, refNote: string): string {
  const frameH = h; // each frame is hxh
  const frameCount = Math.round(w / h) || 10;
  const paletteSnippet = palette ? palette.split(",").slice(0, 12).join(", ") : "";

  return `Generate a pixel art sprite sheet.

═══ BRAND ═══
${BRAND_IDENTITY}

═══ SUBJECT ═══
${subject}
${frameCount} frames horizontal strip, each frame ${frameH}×${frameH} pixels.
Total image: ${w}×${h}. Transparent background (checkerboard).

═══ PIXEL ART RULES ═══
Hard pixel edges, NO anti-aliasing, NO gradients, NO blur, NO dithering.
1px dark outline (#0C0C14) around character. Crisp silhouette readable at small size.
8-bit aesthetic with clean shapes.
${paletteSnippet ? `Restricted palette: ${paletteSnippet}` : ""}

═══ FRAME LAYOUT ═══
4 idle frames (subtle bob/breathing), 3 attack frames (wind-up, strike, recover), 3 death frames (stagger, fall, prone).
Isometric-adjacent top-down-slight viewing angle.
Consistent character proportions across ALL frames.

═══ LIGHTING ═══
Consistent top-left directional light across all frames.
${LIGHTING.key}

═══ MATERIALS ═══
${MATERIALS.metals}; ${MATERIALS.leather}; ${MATERIALS.fabric}

${mods ? `═══ STYLE ═══\n${mods}` : ""}
${refNote}

═══ NEGATIVE ═══
${UNIVERSAL_NEGATIVES.join(", ")}, no gradients, no blur, no anti-aliasing, no photorealism, no 3D rendering

═══ NOTES ═══
- This IS pixel art — hard edges, restricted colors, no smoothing
- Each frame must be clearly separated with consistent spacing
- Character must be recognizable at ${frameH}×${frameH} pixels`;
}

function buildIconPrompt(tier: string, subject: string, w: number, h: number, palette: string, mods: string, refNote: string): string {
  return `Generate a pixel art ${tier}.

═══ BRAND ═══
${BRAND_IDENTITY}

═══ SUBJECT ═══
${subject}
${w}×${h} pixels. Transparent background.

═══ PIXEL ART RULES ═══
Hard pixel edges, NO anti-aliasing. 1px outline (#0C0C14). High contrast.
Centered, fills frame to edges, bold graphic shape.
Silhouette must read at ${Math.min(w, h)}×${Math.min(w, h)}.
Flat/orthographic, no perspective distortion. Minimal negative space.
${palette ? `Restricted palette: ${palette}` : ""}

═══ LIGHTING ═══
Consistent top-left. Simple 2-3 value shading.

${mods ? `═══ STYLE ═══\n${mods}` : ""}
${refNote}

═══ NEGATIVE ═══
${UNIVERSAL_NEGATIVES.join(", ")}, no 3D perspective, no characters, no text, no complex background, no gradients, no blur

═══ NOTES ═══
- Pure pixel art at exact target size
- Must read instantly as "${subject}" at ${w}×${h}`;
}

// ─── TIER INFERENCE ───────────────────────────────────────────────

function inferTier(assetType: string, w: number, h: number, explicitTier?: string): AssetTier {
  if (explicitTier && ["background", "portrait", "unit", "icon", "tile", "node"].includes(explicitTier)) {
    return explicitTier as AssetTier;
  }
  if (assetType === "environment" && w >= 480) return "background";
  if (assetType === "character" && h >= 48 && w <= 64) return "portrait";
  if (assetType === "character" && w > 64) return "unit";
  if (assetType === "icon") return "icon";
  if (assetType === "tileset") return "tile";
  if (assetType === "ui") return "node";
  if (assetType === "character") return "portrait";
  return "portrait";
}

// ─── SERVE ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      prompt, assetType, width, height,
      paletteDescription, styleModifiers, skipQuantize,
      referenceImage, tier: explicitTier,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const tier = inferTier(assetType, width, height, explicitTier);
    const modifierText = (styleModifiers || []).join(", ");
    const referenceNote = referenceImage
      ? "\nIMPORTANT: Use the attached reference image as a STYLE GUIDE. Match its color palette, lighting, level of detail, and overall aesthetic."
      : "";

    const imagePrompt = buildTierPrompt(
      tier, prompt, width, height,
      paletteDescription || "", modifierText, referenceNote,
    );

    console.log(`[${tier}] ${width}×${height} prompt (300ch):`, imagePrompt.substring(0, 300));

    // Build message content
    const messageContent: unknown = referenceImage
      ? [
          { type: "text", text: imagePrompt },
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
        messages: [{ role: "user", content: messageContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Wait and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits depleted. Add funds to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${status}`);
    }

    const data = await response.json();
    const msg = data.choices?.[0]?.message;
    const content = msg?.content;
    let imageBase64 = "";

    // Extract image from various response formats
    if (Array.isArray(msg?.images)) {
      for (const img of msg.images) {
        if (img.type === "image_url" && img.image_url?.url) {
          imageBase64 = img.image_url.url;
          break;
        }
      }
    }
    if (!imageBase64 && typeof content === "string") {
      if (content.startsWith("data:image")) imageBase64 = content;
      else if (content.length > 100 && !content.includes(" ")) imageBase64 = `data:image/png;base64,${content}`;
    }
    if (!imageBase64 && Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url") { imageBase64 = part.image_url?.url || ""; break; }
        if (part.type === "image" && part.source?.data) { imageBase64 = `data:image/${part.source.media_type || "png"};base64,${part.source.data}`; break; }
      }
    }
    if (!imageBase64 && Array.isArray(msg?.parts)) {
      for (const part of msg.parts) {
        if (part.inline_data) { imageBase64 = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`; break; }
      }
    }

    if (!imageBase64) {
      console.error("No image in response:", JSON.stringify(data).substring(0, 500));
      return new Response(JSON.stringify({ error: "AI did not return an image. Try again." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      image: imageBase64,
      tier,
      skipQuantize: tier === "background" ? true : (skipQuantize ?? false),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image-asset error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
