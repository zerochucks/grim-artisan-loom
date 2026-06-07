import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import UPNG from "https://esm.sh/upng-js@2.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function b64encode(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[],
    );
  }
  return btoa(s);
}

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
    const enc = UPNG.encode([rgba.buffer], w, h, 0);
    return `data:image/png;base64,${b64encode(new Uint8Array(enc))}`;
  } catch (err) {
    console.error("[bg-strip] failed:", err);
    return dataUrl;
  }
}

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
        out[di + 3] = a < 128 ? 0 : 255;
      }
    }
    const png = UPNG.encode([out.buffer], targetW, targetH, 0);
    return `data:image/png;base64,${b64encode(new Uint8Array(png))}`;
  } catch (err) {
    console.error("[normalize] failed:", err);
    return dataUrl;
  }
}

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
      if (part.type === "image" && part.source?.data) {
        return `data:image/${part.source.media_type || "png"};base64,${part.source.data}`;
      }
    }
  }
  if (Array.isArray(msg?.parts)) {
    for (const part of msg.parts) {
      if (part.inline_data) return `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
    }
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      mode,            // 'manual' | 'ai'
      asset_key,
      source_image,    // data URL of the canvas (always required)
      sub_prompt,      // ai only
      region,          // { x, y, w, h } | null — pixel coords in source_image
      frame_index,     // number | null — when editing a single frame in a manifest
      target_w,
      target_h,
      tier,
      is_pixel,        // boolean — apply bg-strip + normalize on output
    } = body;

    if (!asset_key || !source_image || !target_w || !target_h) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userResp } = await userClient.auth.getUser();
    const user = userResp?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let finalImage = source_image;

    if (mode === "ai") {
      if (!sub_prompt || !sub_prompt.trim()) {
        return new Response(JSON.stringify({ error: "sub_prompt required for ai mode" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const focusBlock = region
        ? `Apply changes ONLY within the rectangular region x=${region.x} y=${region.y} w=${region.w} h=${region.h} (pixel coordinates of the input image). Leave every pixel outside that region IDENTICAL to the input.\n`
        : "";

      const styleGuard = is_pixel
        ? `Preserve the existing pixel grid, palette, and silhouette. Hard pixel edges ONLY — no anti-aliasing, no blur, no painterly texture. Background MUST stay fully transparent (no navy fill, no #0C0C14, no solid background).`
        : `Preserve the existing illustration style, palette, lighting direction, and composition.`;

      const editPrompt = `You are editing an existing ${tier} asset. ${focusBlock}Requested change: ${sub_prompt}\n\n${styleGuard}\nOutput the FULL image at exactly ${target_w}×${target_h} pixels.`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: editPrompt },
              { type: "image_url", image_url: { url: source_image } },
            ],
          }],
          modalities: ["image", "text"],
        }),
      });

      if (!aiResp.ok) {
        const text = await aiResp.text();
        const status = aiResp.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit — wait and retry" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Credits depleted" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("AI edit failed:", status, text.slice(0, 300));
        throw new Error(`AI gateway ${status}`);
      }

      const aiData = await aiResp.json();
      const aiImage = extractImage(aiData);
      if (!aiImage) throw new Error("AI returned no image");
      finalImage = aiImage;
    }

    if (is_pixel) {
      finalImage = stripBgPixelDataUrl(finalImage);
      finalImage = normalizePixelPng(finalImage, target_w, target_h);
    }

    // Upload edited image
    const b64 = finalImage.includes(",") ? finalImage.split(",")[1] : finalImage;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const versionTag = `edit-${Date.now()}`;
    const isFrame = typeof frame_index === "number";
    const filePath = isFrame
      ? `${asset_key}/frame_${frame_index}_${versionTag}.png`
      : `${asset_key}/${versionTag}.png`;

    const { error: upErr } = await supabase.storage
      .from("pixel-assets")
      .upload(filePath, bytes, { contentType: "image/png", upsert: false });
    if (upErr) {
      console.error("Upload error:", upErr);
      throw new Error("Storage upload failed");
    }
    const { data: urlData } = supabase.storage.from("pixel-assets").getPublicUrl(filePath);
    const editedUrl = urlData.publicUrl;

    let storageUrl = editedUrl;

    if (isFrame) {
      // Patch the manifest: fetch current, replace frame URL, re-upload as a new versioned manifest
      const { data: row } = await supabase
        .from("sprite_assets")
        .select("storage_url")
        .eq("asset_key", asset_key)
        .single();

      if (row?.storage_url && row.storage_url.endsWith(".json")) {
        try {
          const mResp = await fetch(row.storage_url);
          const manifest = await mResp.json();
          if (Array.isArray(manifest.frames)) {
            const target = manifest.frames.find((f: any) => f.index === frame_index);
            if (target) target.url = editedUrl;
            manifest.edited = new Date().toISOString();
            const mPath = `${asset_key}/manifest-${versionTag}.json`;
            const mBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
            const { error: mErr } = await supabase.storage
              .from("pixel-assets")
              .upload(mPath, mBytes, { contentType: "application/json", upsert: false });
            if (!mErr) {
              const { data: mUrl } = supabase.storage.from("pixel-assets").getPublicUrl(mPath);
              storageUrl = mUrl.publicUrl;
            }
          }
        } catch (err) {
          console.error("manifest patch failed:", err);
        }
      }
    }

    await supabase
      .from("sprite_assets")
      .update({ storage_url: storageUrl, qa_status: "generated", user_id: user.id })
      .eq("asset_key", asset_key);

    return new Response(JSON.stringify({
      success: true,
      url: storageUrl,
      frame_url: isFrame ? editedUrl : undefined,
      mode,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("edit-asset error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});