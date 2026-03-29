import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── DUAL-PIPELINE PROMPT SYSTEM ─────────────────────────────────
// Pipeline A (ink-and-gold): background, portrait, logo
// Pipeline B (pixel art): unit, icon, tile, node, ui, vfx, font

const PIXEL_TIERS = ["unit", "icon", "tile", "node", "ui", "vfx", "font"];

const BRAND = "Grimdark low-fantasy, morally-gray, gritty, weathered, lived-in. Inspired by Stoneshard, Darkest Dungeon, Kingdom Death. Late medieval / early renaissance. Never clean, never heroic, never sci-fi.";

const PIXEL_HEADER = `Style: grimdark low-fantasy pixel art, high-contrast readability at 1x scale.
Hard pixel edges ONLY — no anti-aliasing, no blur, no soft shading, no painterly texture.
No photorealism, no dithering noise that harms readability.
1px outline in near-black (#0C0C14) unless otherwise specified.
Zero alpha bleed on transparent assets (clean cutout, no semi-transparent fringe pixels).
Palette: muted materials (iron/steel/leather/bone/parchment) + controlled accent glow only from primary_color when provided.
Lighting: simple top-left key + one shadow value. Avoid complex volumetric lighting in pixel assets.`;

const INK_HEADER = `Style: dark fantasy ink-and-gold illustration, dramatic rim lighting, heavy ink linework.
Muted palette dominated by charcoal, obsidian-black, ash-grey with controlled warm accents (amber, gold).
Painterly rendering with visible brushwork — NOT pixel art, NOT vector, NOT flat digital.`;

const MATERIAL_DICT = `Material Dictionary (use ONLY these unless asset explicitly overrides):
- Metals: gunmetal, tarnished iron, dull steel highlights — NO chrome
- Leather: cracked, oil-darkened, sweat-stained, visible grain
- Fabric: coarse linen, wool, heavy canvas, frayed edges — NEVER silk
- Parchment: warm aged paper, tea-stained, subtle grain
- Bone/Ivory: yellowed, micro-chipped, dry — NOT white
- Wood: dark oak, weathered pine, worm-eaten
- Stone: rough-hewn, lichen-spotted, mortar-cracked
- Void energy: electric violet (#7C4DFF) accents, controlled glow
- Jade/Ledger: #32C882 accents, limited bloom
- Shadows: deep indigo / near-black — NOT pure black everywhere`;

const NEG_BASE = "no anime, no cartoon, no chibi, no cel-shading, no modern clothing, no sci-fi elements, no neon lighting, no text overlays, no watermarks, no AI artifacts";

const TIER_RULES: Record<string, string> = {
  icon: `DO: 3-value shading (highlight/mid/shadow), simple internal linework, bold readable silhouette, centered, fill frame
DON'T: micro-texture, tiny scratches, complex lighting, glow that washes edges, perspective distortion
Background: TRANSPARENT`,
  tile: `DO: clear readable pattern, consistent top-down lighting, tileable edges, flat orthographic
DON'T: perspective lighting, cinematic rim light, portrait-style shading, heavy shadows that break tiling
Background: TRANSPARENT`,
  ui: `DO: 9-slice friendly borders, flat-ish shading, readable at small sizes, clean corners
DON'T: ornate filigree that shimmers, complex gradients, photorealistic textures
Background: TRANSPARENT`,
  vfx: `DO: chunky shapes, limited particles, clear timing beats, high contrast against dark
DON'T: smoke that becomes AA blur, spark noise, soft glow, gradient-heavy rendering
Background: SOLID #0C0C14`,
  unit: `DO: consistent proportions across ALL frames, clear silhouette, root-pin feet to consistent pixel row
DON'T: vary character size between frames, add extra frames, change aspect ratio, gradients
Background: SOLID #0C0C14`,
  font: `DO: consistent stroke weight, readable at target size, pixel-perfect grid alignment
DON'T: anti-aliased curves, sub-pixel rendering, variable stroke weight
Background: SOLID #0C0C14`,
  node: `DO: pixel art style (NOT ink illustration), bold shape at 48px, 3-value shading, centered
DON'T: "ink illustration", "flat illustration", painterly texture, photorealism
Background: TRANSPARENT`,
  background: `DO: wide cinematic panorama, low horizon, clear foreground ground plane, 3 depth planes, volumetric haze
DON'T: characters, readable text, UI elements, modern objects, pixel art style`,
  portrait: `DO: chest-up/waist-up, centered, 4+ tonal bands, rim light along ONE side
DON'T: collapse torso to single dark mass, background scenery, heroic poses, pixel art style`,
  logo: `DO: bold readable design, ink-and-gold aesthetic, works at multiple scales
DON'T: pixel art style, complex gradients that break at small sizes`,
};

