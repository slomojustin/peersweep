import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_TTL_HOURS = 24 * 30; // 30 days - UBPR data updates quarterly

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rssd, bankName } = await req.json();

    if (!rssd) {
      return new Response(
        JSON.stringify({ success: false, error: 'RSSD ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for cache writes
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cache miss for RSSD ${rssd}, fetching from FFIEC CDR via TinyFish...`);

    const apiKey = Deno.env.get('TINYFISH_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use TinyFish to navigate the FFIEC CDR and extract UBPR data
    const tinyFishResponse = await fetch('https://agent.tinyfish.ai/v1/automation/run', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://cdr.ffiec.gov/public/ManageFacsimiles.aspx',
        goal: `On this FFIEC CDR page, I need to pull the UBPR (Uniform Bank Performance Report) for a specific bank:

1. In the "Financial Institution" field or search box, enter the RSSD ID: ${rssd}
2. If there's a search button, click it to find the institution
3. Select "UBPR" as the report type
4. Select the most recent report date available (e.g., 12/31/2024 or 09/30/2024)
5. Generate/view the report
6. Extract the following key financial ratios from the UBPR Summary Ratios page for the LAST 6 quarters:
   - Return on Average Assets (ROAA) 
   - Return on Average Equity (ROAE)
   - Net Interest Margin (NIM)
   - Efficiency Ratio
   - Cost of Funds (or Net Non-Core Funding Dependence)
   - Net Loans & Leases to Deposits
   - Tier 1 Leverage Capital Ratio
   - Total Risk-Based Capital Ratio
   - Noncurrent Loans to Loans (NPL ratio)
   - Allowance to Loans (ALLL ratio)

Return the data as a JSON object with this exact structure:
{
  "quarters": [
    {
      "quarter": "Q4 2024",
      "date": "12/31/2024",
      "roaa": 1.05,
      "roae": 10.5,
      "nim": 3.25,
      "efficiencyRatio": 62.5,
      "costOfFunds": 2.1,
      "loanToDeposit": 78.5,
      "tier1Capital": 11.2,
      "totalCapital": 13.5,
      "nplRatio": 0.45,
      "allowanceRatio": 1.15
    }
  ]
}

Make sure all values are numbers (not strings). Include as many quarters as are visible in the report (up to 8).`,
        browser_profile: 'lite',
      }),
    });

    if (!tinyFishResponse.ok) {
      const errorText = await tinyFishResponse.text();
      console.error('TinyFish error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `TinyFish API error: ${tinyFishResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tinyFishResult = await tinyFishResponse.json();
    console.log('TinyFish result status:', tinyFishResult.status);

    // Extract the result data
    let resultData = tinyFishResult.result;
    if (typeof resultData === 'string') {
      const jsonStart = resultData.indexOf('{');
      const jsonEnd = resultData.lastIndexOf('}') + 1;
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        try {
          resultData = JSON.parse(resultData.substring(jsonStart, jsonEnd));
        } catch (e) {
          console.error('Failed to parse TinyFish result as JSON:', e);
        }
      }
    }

    // Cache the result
    if (resultData?.quarters?.length > 0) {
      const reportDate = resultData.quarters[0]?.date || new Date().toISOString().split('T')[0];
      const { error: upsertError } = await supabase
        .from('ubpr_cache')
        .upsert({
          rssd,
          bank_name: bankName,
          report_date: reportDate,
          metrics: resultData,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'rssd,report_date' });

      if (upsertError) {
        console.error('Cache write error:', upsertError);
      } else {
        console.log(`Cached UBPR data for RSSD ${rssd}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: resultData, source: 'live', bankName, rssd }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching UBPR:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
