import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY      = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const WD_MULTIPLIER        = 1.5;
const WD_LOOKBACK_PATTERN  = 12;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
function fmtMoney(n: number): string {
  return "$" + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ──────────────────────────────────────────
// Prompt builder
// ──────────────────────────────────────────
function buildPrompt(
  perfData:    any[],
  patternData: any[],
  skuData:     any[],
  weekLabel:   string,
): string {
  // --- PERFORMANCE ---
  const weeks   = [...perfData].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const last4   = weeks.slice(-4);
  const prev4   = weeks.slice(-8, -4);
  const l4avg   = last4.reduce((s: number, w: any) => s + Number(w.total_amount), 0) / Math.max(last4.length, 1);
  const p4avg   = prev4.reduce((s: number, w: any) => s + Number(w.total_amount), 0) / Math.max(prev4.length, 1);
  const chgPct  = p4avg > 0 ? ((l4avg - p4avg) / p4avg * 100) : null;

  // --- AT RISK ---
  const today  = new Date();
  const atRisk = patternData
    .filter((c: any) => Number(c.ordered_weeks) >= 2)
    .map((c: any) => {
      const avgInterval    = WD_LOOKBACK_PATTERN / Number(c.ordered_weeks);
      const alertThreshold = avgInterval * WD_MULTIPLIER;
      const lastOrder      = new Date(c.last_order_week);
      const weeksSince     = (today.getTime() - lastOrder.getTime()) / (7 * 24 * 60 * 60 * 1000);
      return { ...c, avgInterval, alertThreshold, weeksSince };
    })
    .filter((c: any) => c.weeksSince > c.alertThreshold)
    .sort((a: any, b: any) =>
      (b.weeksSince - b.alertThreshold) - (a.weeksSince - a.alertThreshold),
    )
    .slice(0, 10);

  // --- PITCH ---
  const pitch = skuData
    .filter((s: any) => Number(s.recent_clients) >= 3)
    .slice(0, 10);

  // --- BUILD PROMPT (JSON mode) ---
  return `You are a senior sales analyst. Return ONLY a valid JSON object — no markdown, no explanation, no extra text.

Week of: ${weekLabel}

=== INPUT DATA ===

PERFORMANCE (last 8 weeks):
${weeks.map((w: any) => `  ${w.week_start}: ${fmtMoney(Number(w.total_amount))}`).join("\n")}
Recent 4-week avg: ${fmtMoney(l4avg)}/week  |  Prior 4-week avg: ${fmtMoney(p4avg)}/week
Change: ${chgPct !== null ? (chgPct >= 0 ? "+" : "") + chgPct.toFixed(1) + "%" : "N/A"}

AT-RISK CLIENTS (silence > normal pace × ${WD_MULTIPLIER}):
${
  atRisk.length === 0
    ? "None."
    : atRisk.map((c: any) =>
`  ${c.customer_name} (${c.customer_code}): silent ${c.weeksSince.toFixed(1)}wks, normal pace ${c.avgInterval.toFixed(1)}wks, alert at ${c.alertThreshold.toFixed(1)}wks, spend last 12wks: ${fmtMoney(Number(c.total_amount))}`
      ).join("\n")
}

TRENDING SKUs (more clients ordering vs prior 4 weeks):
${
  pitch.length === 0
    ? "None."
    : pitch.map((s: any) =>
`  ${s.sku_code}: ${s.recent_clients} clients now (was ${s.prior_clients}), revenue ${fmtMoney(Number(s.recent_amount))}`
      ).join("\n")
}

=== REQUIRED JSON STRUCTURE ===
{
  "performance": {
    "summary": "<2-3 paragraphs about the trend, drivers, and what it means for this week. Separate paragraphs with \\n\\n. Use real numbers.>",
    "change_pct": <number, positive=up negative=down>,
    "direction": "<up|down|flat>",
    "avg_recent": <number>,
    "avg_prior": <number>,
    "weekly_figures": [{"week": "YYYY-MM-DD", "amount": <number>}]
  },
  "at_risk": [
    {
      "name": "<full client name>",
      "code": "<customer_code>",
      "context": "<1-2 paragraphs: ordering rhythm, how long silent, financial impact. Use exact numbers from the data.>",
      "action": "<Call|Email|Visit>",
      "talking_point": "<exact opening sentence the sales rep says to this client>"
    }
  ],
  "pitch": [
    {
      "sku_code": "<SKU code>",
      "context": "<1 paragraph: how many new clients, revenue, what the trend suggests about demand>",
      "talking_point": "<exact pitch sentence the rep can use with any client who hasn't ordered this>"
    }
  ]
}

Rules: English only. Real numbers only. talking_point must be a complete, natural sentence ready to say out loud.`;
}

// ──────────────────────────────────────────
// Handler
// ──────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb   = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json();
    const { action, week_label } = body;

    // ── GET CACHE ──────────────────────────
    if (action === "get_cache") {
      const { data, error } = await sb
        .from("weekly_digest_cache")
        .select("digest_text, generated_at")
        .eq("week_label", week_label)
        .single();

      if (error && error.code === "PGRST116") {
        return new Response(JSON.stringify({ cached: false }), { headers: corsHeaders });
      }
      if (error) throw error;
      return new Response(JSON.stringify({ cached: true, ...data }), { headers: corsHeaders });
    }

    // ── GENERATE ──────────────────────────
    if (action === "generate") {
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set in Edge Function secrets.");

      const [perfRes, patternRes, skuRes] = await Promise.all([
        sb.rpc("wd_weekly_performance",    { weeks_back:    8  }),
        sb.rpc("wd_client_patterns",       { lookback_weeks: 12 }),
        sb.rpc("wd_sku_trends",            { recent_weeks: 4, prior_weeks: 4 }),
      ]);

      if (perfRes.error)    throw new Error("Performance query: " + perfRes.error.message);
      if (patternRes.error) throw new Error("Pattern query: "     + patternRes.error.message);
      if (skuRes.error)     throw new Error("SKU trend query: "   + skuRes.error.message);

      const prompt = buildPrompt(perfRes.data, patternRes.data, skuRes.data, week_label);

      const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": "Bearer " + OPENAI_API_KEY,
        },
        body: JSON.stringify({
          model:           "gpt-4o-mini",
          max_tokens:      4096,
          response_format: { type: "json_object" },
          messages:        [{ role: "user", content: prompt }],
        }),
      });

      if (!openaiResp.ok) {
        const errText = await openaiResp.text();
        throw new Error("OpenAI API error: " + errText);
      }

      const openaiData = await openaiResp.json();
      const digestText = openaiData.choices[0].message.content;
      const generatedAt = new Date().toISOString();

      await sb.from("weekly_digest_cache").upsert(
        { week_label, digest_text: digestText, generated_at: generatedAt },
        { onConflict: "week_label" },
      );

      return new Response(
        JSON.stringify({ digest_text: digestText, generated_at: generatedAt }),
        { headers: corsHeaders },
      );
    }

    // ── DELETE CACHE (regenerate) ──────────
    if (action === "delete_cache") {
      await sb.from("weekly_digest_cache").delete().eq("week_label", week_label);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });

  } catch (e: any) {
    console.error("[weekly-digest]", e);
    return new Response(
      JSON.stringify({ error: e.message || String(e) }),
      { status: 500, headers: corsHeaders },
    );
  }
});
