import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import UPNG from "https://esm.sh/upng-js@2.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── TYPES ────────────────────────────────────────────────────────

type AssetTier = "background" | "portrait" | "unit" | "icon" | "tile" | "node" | "ui" | "vfx" | "font" | "logo";

// ─── PIPELINE DETECTION ──────────────────────────────────────────
// Pipeline A = non-pixel (ink-and-gold illustration): background, portrait, logo
// Pipeline B = pixel art: unit, icon, tile, node, ui, vfx, font

const PIXEL_TIERS: AssetTier[] = ["unit", "icon", "tile", "node", "ui", "vfx", "font"];
const INK_TIERS: AssetTier[] = ["background", "portrait", "logo"];

function isPixelTier(tier: AssetTier): boolean {
  return PIXEL_TIERS.includes(tier);
}

// ─── SHARED BRAND IDENTITY ──────────────────────────────────────

const BRAND_IDENTITY =
  "Grimdark low-fantasy, morally-gray, gritty, weathered, lived-in. Inspired by Stoneshard, Darkest Dungeon, Kingdom Death. Late medieval / early renaissance. Never clean, never heroic, never sci-fi.";

// ─── PIPELINE A: INK-AND-GOLD HEADER ────────────────────────────

const INK_HEADER = `Style: dark fantasy ink-and-gold illustration, dramatic rim lighting, heavy ink linework.
Muted palette dominated by charcoal, obsidian-black, ash-grey with controlled warm accents (amber, gold).
Painterly rendering with visible brushwork — NOT pixel art, NOT vector, NOT flat digital.
Cinematic photorealism for backgrounds; stylized realism for portraits.`;

// ─── PIPELINE B: PIXEL ART HEADER (identical on every pixel asset) ─

const PIXEL_HEADER = `Style: grimdark low-fantasy pixel art, high-contrast readability at 1x scale.
Hard pixel edges ONLY — no anti-aliasing, no blur, no soft shading, no painterly texture.
No photorealism, no dithering noise that harms readability.
1px outline in near-black (#0C0C14) unless otherwise specified.
Zero alpha bleed on transparent assets (clean cutout, no semi-transparent fringe pixels).
Palette: muted materials (iron/steel/leather/bone/parchment) + controlled accent glow only from primary_color when provided.
Lighting: simple top-left key + one shadow value. Avoid complex volumetric lighting in pixel assets.`;

// ─── MATERIAL DICTIONARY (consistent world feel) ────────────────

const MATERIAL_DICT = `Material Dictionary (use ONLY these unless asset explicitly overrides):
- Metals: gunmetal, tarnished iron, dull steel highlights — NO chrome, NO polished silver
- Leather: cracked, oil-darkened, sweat-stained, visible grain and stitching
- Fabric: coarse linen, wool, heavy canvas, frayed edges — NEVER silk
- Parchment: warm aged paper, tea-stained, subtle grain (pixel-safe flat shading)
- Bone/Ivory: yellowed, micro-chipped, dry — NOT white
- Wood: dark oak, weathered pine, worm-eaten, visible grain
- Stone: rough-hewn, lichen-spotted, mortar-cracked
- Void energy: electric violet (#7C4DFF) accents, controlled glow — avoid neon gradients
- Jade/Ledger: #32C882 accents, limited bloom
- Shadows: deep indigo / near-black — NOT pure black everywhere`;

// ─── LIGHTING RULES ─────────────────────────────────────────────

const LIGHTING = {
  key: "warm torchlight / candlelight, directional from upper-left, golden-amber temperature",
  rim: "cold cyan-blue rim light along ONE consistent edge (right side preferred), brighter than mid-values, saturated but NOT neon",
  fill: "minimal cool ambient fill from opposite side, just enough to prevent total black crush",
  shadows: "hue-shifted shadows: purple/blue undertones in dark areas, never pure black or pure grey",
  rule: "Warm key + cold rim is the SIGNATURE look. Rim MUST be consistent along ONE side — no patchy outline.",
};

// ─── UNIVERSAL NEGATIVES ────────────────────────────────────────

const NEG_BASE = "no anime, no cartoon, no chibi, no cel-shading, no modern clothing, no sci-fi elements, no neon lighting, no text overlays, no watermarks, no lens flare, no chromatic aberration, no AI artifacts (extra fingers, merged limbs, floating objects)";

