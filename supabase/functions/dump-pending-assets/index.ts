import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const allRows: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("sprite_assets")
      .select("asset_key, tier, category, target_w, target_h, prompt_template, primary_color, qa_status")
      .in("qa_status", ["pending", "generated"])
      .range(offset, offset + 999)
      .order("asset_key");
    
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  return new Response(JSON.stringify(allRows), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
