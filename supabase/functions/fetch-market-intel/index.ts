import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bankName, rssd, state, city, peerBanks } = await req.json();

    if (!bankName || !rssd) {
      return new Response(
        JSON.stringify({ success: false, error: 'bankName and rssd are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('TINYFISH_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache (7-day TTL for market intel)
    const cacheExpiry = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existingJob } = await supabase
      .from('ffiec_report_jobs')
      .select('id, status, result_metrics, completed_at')
      .eq('rssd', rssd)
      .eq('report_type', 'market_intel')
      .eq('status', 'completed')
      .gt('completed_at', cacheExpiry)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJob?.result_metrics) {
      console.log(`Market intel cache hit for ${bankName}`);
      return new Response(
        JSON.stringify({ success: true, source: 'cache', status: 'completed', data: existingJob.result_metrics }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if there's already a processing job
    const { data: pendingJob } = await supabase
      .from('ffiec_report_jobs')
      .select('id')
      .eq('rssd', rssd)
      .eq('report_type', 'market_intel')
      .eq('status', 'processing')
      .limit(1)
      .maybeSingle();

    if (pendingJob) {
      return new Response(
        JSON.stringify({ success: true, status: 'processing', jobId: pendingJob.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build the peer bank names list for the prompt
    const peerNamesList = (peerBanks || []).map((p: { name: string }) => p.name).join(', ');
    const location = [city, state].filter(Boolean).join(', ');

    const goal = `I need comprehensive market intelligence for "${bankName}" (RSSD: ${rssd}) located in ${location || 'the United States'}.

TASK 1 — Competitor Deposit Rates:
Go to https://www.bankrate.com/banking/savings/best-high-yield-savings-accounts-rates/ and extract the top 10 savings/money market rates currently listed. Then go to https://www.bankrate.com/banking/cds/best-cd-rates/ and extract the top 10 CD rates (6-month, 12-month, 18-month, 24-month).

TASK 2 — FDIC Summary of Deposits:
Go to https://www7.fdic.gov/sod/sodMarketBank.asp and search for "${bankName}" or RSSD/CERT number to find the bank's market share data. Extract:
- Total deposits in the bank's primary market area
- Number of branches
- Market share percentage
- Top competitors in the same market with their deposit totals and market share

TASK 3 — Peer Bank Rates:
${peerNamesList ? `Search Google for current deposit rates advertised by these peer banks: ${peerNamesList}. Check their websites for posted CD and savings rates.` : 'Skip this task — no peer banks were selected.'}

Return ALL results as a single JSON object with this exact structure:
{
  "competitorRates": [
    {
      "institution": "Bank Name",
      "product": "High-Yield Savings",
      "rate": 4.75,
      "source": "bankrate.com",
      "date": "2026-03"
    }
  ],
  "fdicMarketShare": {
    "bankName": "${bankName}",
    "marketArea": "City, State MSA",
    "totalDeposits": 500000000,
    "branches": 5,
    "marketSharePct": 2.5,
    "competitors": [
      {
        "name": "Competitor Bank",
        "deposits": 1000000000,
        "branches": 10,
        "marketSharePct": 5.0
      }
    ]
  },
  "peerBankRates": [
    {
      "bankName": "Peer Bank Name",
      "product": "12-Month CD",
      "rate": 4.50,
      "source": "bankwebsite.com"
    }
  ]
}

All rate values must be numbers (not strings). Deposit values in raw dollars (no formatting).`;

    console.log(`Starting market intel TinyFish run for ${bankName}...`);

    const tinyFishResponse = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://www.bankrate.com/banking/savings/best-high-yield-savings-accounts-rates/',
        goal,
        browser_profile: 'lite',
      }),
    });

    if (!tinyFishResponse.ok) {
      const errorText = await tinyFishResponse.text();
      console.error('TinyFish error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `TinyFish API error: ${tinyFishResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tinyFishResult = await tinyFishResponse.json();
    const runId = tinyFishResult?.run_id;

    if (!runId) {
      console.error('No run_id from TinyFish:', tinyFishResult);
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
        report_type: 'market_intel',
        status: 'processing',
        source: 'live',
        tinyfish_run_id: runId,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('Job insert error:', jobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create market intel job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Started market intel run ${runId} for ${bankName}, job ${job.id}`);

    return new Response(
      JSON.stringify({ success: true, source: 'live', status: 'processing', jobId: job.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error fetching market intel:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
