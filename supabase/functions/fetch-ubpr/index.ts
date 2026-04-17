import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_TTL_HOURS = 24 * 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Guard against malformed or empty body before touching fields
    let rssd: string, bankName: string;
    try {
      const body = await req.json();
      rssd = body.rssd;
      bankName = body.bankName;
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or missing JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!rssd) {
      return new Response(
        JSON.stringify({ success: false, error: 'RSSD ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cacheExpiry = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from('ubpr_cache')
      .select('metrics, fetched_at')
      .eq('rssd', rssd)
      .gt('fetched_at', cacheExpiry)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      console.log(`Cache hit for RSSD ${rssd} (fetched ${cached.fetched_at})`);
      return new Response(
        JSON.stringify({ success: true, data: cached.metrics, source: 'cache', cachedAt: cached.fetched_at }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('TINYFISH_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Cache miss for RSSD ${rssd}, starting async TinyFish run...`);

    const tinyFishResponse = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://cdr.ffiec.gov/public/ManageFacsimiles.aspx',
        goal: `On this FFIEC CDR page, I need to pull the UBPR (Uniform Bank Performance Report) for a specific bank:\n\n1. In the "Financial Institution" field or search box, enter the RSSD ID: ${rssd}\n2. If there's a search button, click it to find the institution\n3. Select "UBPR" as the report type\n4. Select the most recent report date available (e.g., 12/31/2024 or 09/30/2024)\n5. Generate/view the report\n6. Extract the following key financial ratios from the UBPR Summary Ratios page for the LAST 6 quarters:\n   - Return on Average Assets (ROAA)\n   - Return on Average Equity (ROAE)\n   - Net Interest Margin (NIM)\n   - Efficiency Ratio\n   - Cost of Funds (or Net Non-Core Funding Dependence)\n   - Net Loans & Leases to Deposits\n   - Tier 1 Leverage Capital Ratio\n   - Total Risk-Based Capital Ratio\n   - Noncurrent Loans to Loans (NPL ratio)\n   - Allowance to Loans (ALLL ratio)\n\nReturn the data as a JSON object with this exact structure:\n{\n  "quarters": [\n    {\n      "quarter": "Q4 2024",\n      "date": "12/31/2024",\n      "roaa": 1.05,\n      "roae": 10.5,\n      "nim": 3.25,\n      "efficiencyRatio": 62.5,\n      "costOfFunds": 2.1,\n      "loanToDeposit": 78.5,\n      "tier1Capital": 11.2,\n      "totalCapital": 13.5,\n      "nplRatio": 0.45,\n      "allowanceRatio": 1.15\n    }\n  ]\n}\n\nMake sure all values are numbers (not strings). Include as many quarters as are visible in the report (up to 8).`,
        browser_profile: 'lite',
      }),
    });

    if (!tinyFishResponse.ok) {
      const errorText = await tinyFishResponse.text();
      console.error(`TinyFish async start error (HTTP ${tinyFishResponse.status}):`, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `TinyFish API error: ${tinyFishResponse.status}`,
          // Include up to 300 chars of the upstream body to aid debugging
          detail: errorText.slice(0, 300),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tinyFishResult = await tinyFishResponse.json();
    const runId = tinyFishResult?.run_id;

    if (!runId) {
      console.error('TinyFish async run did not return a run_id:', tinyFishResult);
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish did not return a run ID' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from('ffiec_report_jobs')
      .insert({
        rssd,
        bank_name: bankName,
        report_type: 'ubpr_metrics',
        status: 'processing',
        source: 'live',
        tinyfish_run_id: runId,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('Job insert error:', jobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create FFIEC retrieval job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Started TinyFish async run ${runId} for RSSD ${rssd}`);

    return new Response(
      JSON.stringify({ success: true, source: 'live', status: 'processing', jobId: job.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error fetching UBPR:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
