import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth check
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

    // Fetch the spec
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
      ? `\nIMPORTANT CONGRUENCY: Match the visual style, color temperature, and level of detail of these approved assets in the same tier: ${approvedRefs.map(r => r.asset_key).join(", ")}. Maintain world-building consistency.`
      : "";

    // Build the reference image content if we have approved assets
    const referenceImages = approvedRefs?.filter(r => r.storage_url) || [];

    // Call generate-image-asset (reuse existing edge function logic via AI gateway directly)
    const messageContent: unknown[] = [
      { type: "text", text: buildPrompt(spec, referenceNote) },
    ];

    // Attach first approved reference image if available
    if (referenceImages.length > 0 && referenceImages[0].storage_url) {
      messageContent.push({
        type: "image_url",
        image_url: { url: referenceImages[0].storage_url },
      });
    }

    console.log(`[batch] Generating ${asset_key} (${spec.tier} ${spec.target_w}×${spec.target_h})`);

    // Retry up to 3 times for transient errors (502, 503, 504)
    let response: Response | null = null;
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

      // Retry on transient gateway errors
      if (response.status >= 502 && response.status <= 504 && attempt < 2) {
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

    const data = await response.json();
    const imageBase64 = extractImage(data);

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "AI did not return an image", retryable: true }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload image to storage instead of storing base64 in DB
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

    // Update the sprite_asset with storage URL and set qa_status to 'generated'
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
      image: publicUrl,
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

// ─── PROMPT BUILDER ──────────────────────────────────────────────

function buildPrompt(spec: Record<string, unknown>, referenceNote: string): string {
  const tier = spec.tier as string;
  const prompt = spec.prompt_template as string;
  const w = spec.target_w as number;
  const h = spec.target_h as number;
  const frameCount = spec.frame_count as number;
  const primaryColor = spec.primary_color as string | null;

  const BRAND = "Grimdark low-fantasy, morally-gray, gritty, weathered, lived-in. Inspired by Stoneshard, Darkest Dungeon, Kingdom Death.";
  const NEGATIVES = "no anime, no cartoon, no chibi, no cel-shading, no modern clothing, no sci-fi elements, no neon lighting, no text overlays, no watermarks";

  if (tier === "background") {
    return `Generate a single high-quality game background image.
Brand: ${BRAND}
Subject: ${prompt}
Target: ${w}×${h}, cinematic photorealism, wide establishing shot.
Lighting: warm torchlight key, cold cyan-blue rim, volumetric haze.
${referenceNote}
Negatives: ${NEGATIVES}, no characters, no readable text`;
  }

  if (tier === "portrait") {
    return `Generate a single high-quality game portrait asset.
Brand: ${BRAND}
Subject: ${prompt}
Asset: portrait | ${w}×${h} | Render at 512×512 for cascaded downscale
Composition: chest-up, centered, 35mm, shallow DOF.
Lighting: warm torchlight key + cold cyan-blue rim light on one edge.
Value: minimum 4 distinct tonal bands. No value collapsing.
${referenceNote}
Negatives: ${NEGATIVES}, no extra limbs, no deformed hands, no blurred face`;
  }

  if (tier === "unit") {
    const frameH = h;
    return `Generate a pixel art sprite sheet.
Brand: ${BRAND}
Subject: ${prompt}
${frameCount} frames horizontal strip, each frame ${frameH}×${frameH} pixels.
Total image: ${w}×${h}. Transparent background.
Pixel art rules: hard pixel edges, NO anti-aliasing, NO gradients, 1px dark outline (#0C0C14).
Frame layout: 4 idle (subtle bob), 3 attack (wind-up, strike, recover), 3 death (stagger, fall, prone).
Consistent top-left directional light across all frames.
${referenceNote}
Negatives: ${NEGATIVES}, no gradients, no blur, no anti-aliasing, no photorealism`;
  }

  // icon, tile, node
  const colorNote = primaryColor ? `Primary accent color: ${primaryColor}.` : "";
  return `Generate a pixel art ${tier}.
Brand: ${BRAND}
Subject: ${prompt}
${w}×${h} pixels. Transparent background. Hard pixel edges, 1px outline (#0C0C14).
Bold readable silhouette at ${Math.min(w, h)}px. ${colorNote}
${referenceNote}
Negatives: ${NEGATIVES}, no gradients, no blur, no anti-aliasing`;
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
