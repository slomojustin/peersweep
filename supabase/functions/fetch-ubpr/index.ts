const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const apiKey = Deno.env.get('TINYFISH_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching UBPR for RSSD: ${rssd} (${bankName})`);

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
      // Try to parse JSON from the string
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

    return new Response(
      JSON.stringify({ success: true, data: resultData, bankName, rssd }),
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