// ─── HARD NO-TEXT NEGATIVE (A3) ─────────────────────────────────
const NEG_NO_TEXT = "ABSOLUTELY NO text, NO labels, NO frame numbers, NO captions, NO titles, NO subtitles, NO UI chrome, NO frame borders, NO grid lines, NO arrows, NO callouts, NO signatures anywhere in the image";

// ─── A1+A4: SERVER-SIDE NORMALIZE TO SPEC + ALPHA CLEANUP ──────
// Decode the model's PNG, nearest-neighbor resize to the exact target_w×target_h,
// threshold semi-transparent fringe pixels to alpha=0. Returns base64 data URL.
function normalizePixelPng(dataUrl: string, targetW: number, targetH: number): string {
  try {
    const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const decoded = UPNG.decode(bytes.buffer);
    const srcRgba = new Uint8Array(UPNG.toRGBA8(decoded)[0]);
    const sw = decoded.width, sh = decoded.height;
    if (sw === targetW && sh === targetH) {
      // still run alpha cleanup
      for (let i = 3; i < srcRgba.length; i += 4) {
        if (srcRgba[i] > 0 && srcRgba[i] < 128) srcRgba[i] = 0;
        else if (srcRgba[i] >= 128 && srcRgba[i] < 255) srcRgba[i] = 255;
      }
      const enc = UPNG.encode([srcRgba.buffer], sw, sh, 0);
      return `data:image/png;base64,${b64encode(new Uint8Array(enc))}`;
    }
    const out = new Uint8Array(targetW * targetH * 4);
    const xRatio = sw / targetW;
    const yRatio = sh / targetH;
    for (let y = 0; y < targetH; y++) {
      const sy = Math.min(sh - 1, Math.floor(y * yRatio));
      for (let x = 0; x < targetW; x++) {
        const sx = Math.min(sw - 1, Math.floor(x * xRatio));
        const si = (sy * sw + sx) * 4;
        const di = (y * targetW + x) * 4;
        out[di] = srcRgba[si];
        out[di + 1] = srcRgba[si + 1];
        out[di + 2] = srcRgba[si + 2];
        const a = srcRgba[si + 3];
        // Alpha-threshold (A4): kill semi-transparent fringe
        out[di + 3] = a < 128 ? 0 : (a < 255 ? 255 : 255);
      }
    }
    const png = UPNG.encode([out.buffer], targetW, targetH, 0);
    return `data:image/png;base64,${b64encode(new Uint8Array(png))}`;
  } catch (err) {
    console.error("[normalize] failed, returning original:", err);
    return dataUrl;
  }
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[]);
  }
  return btoa(s);
}

// ─── BG STRIP: tight #0C0C14 + hue-aware navy/dark-blue key ─────
// Matches batch-generate's stripBackground. Removes any flat navy fill or
// blue-tinted dark pixels (background/vignette) while preserving neutral or
// warm-toned art (robes, leather, skin) because they have b ≈ r.
function stripBgPixelDataUrl(dataUrl: string): string {
  try {
    const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const decoded = UPNG.decode(bytes.buffer);
    const rgba = new Uint8Array(UPNG.toRGBA8(decoded)[0]);
    const w = decoded.width, h = decoded.height;
    const BG_R = 0x0C, BG_G = 0x0C, BG_B = 0x14, TOL = 14;
    let stripped = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] === 0) continue;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      const dr = r - BG_R, dg = g - BG_G, db = b - BG_B;
      if (dr * dr + dg * dg + db * db <= TOL * TOL) {
        rgba[i + 3] = 0; stripped++; continue;
      }
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const blueBias = b - Math.max(r, g);
      if (lum < 90 && blueBias >= 6) {
        rgba[i + 3] = 0; stripped++;
      }
    }
    if (stripped === 0) return dataUrl;
    console.log(`[bg-strip] Removed ${stripped}/${w * h} pixels (${((stripped / (w * h)) * 100).toFixed(1)}%)`);
    const enc = UPNG.encode([rgba.buffer], w, h, 0);
    return `data:image/png;base64,${b64encode(new Uint8Array(enc))}`;
  } catch (err) {
    console.error("[bg-strip] failed, returning original:", err);
    return dataUrl;
  }
}

