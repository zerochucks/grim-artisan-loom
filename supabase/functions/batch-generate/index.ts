import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── DUAL-PIPELINE PROMPT SYSTEM ─────────────────────────────────
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
Background: TRANSPARENT (alpha channel, no solid fill, no #0C0C14)`,
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

const QA_PIXEL = `Self-check: ✓ canvas size exact ✓ background rule followed ✓ NO anti-aliasing ✓ NO alpha bleed ✓ silhouette readable at 25% zoom ✓ 1px outline present`;
const QA_INK = `Self-check: ✓ canvas dimensions match ✓ no characters (backgrounds) ✓ no text/UI ✓ rim light consistent ✓ 4+ tonal bands ✓ room for game UI overlay`;

// ─── FRAME ACTION DEFINITIONS FOR UNITS ──────────────────────────
// 10-frame canonical layout: idle(0-3), attack(4-6), death(7-9)
const UNIT_FRAME_ACTIONS: { name: string; group: string; description: string }[] = [
  { name: "idle_1", group: "idle", description: "neutral standing pose, weight centered, relaxed shoulders, weapon at rest" },
  { name: "idle_2", group: "idle", description: "subtle inhale, shoulders slightly raised, weight shifting, weapon held loosely" },
  { name: "idle_3", group: "idle", description: "neutral standing pose, weight centered, slight head tilt, alert but resting" },
  { name: "idle_4", group: "idle", description: "subtle exhale, weight shifted to back foot, weapon grip adjusting" },
  { name: "attack_windup", group: "attack", description: "attack anticipation: weapon drawn back, body coiled, weight on back foot, aggressive lean" },
  { name: "attack_swing", group: "attack", description: "attack mid-swing: weapon at full arc, body lunging forward, maximum extension" },
  { name: "attack_recover", group: "attack", description: "attack follow-through: weapon past target, body recoiling, off-balance settling" },
  { name: "death_stagger", group: "death", description: "hit stagger: body jerking backward, arms flailing, losing balance, pain expression" },
  { name: "death_fall", group: "death", description: "falling: body tilting sideways/backward, knees buckling, weapon dropping, eyes closing" },
  { name: "death_flat", group: "death", description: "dead on ground: body collapsed flat, limbs splayed, weapon beside body, completely still" },
];

// 5-frame compact layout: idle(0-1), attack(2-3), death(4)
const UNIT_FRAME_ACTIONS_5: { name: string; group: string; description: string }[] = [
  { name: "idle_1", group: "idle", description: "neutral standing pose, weight centered, weapon at rest" },
  { name: "idle_2", group: "idle", description: "subtle breathing shift, shoulders slightly raised" },
  { name: "attack_windup", group: "attack", description: "weapon drawn back, body coiled, aggressive stance" },
  { name: "attack_swing", group: "attack", description: "weapon at full extension, lunging forward" },
  { name: "death_collapse", group: "death", description: "collapsing to ground, weapon dropping, body going limp" },
];

// VFX frames: generic effect cycle
function getVfxFrameActions(frameCount: number, assetKey: string): { name: string; group: string; description: string }[] {
  const loop = /lightning|ambient|fog|glow|lava/.test(assetKey);
  const frames: { name: string; group: string; description: string }[] = [];
  for (let i = 0; i < frameCount; i++) {
    const progress = frameCount > 1 ? i / (frameCount - 1) : 0;
    let desc: string;
    if (loop) {
      const phase = i / frameCount;
      desc = `looping effect frame ${i + 1}/${frameCount}: ${phase < 0.33 ? "building intensity" : phase < 0.66 ? "peak energy" : "fading back to start"}, seamless loop continuity`;
    } else {
      desc = `one-shot effect frame ${i + 1}/${frameCount}: ${progress < 0.2 ? "initial spark/trigger" : progress < 0.5 ? "expanding, peak brightness" : progress < 0.8 ? "dissipating, fading" : "final remnants, nearly gone"}`;
    }
    frames.push({ name: `fx_${i}`, group: "play", description: desc });
  }
  return frames;
}

// ─── SINGLE-FRAME PROMPT BUILDER ─────────────────────────────────

function buildSingleFramePrompt(
  spec: Record<string, unknown>,
  frameAction: { name: string; group: string; description: string },
  frameIndex: number,
  totalFrames: number,
  referenceNote: string,
): string {
  const tier = spec.tier as string;
  const prompt = spec.prompt_template as string;
  const primaryColor = spec.primary_color as string | null;
  // Per-frame: each frame is one cell (128×128 for units, or target_h × target_h square)
  const cellW = spec.target_h as number; // cells are square (128×128)
  const cellH = spec.target_h as number;

  const colorNote = primaryColor ? `Primary accent color: ${primaryColor}` : "";

  return `═══ BRAND ═══
${BRAND}

═══ STYLE PIPELINE: PIXEL ART ═══
${PIXEL_HEADER}

═══ ${tier.toUpperCase()} TIER RULES ═══
${TIER_RULES[tier] || TIER_RULES["unit"]}

═══ LAYOUT ═══
EXACT canvas size: ${cellW}×${cellH} px — ONE SINGLE FRAME, NOT a sprite sheet.
Output exactly ONE image at exactly ${cellW}×${cellH} pixels.
Do NOT create multiple frames. Do NOT create a strip. Just this ONE pose.

═══ SUBJECT ═══
${prompt}
${colorNote}

═══ POSE / ACTION ═══
Frame ${frameIndex + 1} of ${totalFrames} (${frameAction.group} group): ${frameAction.name}
Pose: ${frameAction.description}

CRITICAL CONSISTENCY RULES:
- EXACT same character design, outfit, proportions, colors in every frame
- Feet pinned to the SAME pixel row (root-anchored) — no vertical bobbing
- Same head size, same body proportions, same silhouette width
- Only the POSE changes between frames — nothing else
- Background: FULLY TRANSPARENT (alpha channel). Do NOT fill background with any color. No #0C0C14. No black. Pure transparency.

═══ MATERIALS ═══
${MATERIAL_DICT}
${referenceNote}

═══ NEGATIVE ═══
${NEG_BASE}, no gradients, no blur, no anti-aliasing, no photorealism, no ink illustration, no painterly texture, no sprite sheet, no multiple frames, no grid layout, no solid background, no black background, no #0C0C14 background

═══ QA SELF-CHECK ═══
${QA_PIXEL}
✓ Output is exactly ${cellW}×${cellH} px ✓ Single frame only ✓ Feet anchored to same row ✓ Background is TRANSPARENT (alpha channel)`;
}

// ─── NON-ANIMATED PROMPT BUILDER (unchanged logic) ───────────────

function buildPrompt(spec: Record<string, unknown>, referenceNote: string): string {
  const tier = spec.tier as string;
  const prompt = spec.prompt_template as string;
  const w = spec.target_w as number;
  const h = spec.target_h as number;
  const primaryColor = spec.primary_color as string | null;

  const isPixel = PIXEL_TIERS.includes(tier);
  const header = isPixel ? PIXEL_HEADER : INK_HEADER;
  const tierRule = TIER_RULES[tier] || TIER_RULES["icon"];
  const qa = isPixel ? QA_PIXEL : QA_INK;

  let layoutBlock = `Target: ${w}×${h} px`;
  if (tier === "background") {
    layoutBlock = `Target: ${w}×${h} px\nRender at 1920×1080 for clean downscale`;
  } else if (tier === "portrait") {
    layoutBlock = `Target: ${w}×${h} px\nRender at 512×512 for cascaded downscale`;
  }

  const colorNote = primaryColor ? `Primary accent color: ${primaryColor}` : "";

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

// ─── PNG STITCHING (combine individual frames into horizontal strip) ──

async function stitchFrames(frameBase64List: string[], cellW: number, cellH: number): Promise<Uint8Array> {
  // We're in Deno — no DOM canvas. Use raw PNG construction.
  // Decode each frame, composite into a single-row strip, encode as PNG.
  // For simplicity and reliability, we'll use a pixel buffer approach.

  const totalFrames = frameBase64List.length;
  const stripW = cellW * totalFrames;
  const stripH = cellH;

  // Decode PNGs using Deno-compatible approach
  const framePixels: Uint8Array[] = [];

  for (const b64 of frameBase64List) {
    const raw = b64.includes(",") ? b64.split(",")[1] : b64;
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Use ImageMagick-style approach via fetch to a data URL and decode
    // Since we're server-side without canvas, we'll store raw PNGs and
    // use a simple approach: stitch at the binary level using raw pixel manipulation
    framePixels.push(bytes);
  }

  // Since we can't decode PNGs natively in Deno without a library,
  // we'll use a different approach: upload individual frames and create
  // a composite using the image generation model itself, OR we upload
  // each frame separately and let the client-side pipeline stitch them.
  
  // Best approach for Deno: return the individual frame data and let
  // the client stitch, OR use a simple PPM intermediate format.
  // 
  // For now, return the frames as separate uploads and update the
  // asset to reference a manifest of frame URLs.
  
  // Actually, the simplest reliable approach: we'll upload each frame
  // individually and store a JSON manifest of frame URLs in storage_url.
  // The Unity importer and client pipeline will handle stitching.
  
  throw new Error("STITCH_NOT_NEEDED"); // Signal to use multi-frame upload path
}

// ─── AI GENERATION CALL ──────────────────────────────────────────

async function generateSingleImage(
  apiKey: string,
  prompt: string,
  referenceImages: { storage_url: string }[],
  temperature: number,
): Promise<{ image: string; retries: number }> {
  const messageContent: unknown[] = [{ type: "text", text: prompt }];

  for (const ref of referenceImages) {
    if (ref.storage_url) {
      messageContent.push({ type: "image_url", image_url: { url: ref.storage_url } });
    }
  }

  let response: Response | null = null;
  let retryCount = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: messageContent.length === 1 ? (messageContent[0] as any).text : messageContent }],
        modalities: ["image", "text"],
        temperature,
        max_tokens: 8192,
      }),
    });

    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }

    if (response.status >= 502 && response.status <= 504 && attempt < 2) {
      retryCount = attempt + 1;
      const waitMs = (attempt + 1) * 3000;
      console.warn(`[gen] Attempt ${attempt + 1} got ${response.status}, retrying in ${waitMs}ms...`);
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

  const responseText = await response.text();
  const trimmed = responseText.trim();
  if (!trimmed) throw new Error("EMPTY_RESPONSE");

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error("PARSE_ERROR");
  }

  const image = extractImage(data);
  if (!image) throw new Error("NO_IMAGE");

  return { image, retries: retryCount };
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
    const { asset_key, variation_strength } = await req.json();
    const variationPct = typeof variation_strength === "number" ? Math.max(0, Math.min(100, variation_strength)) : 50;

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

    // Fetch approved references for style consistency
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

    const isRegeneration = spec.qa_status === "rejected" || spec.qa_status === "generated";
    const frameCount = spec.frame_count as number;
    const isAnimated = frameCount > 1 && (spec.tier === "unit" || spec.tier === "vfx");

    // ─── ANIMATED ASSETS: per-frame generation (background) ─────
    if (isAnimated) {
      // Mark as generating immediately
      await supabase.from("sprite_assets").update({ qa_status: "generating", user_id: user.id }).eq("asset_key", asset_key);

      let frameActions: { name: string; group: string; description: string }[];
      if (spec.tier === "unit") {
        frameActions = frameCount === 10 ? UNIT_FRAME_ACTIONS :
                       frameCount === 5  ? UNIT_FRAME_ACTIONS_5 :
                       Array.from({ length: frameCount }, (_, i) => ({
                         name: `frame_${i}`,
                         group: i < Math.ceil(frameCount * 0.4) ? "idle" : i < Math.ceil(frameCount * 0.7) ? "attack" : "death",
                         description: `action frame ${i + 1} of ${frameCount}`,
                       }));
      } else {
        frameActions = getVfxFrameActions(frameCount, asset_key);
      }

      console.log(`[batch] Generating ${asset_key} (${spec.tier}) as ${frameCount} individual frames (background)`);

      // Process all frames in the background so the request doesn't time out
      const backgroundWork = (async () => {
        try {
          const versionTag = Date.now();
          const frameUrls: string[] = [];
          let totalRetries = 0;

          for (let i = 0; i < frameActions.length; i++) {
            const action = frameActions[i];
            const prompt = buildSingleFramePrompt(spec, action, i, frameCount, referenceNote);

            let finalPrompt = prompt;
            if (isRegeneration) {
              const variationSeed = (versionTag + i) % 1000000;
              const strengthLabel = variationPct <= 25 ? "SUBTLE TWEAK" : variationPct <= 60 ? "MODERATE VARIATION" : "COMPLETELY NEW INTERPRETATION";
              finalPrompt += `\n\n═══ VARIATION (${strengthLabel}) ═══\nRe-generation (strength: ${variationPct}%). Variation seed: ${variationSeed}`;
            }

            if (i > 0) await new Promise(r => setTimeout(r, 1500));

            console.log(`[batch] Frame ${i + 1}/${frameCount}: ${action.name} (${action.group})`);

            const result = await generateSingleImage(
              LOVABLE_API_KEY!,
              finalPrompt,
              referenceImages,
              isRegeneration ? 0.7 + (variationPct / 100) * 0.8 : 0.9,
            );
            totalRetries += result.retries;

            const base64Data = result.image.includes(",") ? result.image.split(",")[1] : result.image;
            const mimeMatch = result.image.match(/^data:(image\/\w+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
            const ext = mimeType === "image/jpeg" ? "jpg" : "png";
            const framePath = `${asset_key}/frame_${i}_${action.name}-${versionTag}.${ext}`;

            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);

            const { error: uploadErr } = await supabase.storage
              .from("pixel-assets")
              .upload(framePath, bytes, { contentType: mimeType, upsert: false });

            if (uploadErr) {
              console.error(`[batch] Frame ${i} upload error:`, uploadErr);
              throw new Error(`Failed to upload frame ${i}`);
            }

            const { data: urlData } = supabase.storage.from("pixel-assets").getPublicUrl(framePath);
            frameUrls.push(urlData.publicUrl);
          }

          // Build manifest
          const manifest = {
            asset_key,
            tier: spec.tier,
            frame_count: frameCount,
            cell_w: spec.target_h as number, // square cells (128×128)
            cell_h: spec.target_h as number,
            strip_w: (spec.target_h as number) * frameCount,
            strip_h: spec.target_h as number,
            frames: frameActions.map((action, i) => ({
              index: i,
              name: action.name,
              group: action.group,
              url: frameUrls[i],
            })),
            clips: spec.tier === "unit"
              ? frameCount === 10
                ? [
                    { name: "idle", frames: [0, 1, 2, 3], fps: 5, loop: true },
                    { name: "attack", frames: [4, 5, 6], fps: 10, loop: false },
                    { name: "death", frames: [7, 8, 9], fps: 6, loop: false },
                  ]
                : frameCount === 5
                ? [
                    { name: "idle", frames: [0, 1], fps: 5, loop: true },
                    { name: "attack", frames: [2, 3], fps: 10, loop: false },
                    { name: "death", frames: [4], fps: 6, loop: false },
                  ]
                : [{ name: "play", frames: [...Array(frameCount).keys()], fps: 6, loop: true }]
              : [{ name: "play", frames: [...Array(frameCount).keys()], fps: 8, loop: /lightning|ambient|fog|glow|lava/.test(asset_key) }],
            generated: new Date().toISOString(),
          };

          const manifestPath = `${asset_key}/manifest-${versionTag}.json`;
          const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
          await supabase.storage
            .from("pixel-assets")
            .upload(manifestPath, manifestBytes, { contentType: "application/json", upsert: false });
          const { data: manifestUrlData } = supabase.storage.from("pixel-assets").getPublicUrl(manifestPath);

          await supabase.from("sprite_assets").update({
            storage_url: manifestUrlData.publicUrl,
            qa_status: "generated",
            user_id: user.id,
          }).eq("asset_key", asset_key);

          console.log(`[batch] ✅ ${asset_key} complete: ${frameCount} frames, ${totalRetries} retries`);
        } catch (err: any) {
          console.error(`[batch] ❌ ${asset_key} background error:`, err);
          await supabase.from("sprite_assets").update({
            qa_status: "rejected",
          }).eq("asset_key", asset_key);
        }
      })();

      // Keep the worker alive until all frames are done
      (globalThis as any).EdgeRuntime?.waitUntil?.(backgroundWork);

      return new Response(JSON.stringify({
        success: true,
        asset_key,
        mode: "per_frame_async",
        message: `Generating ${frameCount} frames in background. Poll qa_status for completion.`,
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── NON-ANIMATED ASSETS: single generation (unchanged) ──────
    const messageContent: unknown[] = [
      { type: "text", text: buildPrompt(spec, referenceNote) },
    ];

    for (const ref of referenceImages) {
      if (ref.storage_url) {
        messageContent.push({ type: "image_url", image_url: { url: ref.storage_url } });
      }
    }

    if (isRegeneration) {
      const previousImageUrl = spec.storage_url as string | null;
      if (previousImageUrl) {
        messageContent.push({ type: "image_url", image_url: { url: previousImageUrl } });
      }
      const variationSeed = Date.now() % 1000000;
      const strengthLabel = variationPct <= 25 ? "SUBTLE TWEAK" : variationPct <= 60 ? "MODERATE VARIATION" : "COMPLETELY NEW INTERPRETATION";
      const instructions = variationPct <= 25
        ? "Make minor adjustments: slightly shift lighting, tweak small details."
        : variationPct <= 60
        ? "Produce a noticeably different version: vary the pose/angle, change lighting direction."
        : "Produce a COMPLETELY DIFFERENT interpretation: new pose, new angle, reimagined elements.";
      (messageContent[0] as any).text += `\n\n═══ VARIATION (${strengthLabel}) ═══\nRe-generation (strength: ${variationPct}%).\n${instructions}\nVariation seed: ${variationSeed}`;
    }

    console.log(`[batch] Generating ${asset_key} (${spec.tier} ${spec.target_w}×${spec.target_h}) pipeline=${PIXEL_TIERS.includes(spec.tier) ? "PIXEL" : "INK"}`);

    const result = await generateSingleImage(
      LOVABLE_API_KEY,
      typeof messageContent[0] === "object" ? (messageContent[0] as any).text : "",
      referenceImages,
      isRegeneration ? 0.7 + (variationPct / 100) * 0.8 : 0.9,
    );

    const base64Data = result.image.includes(",") ? result.image.split(",")[1] : result.image;
    const mimeMatch = result.image.match(/^data:(image\/\w+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    const ext = mimeType === "image/jpeg" ? "jpg" : "png";
    const versionTag = Date.now();
    const filePath = `${asset_key}-${versionTag}.${ext}`;

    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const { error: uploadErr } = await supabase.storage
      .from("pixel-assets")
      .upload(filePath, bytes, { contentType: mimeType, upsert: false });

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
      mode: "single",
      image: publicUrl,
      retries: result.retries,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("batch-generate error:", e);

    if (e.message === "RATE_LIMITED") {
      return new Response(JSON.stringify({ error: "Rate limited. Wait and retry.", retryable: true }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e.message === "EMPTY_RESPONSE" || e.message === "PARSE_ERROR") {
      return new Response(JSON.stringify({ error: "AI returned invalid response, retrying may help", retryable: true }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e.message === "NO_IMAGE") {
      return new Response(JSON.stringify({ error: "AI did not return an image", retryable: true }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
