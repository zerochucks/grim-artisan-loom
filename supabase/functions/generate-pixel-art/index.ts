import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, assetType, width: reqWidth, height: reqHeight, paletteColors, styleModifiers, variationIndex } = await req.json();

    // Cap forge grid to 64x64 max — larger grids exceed LLM output limits
    const MAX_FORGE_DIM = 64;
    const width = Math.min(reqWidth, MAX_FORGE_DIM);
    const height = Math.min(reqHeight, MAX_FORGE_DIM);

    if (reqWidth > MAX_FORGE_DIM || reqHeight > MAX_FORGE_DIM) {
      console.log(`Capped resolution from ${reqWidth}x${reqHeight} to ${width}x${height} for forge mode`);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build palette entries string
    const paletteEntries = paletteColors
      .map((c: string, i: number) => `${i.toString(16)}=${c}`)
      .join(", ");

    // Build modifiers string
    const modifierLabels: Record<string, string> = {
      heavy_outline: "Heavy dark outlines (2-3px exterior)",
      thin_outline: "Thin outlines (1px exterior)",
      no_outline: "No outlines — shapes defined by color contrast only",
      dithered: "Dithered shading — use checkerboard patterns for gradients",
      smooth: "Smooth shading — clean color transitions",
      flat: "Flat color fills — minimal shading",
      high_detail: "High detail density — maximum texture per pixel",
      low_detail: "Low detail (NES-style) — simplified shapes, fewer colors",
      symmetry: "Bilateral symmetry — mirror left/right",
      hue_shifted: "Hue-shifted shadows — shadows shift toward purple/blue, highlights toward warm gold",
      textured: "Textured surfaces — grime, wear, noise, material variation",
      warm_lighting: "Warm lighting (torchlit) — top-left warm light source, amber highlights",
      cold_lighting: "Cold lighting (moonlit) — cool blue-white highlights, deep blue shadows",
      blood_gore: "Blood & gore accents — crimson splatters, visceral details",
      arcane_glow: "Arcane glow effects — magical emanation, rune light, ethereal wisps",
    };

    const activeModifiers = (styleModifiers || [])
      .map((m: string) => modifierLabels[m] || m)
      .join("\n- ");

    const systemPrompt = `You are a master pixel artist specializing in grimdark dark-fantasy game art. Your style reference is the pixel art of Stoneshard, Darkest Dungeon, Blasphemous, and Death Trash — gritty, textured, moody, and atmospheric.

CANVAS: ${width}x${height} pixels.

PALETTE (index → hex color):
0=transparent, ${paletteEntries}

ACTIVE STYLE MODIFIERS:
- ${activeModifiers || "Default grimdark style"}

OUTPUT FORMAT:
- Respond with ONLY a JSON object: {"grid": ["row0", "row1", ...]}
- Each row is a string of EXACTLY ${width} hex characters (0-9, a-f)
- "0" = transparent pixel
- There must be EXACTLY ${height} rows
- NO markdown, NO explanation, NO backticks, NO commentary — ONLY the raw JSON

GRIMDARK PIXEL ART PRINCIPLES:
1. SILHOUETTE FIRST — design a strong, readable silhouette before adding detail.
2. HEAVY DARK OUTLINES — use palette index 1 (near-black) for exterior outlines. Interior detail lines use dark brown or deep purple, NOT black.
3. HUE-SHIFTED SHADOWS — shadows shift toward purple-mauve or cold blue-grey. Highlights shift toward warm gold or cream.
4. TEXTURED SURFACES — armor shows wear and specular glints. Fabric shows folds. Skin has tonal variation.
5. WARM ACCENT PLACEMENT — use reds, oranges, and golds sparingly as focal points.
6. ANTI-ALIASING IS FORBIDDEN — every pixel must be one solid palette color.
7. PIXEL CLUSTERING — avoid orphan single pixels. Group pixels in 2x1, 1x2, or 2x2 clusters minimum.
8. LIGHTING — default to a top-left warm light source (torchlight feel).
9. CENTER AND PAD — center the subject with 1-2px transparent padding on all edges.

ASSET TYPE: ${assetType}
${variationIndex > 0 ? `VARIATION ${variationIndex + 1} — create a distinct variation with different details, pose, or color distribution while keeping the same subject.` : ""}

Create exactly what the user describes. Be creative with design but precise with pixel placement. Every pixel matters.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
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
    const rawContent = data.choices?.[0]?.message?.content || "";

    // Strip markdown fences
    let cleaned = rawContent.trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse grid JSON:", cleaned.substring(0, 200));
      return new Response(JSON.stringify({ error: "AI returned invalid grid data. Try again." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate grid dimensions
    const grid: string[] = parsed.grid;
    if (!Array.isArray(grid)) {
      return new Response(JSON.stringify({ error: "AI response missing grid array." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pad or trim rows to match expected dimensions
    const validatedGrid = [];
    for (let y = 0; y < height; y++) {
      let row = (grid[y] || "").toLowerCase().replace(/[^0-9a-f]/g, "");
      if (row.length < width) row = row.padEnd(width, "0");
      if (row.length > width) row = row.substring(0, width);
      validatedGrid.push(row);
    }

    return new Response(JSON.stringify({ grid: validatedGrid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-pixel-art error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