const QA_PIXEL = `Self-check: ✓ canvas size exact ✓ frame count exact (if sheet) ✓ single-row strip (if sheet) ✓ background rule followed ✓ NO anti-aliasing ✓ NO alpha bleed ✓ silhouette readable at 25% zoom ✓ 1px outline present`;
const QA_INK = `Self-check: ✓ canvas dimensions match ✓ no characters (backgrounds) ✓ no text/UI ✓ rim light consistent ✓ 4+ tonal bands ✓ room for game UI overlay`;

// ─── PROMPT BUILDER ──────────────────────────────────────────────

function buildPrompt(spec: Record<string, unknown>, referenceNote: string): string {
  const tier = spec.tier as string;
  const prompt = spec.prompt_template as string;
  const w = spec.target_w as number;
  const h = spec.target_h as number;
  const frameCount = spec.frame_count as number;
  const primaryColor = spec.primary_color as string | null;

  const isPixel = PIXEL_TIERS.includes(tier);
  const header = isPixel ? PIXEL_HEADER : INK_HEADER;
  const tierRule = TIER_RULES[tier] || TIER_RULES["icon"];
  const qa = isPixel ? QA_PIXEL : QA_INK;

  // Layout block
  let layoutBlock = `Target: ${w}×${h} px`;
  if (tier === "unit" || tier === "vfx") {
    const cellW = Math.round(w / frameCount);
    layoutBlock = `EXACT canvas size: ${w}×${h} px
EXACT frames: ${frameCount} frames, single horizontal row, left-to-right
EXACT cell size: ${cellW}×${h} px per frame
No padding between frames; each cell fully occupied
Do NOT add extra frames; do NOT change aspect ratio`;
    if (tier === "unit") {
      layoutBlock += `\nKeep character anchored: feet locked to consistent pixel row in EVERY frame
Frame sequence: Idle1, Walk1, Walk2, Walk3, AttackWindup, AttackSwing, AttackRecover, HitStagger, DeathFall, DeadFlat`;
    }
  } else if (tier === "background") {
    layoutBlock = `Target: ${w}×${h} px\nRender at 1920×1080 for clean downscale`;
  } else if (tier === "portrait") {
    layoutBlock = `Target: ${w}×${h} px\nRender at 512×512 for cascaded downscale`;
  }

  // Color accent
  const colorNote = primaryColor ? `Primary accent color: ${primaryColor}` : "";

  // Tier-specific negatives
  let tierNeg = "";
  if (isPixel) tierNeg = ", no gradients, no blur, no anti-aliasing, no photorealism, no ink illustration, no painterly texture";
  if (tier === "background") tierNeg = ", no characters, no readable text, no UI, no pixel art style";
  if (tier === "portrait") tierNeg = ", no extra limbs, no deformed hands, no blurred face, no background scenery, no pixel art style";

  return `═══ BRAND ═══
${BRAND}

═══ STYLE PIPELINE: ${isPixel ? "PIXEL ART" : "INK-AND-GOLD ILLUSTRATION"} ═══
${header}

═══ ${tier.toUpperCase()} TIER RULES ═══
${tierRule}

═══ LAYOUT ═══
${layoutBlock}

═══ SUBJECT ═══
${prompt}
${colorNote}

═══ MATERIALS ═══
${MATERIAL_DICT}
${referenceNote}

═══ NEGATIVE ═══
${NEG_BASE}${tierNeg}

═══ QA SELF-CHECK ═══
${qa}`;
}

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