// ─── QA SELF-CHECK (appended to every prompt) ───────────────────

const QA_PIXEL = `Self-check before finalizing:
✓ Canvas size matches requested dimensions exactly
✓ Frame count matches requested count (if sprite sheet)
✓ Single-row horizontal strip (if sprite sheet)
✓ Background is FULLY TRANSPARENT (alpha channel, NOT a solid color, NOT navy, NOT dark blue, NOT #0C0C14)
✓ NO anti-aliasing — every pixel is a solid color
✓ NO alpha bleed — no semi-transparent pixels at edges
✓ Silhouette readable at 25% zoom
✓ 1px outline present on subject`;

const QA_INK = `Self-check before finalizing:
✓ Canvas dimensions match requested size
✓ No characters present (backgrounds only)
✓ No readable text, no UI elements
✓ Rim light consistent along one edge
✓ Value structure has 4+ distinct tonal bands
✓ Composition leaves room for game UI overlay`;

// ─── TIER-SPECIFIC DO/DON'T RULES ───────────────────────────────

const TIER_RULES: Record<string, string> = {
  icon: `ICON RULES (16-64px):
DO: 3-value shading (highlight/mid/shadow), simple internal linework, bold readable silhouette
DO: Center subject, fill frame to edges, flat/orthographic view
DON'T: micro-texture, tiny scratches, complex lighting, glow that washes edges
DON'T: perspective distortion, 3D rendering, photorealism
Background: TRANSPARENT (no solid fill)`,

  tile: `TILE RULES (top-down):
DO: clear readable pattern, consistent top-down lighting, tileable edges where applicable
DO: minimal parallax cues, flat orthographic view
DON'T: perspective lighting, cinematic rim light, portrait-style shading
DON'T: heavy shadows that break tiling
Background: TRANSPARENT`,

  ui: `UI CHROME RULES:
DO: 9-slice friendly borders, flat-ish shading, readable at small sizes
DO: consistent border weight, clean corners
DON'T: ornate filigree that shimmers at small sizes, complex gradients
DON'T: photorealistic textures, heavy drop shadows
Background: TRANSPARENT`,

  vfx: `VFX RULES:
DO: chunky shapes, limited particle count, clear timing beats per frame
DO: high contrast against dark backgrounds, readable animation arc
DON'T: smoke that becomes anti-aliased blur, spark noise, soft glow
DON'T: photorealistic fire/smoke, gradient-heavy rendering
Background: SOLID #0C0C14`,

  unit: `UNIT SPRITE SHEET RULES:
DO: consistent proportions across ALL frames, clear silhouette per frame
DO: root-pin feet to consistent pixel row across all frames (no vertical bob)
DO: readable at 1x scale, strong outline
DON'T: vary character size between frames, add extra frames, change aspect ratio
DON'T: use gradients, soft shadows, or anti-aliased edges
Background: SOLID #0C0C14`,

  font: `FONT/GLYPH RULES:
DO: consistent stroke weight, readable at target size, uniform baseline
DO: pixel-perfect alignment to grid
DON'T: anti-aliased curves, sub-pixel rendering, variable stroke weight
Background: SOLID #0C0C14`,

  node: `NODE/EMBLEM RULES:
DO: pixel art style (NOT ink illustration), bold readable shape at 48px
DO: 3-value shading, centered composition, flat orthographic
DON'T: say "ink illustration" or "flat illustration" — this IS pixel art
DON'T: painterly texture, photorealism, complex lighting
Background: TRANSPARENT`,

  background: `BACKGROUND RULES:
DO: wide cinematic panorama, low horizon, clear foreground ground plane for unit placement
DO: 3 depth planes (foreground detail, midground subject, background atmosphere)
DO: volumetric haze/smoke for atmosphere
DON'T: include any characters, readable text, UI elements, or modern objects
DON'T: use pixel art style — this is painterly/photorealistic illustration
Background: rendered scene (no transparency)`,

  portrait: `PORTRAIT RULES:
DO: chest-up or waist-up, centered, slight low angle for authority
DO: minimum 4 distinct tonal bands, each major form has own tonal identity
DO: rim light bright enough to serve as outline, consistent along ONE side
DON'T: collapse torso into single dark mass, use uniform dark wash
DON'T: add background scenery, heroic poses, clean/pristine clothing
DON'T: use pixel art style — this is painterly illustration
Background: dark atmospheric (no transparency)`,

  logo: `LOGO/KEY ART RULES:
DO: bold readable design, works at multiple scales
DO: ink-and-gold aesthetic, dramatic composition
DON'T: pixel art style, complex gradients that break at small sizes
DON'T: include game UI, character portraits, or text unless specified
Background: per asset specification`,
};

