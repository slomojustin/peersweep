import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseMarketIntelResult(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  // Strip internal metadata before returning
  const cleaned = { ...obj };
  delete (cleaned as Record<string, unknown>)._peerRssds;
  if (cleaned.peerBankRates || cleaned.localNews || cleaned.socialMedia) return cleaned;
  if (typeof cleaned.result === 'string') {
    const stripped = (cleaned.result as string).replace(/^```json\s*/i, '').replace(/\s*```\s*$/,'');
    try { return JSON.parse(stripped); } catch { return cleaned; }
  }
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bankName, rssd, state, city, peerBanks } = await req.json();

    // Build a deterministic peer key for cache matching
    const peerRssds = ((peerBanks || []) as { rssd?: string }[])
      .map(p => p.rssd)
      .filter(Boolean)
      .sort()
      .join(',');

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
      // Compare stored peer RSSDs with current request
      const metrics = existingJob.result_metrics as Record<string, unknown>;
      const cachedPeers = Array.isArray(metrics._peerRssds)
        ? (metrics._peerRssds as string[]).sort().join(',')
        : '';
      
      if (cachedPeers === peerRssds) {
        console.log(`Market intel cache hit for ${bankName}`);
        const parsed = parseMarketIntelResult(existingJob.result_metrics);
        return new Response(
          JSON.stringify({ success: true, source: 'cache', status: 'completed', data: parsed }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } else {
        console.log(`Market intel cache miss: peer set changed for ${bankName}`);
      }
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
    const peerBankDetails = (peerBanks || []).map((p: { name: string; city?: string; state?: string }) => ({
      name: p.name,
      location: [p.city, p.state].filter(Boolean).join(', '),
    }));
    const peerNamesList = peerBankDetails.map(p => p.name).join(', ');
    const peerDetailsForPrompt = peerBankDetails
      .map(p => `  - ${p.name}${p.location ? ` (${p.location})` : ''}`)
      .join('\n');
    const location = [city, state].filter(Boolean).join(', ');

    const goal = `I need comprehensive market intelligence for "${bankName}" (RSSD: ${rssd}) located in ${location || 'the United States'}.

TASK 1 — Peer Bank Website Rates:
${peerNamesList ? `Visit the official websites of these peer banks and extract their currently advertised deposit rates (savings, money market, CDs of all terms). For each bank, go to their website and look for a "rates" or "personal banking" page:
${peerDetailsForPrompt}` : 'Skip this task — no peer banks were selected.'}

TASK 2 — Local News & Market Coverage:
${location ? `Search Google News for recent articles about banking, deposit rates, branch openings, and financial services in the ${location} market area. Look for:
- Local newspaper articles (e.g. "${city} business journal", "${city} times", local news outlets)
- Articles mentioning ${bankName} or its competitors
- Any news about rate changes, new branches, or banking promotions in the area
Extract up to 10 relevant articles.` : 'Skip — no location provided.'}

TASK 3 — Social Media & Marketing:
${peerNamesList ? `Search for the social media presence and recent marketing of these banks:
${peerDetailsForPrompt}
For each bank, check:
- LinkedIn company page (search "site:linkedin.com/company [bank name]") — note follower count, recent posts about rates or promotions
- Facebook page (search "site:facebook.com [bank name]") — note any promoted rates, community engagement
- Instagram (search "site:instagram.com [bank name]") — note marketing campaigns or promotions
Extract any deposit rate promotions, special offers, or marketing campaigns found.` : 'Skip — no peer banks selected.'}

Return ALL results as a single JSON object with this exact structure:
{
  "peerBankRates": [
    {
      "bankName": "Peer Bank Name",
      "product": "12-Month CD",
      "rate": 4.50,
      "source": "bankwebsite.com"
    }
  ],
  "localNews": [
    {
      "headline": "Article title",
      "source": "Local Newspaper Name",
      "url": "https://...",
      "date": "2026-03-28",
      "summary": "Brief 1-2 sentence summary of the article's relevance to local banking"
    }
  ],
  "socialMedia": [
    {
      "bankName": "Peer Bank Name",
      "platform": "LinkedIn",
      "profileUrl": "https://linkedin.com/company/...",
      "followers": 5000,
      "recentPromo": "Currently promoting 5.00% APY 12-month CD special",
      "lastPostDate": "2026-03-25"
    }
  ]
}

All rate values must be numbers (not strings). If a field is not found, use null.`;

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
