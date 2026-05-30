import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let storageDeleted = 0;
  async function walk(prefix: string): Promise<string[]> {
    const out: string[] = [];
    const { data, error } = await sb.storage.from("pixel-assets").list(prefix, { limit: 1000 });
    if (error) throw error;
    for (const it of data ?? []) {
      const p = prefix ? `${prefix}/${it.name}` : it.name;
      // Folders have id === null
      if ((it as any).id === null) {
        const sub = await walk(p);
        out.push(...sub);
      } else {
        out.push(p);
      }
    }
    return out;
  }

  try {
    const paths = await walk("");
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await sb.storage.from("pixel-assets").remove(chunk);
      if (error) throw error;
      storageDeleted += chunk.length;
    }

    const { error: delErr, count } = await sb
      .from("sprite_assets")
      .delete({ count: "exact" })
      .not("id", "is", null);
    if (delErr) throw delErr;

    return new Response(
      JSON.stringify({ ok: true, storageDeleted, rowsDeleted: count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message ?? String(e), storageDeleted }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});