// ─── PROMPT BUILDERS ─────────────────────────────────────────────

function buildPromptForTier(
  tier: AssetTier,
  subject: string,
  width: number,
  height: number,
  paletteDescription: string,
  modifierText: string,
  referenceNote: string,
): string {
  const isPixel = isPixelTier(tier);
  const header = isPixel ? PIXEL_HEADER : INK_HEADER;
  const tierRule = TIER_RULES[tier] || "";
  const qaCheck = isPixel ? QA_PIXEL : QA_INK;

  // Tier-specific layout/composition
  let layoutBlock = "";
  if (tier === "unit") {
    const frameH = height;
    const frameCount = Math.round(width / height) || 10;
    const cellW = Math.round(width / frameCount);
    layoutBlock = `
═══ SPRITE SHEET LAYOUT (HARD REQUIREMENTS) ═══
EXACT canvas size: ${width}×${height} px
EXACT frames: ${frameCount} frames laid out LEFT-TO-RIGHT in a SINGLE HORIZONTAL ROW (1 row × ${frameCount} columns).
Do NOT use a 2-row grid. Do NOT use a 5×2 grid. Do NOT use ANY grid layout. STRIP ONLY.
EXACT cell size: ${cellW}×${frameH} px per frame, uniform spacing.
No padding between frames; each cell fully occupied by character.
Character centered in every cell at IDENTICAL scale; feet aligned to the SAME pixel baseline row in EVERY frame; 1–2px transparent padding per cell.
Do NOT add extra frames; do NOT change aspect ratio.
NO text, NO frame numbers, NO labels like "Idle1" or "Walk1" inside any cell.
Frame sequence: Idle1, Walk1, Walk2, Walk3, AttackWindup, AttackSwing, AttackRecover, HitStagger, DeathFall, DeadFlat`;
  } else if (tier === "vfx") {
    const frameCount = Math.round(width / height) || 6;
    const cellW = Math.round(width / frameCount);
    layoutBlock = `
═══ SPRITE SHEET LAYOUT (HARD REQUIREMENTS) ═══
EXACT canvas size: ${width}×${height} px
EXACT frames: ${frameCount} frames, single horizontal row, left-to-right
EXACT cell size: ${cellW}×${height} px per frame
No padding between frames
Do NOT add extra frames; do NOT change aspect ratio`;
  } else {
    layoutBlock = `
═══ DIMENSIONS ═══
Target: ${width}×${height} px`;
    if (tier === "background") {
      layoutBlock += `\nRender at 1920×1080 for clean downscale to ${width}×${height}`;
    } else if (tier === "portrait") {
      layoutBlock += `\nRender at 512×512 for cascaded downscale to ${width}×${height}`;
    }
  }

  // Build palette section
  let paletteBlock = "";
  if (paletteDescription) {
    paletteBlock = `\n═══ PALETTE ═══\n${paletteDescription}`;
  }

  // Build modifiers section
  let modBlock = "";
  if (modifierText) {
    modBlock = `\n═══ ADDITIONAL STYLE MODIFIERS ═══\n${modifierText}`;
  }

  // Tier-specific negatives
  let tierNeg = "";
  if (isPixel) {
    tierNeg = ", no gradients, no blur, no anti-aliasing, no photorealism, no 3D rendering, no ink illustration, no painterly texture, " + NEG_NO_TEXT;
  }
  if (tier === "background") {
    tierNeg = ", no characters present, no UI elements, no pixel art style, " + NEG_NO_TEXT;
  }
  if (tier === "portrait") {
    tierNeg = ", no extra limbs, no deformed hands, no blurred face, no background scenery, no pixel art style, no noisy micro-texture, " + NEG_NO_TEXT;
  }

  return `═══ BRAND ═══
${BRAND_IDENTITY}

═══ STYLE PIPELINE: ${isPixel ? "PIXEL ART" : "INK-AND-GOLD ILLUSTRATION"} ═══
${header}

═══ ${tier.toUpperCase()} TIER RULES ═══
${tierRule}
${layoutBlock}

═══ SUBJECT ═══
${subject}
${paletteBlock}

═══ MATERIALS ═══
${MATERIAL_DICT}
${modBlock}
${referenceNote}

═══ NEGATIVE ═══
${NEG_BASE}${tierNeg}

═══ QA SELF-CHECK ═══
${qaCheck}`;
}

