import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubjectBankInfo {
  name: string;
  rssd: string;
  city?: string;
  state?: string;
}

interface PeerBankInfo {
  name: string;
  city?: string;
  state?: string;
}

/**
 * Prompt for one peer bank: website deposit rates + social media presence.
 * Designed to run as a standalone TinyFish task per peer (prep for parallel agents).
 */
function buildPeerBankIntelGoal(subjectBank: SubjectBankInfo, peerBank: PeerBankInfo): string {
  const location = [peerBank.city, peerBank.state].filter(Boolean).join(', ');
  return `Research "${peerBank.name}"${location ? ` (${location})` : ''} as a competitor to ${subjectBank.name}.

1. Visit ${peerBank.name}'s official website and find their currently advertised deposit rates (savings, money market, CDs of all terms). Look for a "rates" or "personal banking" section.

2. Find ${peerBank.name}'s social media presence:
   - LinkedIn: search "site:linkedin.com/company ${peerBank.name}" — note follower count and recent rate/promotion posts
   - Facebook: search "site:facebook.com ${peerBank.name}" — note promoted rates or community engagement
   - Instagram: search "site:instagram.com ${peerBank.name}" — note any marketing campaigns or promotions

Return JSON with this exact structure:
{
  "peerBankRates": [
    { "bankName": "${peerBank.name}", "product": "12-Month CD", "rate": 4.50, "source": "bankwebsite.com" }
  ],
  "socialMedia": [
    { "bankName": "${peerBank.name}", "platform": "LinkedIn", "profileUrl": "https://...", "followers": 5000, "recentPromo": "...", "lastPostDate": "2026-03-25" }
  ]
}
All rate values must be numbers (not strings). Use null for any field not found.`;
}

/**
 * Prompt for local banking news in the subject bank's market.
 * Designed to run as a standalone TinyFish task (prep for parallel agents).
 */
function buildLocalNewsGoal(subjectBank: SubjectBankInfo): string {
  const location = [subjectBank.city, subjectBank.state].filter(Boolean).join(', ');
  const cityRef = subjectBank.city ?? 'local';
  return `Search for recent banking news relevant to "${subjectBank.name}" (RSSD: ${subjectBank.rssd})${location ? ` in ${location}` : ''}.

Search Google News and local sources for:
- Banking, deposit rates, branch openings, and financial services news${location ? ` in the ${location} market area` : ''}
- Articles mentioning ${subjectBank.name} or its local competitors
- Rate changes, new branches, or banking promotions in the area
- Local publications (e.g. "${cityRef} business journal", "${cityRef} times", regional news outlets)

Extract up to 10 relevant articles.

Return JSON with this exact structure:
{
  "localNews": [
    {
      "headline": "Article title",
      "source": "Local Newspaper Name",
      "url": "https://...",
      "date": "2026-03-28",
      "summary": "Brief 1-2 sentence summary of the article's relevance to local banking"
    }
  ]
}
If no articles are found, return { "localNews": [] }.`;
}

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

    const subjectBankInfo: SubjectBankInfo = { name: bankName, rssd, city, state };

    const peerBankDetails: PeerBankInfo[] = (peerBanks || []).map(
      (p: { name: string; city?: string; state?: string }) => ({ name: p.name, city: p.city, state: p.state }),
    );

    // One request descriptor per task: 1 news + up to 5 peer-bank runs
    interface RunRequest { label: string; goal: string; }
    const runRequests: RunRequest[] = [
      { label: 'news', goal: buildLocalNewsGoal(subjectBankInfo) },
      ...peerBankDetails.map(p => ({ label: `peer:${p.name}`, goal: buildPeerBankIntelGoal(subjectBankInfo, p) })),
    ];

    console.log(`Starting ${runRequests.length} parallel TinyFish runs for ${bankName}...`);

    // Fire all runs concurrently
    const runResults = await Promise.all(
      runRequests.map(async ({ label, goal }) => {
        const resp = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
          method: 'POST',
          headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://www.google.com', goal, browser_profile: 'lite' }),
        });
        if (!resp.ok) {
          const text = await resp.text();
          console.error(`TinyFish error for ${label} (HTTP ${resp.status}):`, text.slice(0, 300));
          return { label, runId: null as string | null };
        }
        const data = await resp.json();
        const runId: string | null = data?.run_id ?? null;
        if (!runId) console.error(`No run_id from TinyFish for ${label}:`, data);
        return { label, runId };
      }),
    );

    const newsRunId = runResults.find(r => r.label === 'news')?.runId ?? null;
    const peerRunIds = runResults
      .filter(r => r.label.startsWith('peer:') && r.runId)
      .map(r => r.runId as string);

    if (!newsRunId && peerRunIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'All TinyFish runs failed to start' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Store peer RSSDs list so cache can be matched later
    const peerRssdList = ((peerBanks || []) as { rssd?: string }[])
      .map(p => p.rssd)
      .filter(Boolean)
      .sort();

    const { data: job, error: jobError } = await supabase
      .from('ffiec_report_jobs')
      .insert({
        rssd,
        bank_name: bankName,
        report_type: 'market_intel',
        status: 'processing',
        source: 'live',
        // tinyfish_run_id holds the news run as a fallback so the existing poller guard doesn't fire.
        // TODO: update ffiec-job-status to read _runIds from result_metrics and poll all 6 runs in parallel.
        tinyfish_run_id: newsRunId,
        result_metrics: {
          _peerRssds: peerRssdList,
          _runIds: { news: newsRunId, peers: peerRunIds },
        },
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

    console.log(`Started ${runRequests.length} market intel runs for ${bankName}, job ${job.id}`, { newsRunId, peerRunIds });

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
