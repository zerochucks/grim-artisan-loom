import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { SQL } from "./sql.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_DB_URL missing" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const client = new Client(dbUrl);
  try {
    await client.connect();
    const before = await client.queryObject<{ c: bigint }>(
      "SELECT count(*)::bigint AS c FROM public.sprite_assets",
    );
    await client.queryArray(SQL);
    const after = await client.queryObject<{ c: bigint }>(
      "SELECT count(*)::bigint AS c FROM public.sprite_assets",
    );
    const bosses = await client.queryObject<{ c: bigint }>(
      "SELECT count(*)::bigint AS c FROM public.sprite_assets WHERE target_w=3840 AND target_h=384",
    );
    const units = await client.queryObject<{ c: bigint }>(
      "SELECT count(*)::bigint AS c FROM public.sprite_assets WHERE target_w=2560 AND target_h=256",
    );
    return new Response(
      JSON.stringify({
        ok: true,
        before: Number(before.rows[0].c),
        after: Number(after.rows[0].c),
        boss_sheets: Number(bosses.rows[0].c),
        unit_sheets: Number(units.rows[0].c),
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } finally {
    try { await client.end(); } catch (_) {}
  }
});