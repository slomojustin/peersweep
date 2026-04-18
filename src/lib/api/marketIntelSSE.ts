import { supabase } from '@/integrations/supabase/client';
import type { MarketIntelData } from './marketIntel';

export interface AgentSSECallbacks {
  onStreamingUrl: (bankIndex: number, url: string) => void;
  onResult: (bankIndex: number, data: MarketIntelData) => void;
  onError: (bankIndex: number, message: string) => void;
  onAllComplete: () => void;
}

export function openAgentSSEConnections(
  runIds: string[],
  callbacks: AgentSSECallbacks,
  signal?: AbortSignal,
): () => void {
  if (runIds.length === 0) {
    callbacks.onAllComplete();
    return () => {};
  }

  // @ts-expect-error - not in public types but always present
  const supabaseUrl: string = supabase.supabaseUrl;
  // @ts-expect-error - not in public types but always present
  const anonKey: string = supabase.supabaseKey;

  const pending = new Set<number>(runIds.map((_, i) => i));
  const controllers = runIds.map(() => new AbortController());

  function markDone(index: number) {
    pending.delete(index);
    if (pending.size === 0) {
      callbacks.onAllComplete();
    }
  }

  runIds.forEach((runId, index) => {
    const ac = controllers[index];

    signal?.addEventListener('abort', () => ac.abort(), { once: true });

    const url = `${supabaseUrl}/functions/v1/stream-market-intel?runId=${encodeURIComponent(runId)}&apikey=${encodeURIComponent(anonKey)}`;

    (async () => {
      let response: Response;
      try {
        response = await fetch(url, { signal: ac.signal });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.warn(`[marketIntelSSE] runId=${runId} index=${index} fetch error:`, err);
        markDone(index);
        return;
      }

      if (!response.body) {
        console.warn(`[marketIntelSSE] runId=${runId} index=${index} response body is null`);
        markDone(index);
        return;
      }

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = '';
      let currentEvent = '';
      let terminal = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith(':')) {
              // SSE comment (heartbeat) — skip
              continue;
            } else if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();

              if (currentEvent === 'STREAMING_URL') {
                callbacks.onStreamingUrl(index, dataStr);
                currentEvent = '';
              } else if (currentEvent === 'RESULT') {
                const cleaned = dataStr.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '');
                let parsed: MarketIntelData;
                try {
                  parsed = JSON.parse(cleaned) as MarketIntelData;
                } catch {
                  parsed = {} as MarketIntelData;
                }
                callbacks.onResult(index, parsed);
                terminal = true;
                currentEvent = '';
                break;
              } else if (currentEvent === 'ERROR') {
                callbacks.onError(index, dataStr);
                terminal = true;
                currentEvent = '';
                break;
              } else {
                currentEvent = '';
              }
            } else if (line === '') {
              currentEvent = '';
            }
          }

          if (terminal) break;
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.warn(`[marketIntelSSE] runId=${runId} index=${index} stream error:`, err);
      } finally {
        markDone(index);
      }
    })();
  });

  return () => {
    for (const ac of controllers) {
      ac.abort();
    }
  };
}
