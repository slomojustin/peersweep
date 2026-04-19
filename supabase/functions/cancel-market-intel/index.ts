const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { runIds } = await req.json();

    if (!Array.isArray(runIds) || runIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'runIds must be a non-empty array' }),
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

    const results = await Promise.allSettled(
      runIds.map(async (runId: string) => {
        const resp = await fetch(`https://agent.tinyfish.ai/v1/runs/${runId}/cancel`, {
          method: 'POST',
          headers: { 'X-API-Key': apiKey },
        });
        if (!resp.ok) {
          console.error(`Failed to cancel TinyFish run ${runId}: HTTP ${resp.status}`);
          throw new Error(`HTTP ${resp.status}`);
        }
        return runId;
      }),
    );

    const cancelled = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({ success: true, cancelled, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in cancel-market-intel:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
