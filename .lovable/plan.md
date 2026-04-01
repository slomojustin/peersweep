

## Plan: Fix Market Intel Cache to Include All Peer Banks

### Problem
The market intel cache lookup in the edge function only matches on the subject bank's RSSD. It ignores which peer banks were selected. So if a previous run only included Capital One as a peer, that cached result keeps being returned even when the user now has 3 peer banks selected — the other two peers' data is never fetched.

### Fix

**Update `supabase/functions/fetch-market-intel/index.ts`**:

1. Generate a deterministic cache key from the sorted list of peer bank RSSDs (e.g., a comma-separated string or hash stored in a new column or compared against the stored job metadata).
2. The simplest approach: skip the cache when the peer bank list doesn't match the cached job. To do this without schema changes, store the peer bank RSSDs in the `result_metrics` JSON alongside the data (e.g., `_peerRssds: ["123","456","789"]`), then compare on cache lookup.
3. If the peer set differs from the cached result, bypass the cache and start a new TinyFish run.

**Alternative simpler approach** (recommended): Add the peer RSSDs as a sorted comma-joined string and store it in a dedicated field. Since adding a column requires a migration, the pragmatic path is to embed the peer list inside `result_metrics` when saving the job, and check it on cache retrieval.

### Implementation Details

1. **On job creation** — include peer RSSDs in the job record by adding `_peerRssds` to the metadata or using an existing nullable text field.
2. **On cache lookup** — after finding a cached job, extract the stored peer list and compare against the current request's peer list. If they differ, skip the cache hit and proceed to create a new job.
3. **On `parseMarketIntelResult`** — strip the `_peerRssds` key before returning data to the client so it doesn't pollute the UI.

### Files Changed
- `supabase/functions/fetch-market-intel/index.ts` — store peer RSSDs with job, compare on cache lookup, bypass if mismatched

### Result
When the user selects different peer banks than a previous run, fresh market intel will be fetched for all selected peers instead of returning stale data that only covers one bank.

