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

  // --- BUILD PROMPT ---
  return `You are a senior sales analyst briefing a distribution team at the start of their week.
Generate a detailed, actionable Weekly Sales Digest from the data below.

Audience: sales reps who are not data-savvy. Write clearly and directly.
For every at-risk client and every pitch item, tell them WHAT to do, WHO to contact, and exactly WHAT to say.
Use real numbers from the data. Be thorough — this is a weekly briefing, brevity is NOT a goal.

Week of: ${weekLabel}

=== PERFORMANCE — last 8 weeks of revenue ===
${weeks.map((w: any) => `  ${w.week_start}: ${fmtMoney(Number(w.total_amount))}`).join("\n")}

4-week average (recent): ${fmtMoney(l4avg)}/week
4-week average (prior):  ${fmtMoney(p4avg)}/week
Change: ${chgPct !== null ? (chgPct >= 0 ? "+" : "") + chgPct.toFixed(1) + "%" : "Insufficient history"}

=== AT-RISK CLIENTS — ${atRisk.length} need attention ===
(Alert fires when silence exceeds the client's own normal ordering pace × ${WD_MULTIPLIER})
${
  atRisk.length === 0
    ? "No at-risk clients this week — all clients are within their normal ordering rhythm."
    : atRisk.map((c: any) =>
`Client: ${c.customer_name} (${c.customer_code})
  Normal pace: orders every ${c.avgInterval.toFixed(1)} weeks  |  Last order: ${c.last_order_week}
  Silent for: ${c.weeksSince.toFixed(1)} weeks  (alert at ${c.alertThreshold.toFixed(1)} weeks)
  Active weeks in last ${WD_LOOKBACK_PATTERN} wks: ${c.ordered_weeks}/${WD_LOOKBACK_PATTERN}
  Total spend (last ${WD_LOOKBACK_PATTERN} wks): ${fmtMoney(Number(c.total_amount))}`
      ).join("\n\n")
}

=== TRENDING SKUs — pitch opportunities ===
(SKUs where the number of ordering clients grew vs prior 4 weeks)
${
  pitch.length === 0
    ? "No strong SKU trends detected this week."
    : pitch.map((s: any) =>
`SKU: ${s.sku_code}
  Recent 4 wks: ${s.recent_clients} clients  |  Revenue: ${fmtMoney(Number(s.recent_amount))}
  Prior 4 wks:  ${s.prior_clients} clients   |  New clients this period: +${Number(s.recent_clients) - Number(s.prior_clients)}`
      ).join("\n\n")
}

=== OUTPUT FORMAT ===
Generate the digest using EXACTLY this structure (keep the divider lines):

LAST WEEK PERFORMANCE
[2–3 paragraphs: overall trend, what's driving it, what it means for the week ahead.
 Then list the weekly revenue figures clearly. Note any sharp week-on-week moves.]

────────────────────────────────────────
AT RISK — Clients to contact this week
────────────────────────────────────────
[Repeat for EACH at-risk client:]

[Client Name]
[Paragraph explaining their ordering rhythm, how long they've been silent, and why this matters financially.
 Reference the specific numbers: normal pace, days silent, estimated value at stake.]
→ Recommended action: [specific action — call / email / visit]
   Talking point: "[Write the exact opening sentence the rep can use in the conversation]"

────────────────────────────────────────
THIS WEEK'S PITCH OPPORTUNITIES
────────────────────────────────────────
[Repeat for each trending SKU:]

SKU [code]
[Explain what the trend means — how many new clients, revenue growth, what it signals about demand.
 Suggest which type of client is likely a good fit.]
→ Talking point: "[Write the exact pitch sentence the rep can drop into any client call]"

Write in English only. Do not invent data not present above. Use real numbers throughout.`;
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
          model:      "gpt-4o-mini",
          max_tokens: 4096,
          messages:   [{ role: "user", content: prompt }],
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