// ─── TIER INFERENCE ───────────────────────────────────────────────

function inferTier(assetType: string, w: number, h: number, explicitTier?: string): AssetTier {
  const validTiers: AssetTier[] = ["background", "portrait", "unit", "icon", "tile", "node", "ui", "vfx", "font", "logo"];
  if (explicitTier && validTiers.includes(explicitTier as AssetTier)) {
    return explicitTier as AssetTier;
  }
  if (assetType === "environment" && w >= 480) return "background";
  if (assetType === "character" && h >= 48 && w <= 64) return "portrait";
  if (assetType === "character" && w > 64) return "unit";
  if (assetType === "icon") return "icon";
  if (assetType === "tileset") return "tile";
  if (assetType === "ui") return "node";
  if (assetType === "character") return "portrait";
  return "icon";
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
      ? "\n═══ REFERENCE ═══\nIMPORTANT: Use the attached reference image as a STYLE GUIDE. Match its color palette, lighting, level of detail, and overall aesthetic."
      : "";

    const imagePrompt = buildPromptForTier(
      tier, prompt, width, height,
      paletteDescription || "", modifierText, referenceNote,
    );

    console.log(`[${tier}] ${width}×${height} pipeline=${isPixelTier(tier) ? "PIXEL" : "INK"} prompt(300ch):`, imagePrompt.substring(0, 300));

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

    const contentType = response.headers.get("content-type") || "";
    const responseText = await response.text();

    if (!contentType.includes("application/json")) {
      console.error("AI gateway returned non-JSON:", contentType, responseText.substring(0, 200));
      return new Response(JSON.stringify({ error: "AI gateway returned non-JSON response", retryable: true }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse AI response:", responseText.substring(0, 200));
      return new Response(JSON.stringify({ error: "Invalid JSON from AI gateway", retryable: true }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageBase64 = extractImage(data);

    if (!imageBase64) {
      console.error("No image in response:", JSON.stringify(data).substring(0, 500));
      return new Response(JSON.stringify({ error: "AI did not return an image. Try again." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── A1+A4: enforce exact spec dims + alpha cleanup for pixel tiers ──
    let finalImage = imageBase64;
    if (isPixelTier(tier)) {
      finalImage = stripBgPixelDataUrl(imageBase64);
      finalImage = normalizePixelPng(finalImage, width, height);
      console.log(`[${tier}] bg-stripped + normalized to exact spec ${width}×${height}`);
    }

    return new Response(JSON.stringify({
      image: finalImage,
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

// ─── IMAGE EXTRACTION ────────────────────────────────────────────

function extractImage(data: Record<string, unknown>): string {
  const msg = (data as any).choices?.[0]?.message;
  const content = msg?.content;

  if (Array.isArray(msg?.images)) {
    for (const img of msg.images) {
      if (img.type === "image_url" && img.image_url?.url) return img.image_url.url;
    }
  }
  if (typeof content === "string") {
    if (content.startsWith("data:image")) return content;
    if (content.length > 100 && !content.includes(" ")) return `data:image/png;base64,${content}`;
  }
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === "image_url") return part.image_url?.url || "";
      if (part.type === "image" && part.source?.data) return `data:image/${part.source.media_type || "png"};base64,${part.source.data}`;
    }
  }
  if (Array.isArray(msg?.parts)) {
    for (const part of msg.parts) {
      if (part.inline_data) return `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
    }
  }
  return "";
}