// ─── SERVE ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("authorization");
    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader?.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized");
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { asset_key } = await req.json();

    if (!asset_key || typeof asset_key !== "string") {
      throw new Error("asset_key (string) required");
    }

    const { data: spec, error: specErr } = await supabase
      .from("sprite_assets")
      .select("*")
      .eq("asset_key", asset_key)
      .single();

    if (specErr || !spec) throw new Error(`Asset spec not found: ${asset_key}`);
    if (!spec.prompt_template) throw new Error(`No prompt_template for: ${asset_key}`);

    // Fetch up to 3 approved assets in the same tier for congruency reference
    const { data: approvedRefs } = await supabase
      .from("sprite_assets")
      .select("asset_key, storage_url, tier")
      .eq("tier", spec.tier)
      .eq("qa_status", "approved")
      .not("storage_url", "is", null)
      .limit(3);

    const referenceNote = approvedRefs && approvedRefs.length > 0
      ? `\n═══ STYLE REFERENCE ═══\nMatch the visual style, color temperature, and level of detail of these approved assets in the same tier: ${approvedRefs.map((r: any) => r.asset_key).join(", ")}. Maintain world-building consistency.`
      : "";

    const referenceImages = approvedRefs?.filter((r: any) => r.storage_url) || [];

    const messageContent: unknown[] = [
      { type: "text", text: buildPrompt(spec, referenceNote) },
    ];

    if (referenceImages.length > 0 && referenceImages[0].storage_url) {
      messageContent.push({
        type: "image_url",
        image_url: { url: referenceImages[0].storage_url },
      });
    }

    console.log(`[batch] Generating ${asset_key} (${spec.tier} ${spec.target_w}×${spec.target_h}) pipeline=${PIXEL_TIERS.includes(spec.tier) ? "PIXEL" : "INK"}`);

    let response: Response | null = null;
    let retryCount = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{ role: "user", content: messageContent.length === 1 ? (messageContent[0] as any).text : messageContent }],
          modalities: ["image", "text"],
        }),
      });

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Wait and retry.", retryable: true }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status >= 502 && response.status <= 504 && attempt < 2) {
        retryCount = attempt + 1;
        const waitMs = (attempt + 1) * 3000;
        console.warn(`[batch] Attempt ${attempt + 1} got ${response.status}, retrying in ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      break;
    }

    if (!response || !response.ok) {
      const status = response?.status ?? 0;
      const text = response ? await response.text() : "No response";
      console.error("AI gateway error:", status, text);
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
      return new Response(JSON.stringify({ error: "AI did not return an image", retryable: true }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    const ext = mimeType === "image/jpeg" ? "jpg" : "png";
    const filePath = `${asset_key}.${ext}`;

    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const { error: uploadErr } = await supabase.storage
      .from("pixel-assets")
      .upload(filePath, bytes, { contentType: mimeType, upsert: true });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      throw new Error("Failed to upload image to storage");
    }

    const { data: urlData } = supabase.storage.from("pixel-assets").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    const { error: updateErr } = await supabase
      .from("sprite_assets")
      .update({
        storage_url: publicUrl,
        qa_status: "generated",
        user_id: user.id,
      })
      .eq("asset_key", asset_key);

    if (updateErr) {
      console.error("DB update error:", updateErr);
      throw new Error("Failed to save generated image");
    }

    return new Response(JSON.stringify({
      success: true,
      asset_key,
      tier: spec.tier,
      pipeline: PIXEL_TIERS.includes(spec.tier) ? "pixel" : "ink",
      image: publicUrl,
      retries: retryCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("batch-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
