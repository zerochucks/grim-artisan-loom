import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("sprite_assets")
    .select("asset_key,tier,category,target_w,target_h,frame_count,ppu,filter_mode,unity_path,primary_color")
    .eq("qa_status", "approved")
    .not("storage_url", "is", null)
    .order("tier").order("category").order("asset_key")
    .limit(1000);

  if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders });

  const assets = (data || []).map((r: any) => {
    const fc = r.frame_count || 1;
    const isAnim = fc > 1;
    const cellW = fc > 0 ? Math.floor(r.target_w / fc) : r.target_w;
    const e: any = {
      asset_key: r.asset_key, tier: r.tier, category: r.category,
      target_w: r.target_w, target_h: r.target_h, cell_w: cellW, cell_h: r.target_h,
      frame_count: fc, ppu: r.ppu, filter_mode: r.filter_mode,
      compression: r.filter_mode === "Point" ? "None" : "Normal Quality",
      mipmaps: r.tier === "background",
      sprite_mode: isAnim ? "Multiple" : "Single",
      slice_mode: isAnim ? "grid" : (r.tier === "ui" && !r.asset_key.startsWith("mod_") ? "nine_slice" : "none"),
      slice_layout: isAnim ? "single_row" : "none",
      grid_columns: isAnim ? fc : 0, grid_rows: isAnim ? 1 : 0,
      unity_path: r.unity_path, primary_color: r.primary_color,
      sorting_layer: ({ background: "Background", tile: "Terrain", unit: "Units", vfx: "VFX_World", portrait: "UI_Overlay", icon: "UI_Overlay", node: "UI_Overlay", ui: "UI_Overlay", font: "UI_Overlay", marketing: "UI_Overlay" } as any)[r.tier] || "Default",
    };
    if (isAnim && r.tier === "unit") {
      if (fc === 10) e.animation = { fps: 8, loop: true, frame_order: [...Array(10).keys()], clips: [{ name: "idle", frames: [0,1,2,3], fps: 5, loop: true }, { name: "attack", frames: [4,5,6], fps: 10, loop: false }, { name: "death", frames: [7,8,9], fps: 6, loop: false }] };
      else if (fc === 5) e.animation = { fps: 6, loop: true, frame_order: [...Array(5).keys()], clips: [{ name: "idle", frames: [0,1], fps: 5, loop: true }, { name: "attack", frames: [2,3], fps: 10, loop: false }, { name: "death", frames: [4], fps: 6, loop: false }] };
    } else if (isAnim && r.tier === "vfx") {
      const loop = /lightning|ambient|fog|glow|lava/.test(r.asset_key);
      e.animation = { fps: 8, loop, frame_order: [...Array(fc).keys()], clips: [{ name: "play", frames: [...Array(fc).keys()], fps: 8, loop }] };
    } else if (isAnim && r.tier === "tile") {
      e.animation = { fps: 2, loop: true, frame_order: [...Array(fc).keys()], clips: [{ name: "cycle", frames: [...Array(fc).keys()], fps: 2, loop: true }] };
    } else if (isAnim) {
      e.animation = { fps: 6, loop: true, frame_order: [...Array(fc).keys()], clips: [{ name: "play", frames: [...Array(fc).keys()], fps: 6, loop: true }] };
    }
    return e;
  });

  const manifest = {
    version: "2.0", generated: new Date().toISOString().split("T")[0], total_assets: assets.length,
    notes: {
      cell_dimensions: "cell_w/cell_h derived from registry target_w/target_h. Actual PNGs (especially units) may differ (e.g. 1408x768 with 128x128 cells). AssetPostprocessor reads actual file dims for slicing.",
      animation_clips: "Units: idle(0-3)/attack(4-6)/death(7-9) for 10f; idle(0-1)/attack(2-3)/death(4) for 5f. No walk cycle.",
      sorting_layers: "Recommended Unity sorting layer assignments."
    },
    assets
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
