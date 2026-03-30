import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { bankName, inputs, signals, profile } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert community bank analyst writing for bank executives, board members, and regulators. 
You produce concise, data-driven narratives about a bank's deposit behavior and market positioning.
Use precise financial language. Reference specific metrics provided. Be direct and actionable.
Do NOT use markdown headers or bullet points — write flowing executive summary paragraphs.
Output exactly 5 paragraphs in this order, separated by blank lines:
1. Deposit Need Assessment
2. Pricing Posture Assessment  
3. Growth Capacity Assessment
4. Earnings Pressure Assessment
5. Overall Behavior Classification & Strategic Outlook`;

    const userPrompt = `Analyze ${bankName}'s deposit behavior based on this UBPR-derived framework data:

CAPITAL:
- Tier 1 Leverage Ratio: ${inputs.capital.tier1_leverage_ratio}%
- Total Risk-Based Capital: ${inputs.capital.total_risk_based_capital}%
- Capital Trend: ${inputs.capital.capital_trend}

EARNINGS:
- Net Interest Margin: ${inputs.earnings.net_interest_margin}%
- NIM Trend: ${inputs.earnings.nim_trend}
- Cost of Funds: ${inputs.earnings.cost_of_funds}%
- CoF Trend: ${inputs.earnings.cost_of_funds_trend}
- CoF vs Peer: ${inputs.earnings.cost_of_funds_vs_peer}
- ROA: ${inputs.earnings.roa}%
- ROA Trend: ${inputs.earnings.roa_trend}

ASSET QUALITY:
- NPA Ratio: ${inputs.asset_quality.npa_ratio}%
- NPA Trend: ${inputs.asset_quality.npa_trend}
- ACL to Loans: ${inputs.asset_quality.acl_to_loans}%

LIQUIDITY:
- Loan-to-Deposit Ratio: ${inputs.liquidity.loan_to_deposit_ratio}%
- LDR Trend: ${inputs.liquidity.ldr_trend}
- Borrowings Trend: ${inputs.liquidity.borrowings_trend}

DERIVED SIGNALS:
- Deposit Need: ${signals.deposit_need}
- Pricing Posture: ${signals.pricing_posture}
- Growth Capacity: ${signals.growth_capacity}
- Earnings Flexibility: ${signals.earnings_flexibility}

BEHAVIOR CLASSIFICATION: ${profile}

Write the 5-paragraph analysis now.`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Split into paragraphs
    const paragraphs = content
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        signals,
        narratives: paragraphs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-deposit-behavior error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
