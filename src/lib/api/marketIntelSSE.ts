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
      // Accumulate per-event state; dispatch on blank line (proper SSE spec)
      let currentEvent = '';
      let currentDataLines: string[] = [];
      let terminal = false;

      const dispatch = (): boolean => {
        if (!currentEvent || currentDataLines.length === 0) return false;
        const dataStr = currentDataLines.join('\n');

        if (currentEvent === 'STREAMING_URL') {
          callbacks.onStreamingUrl(index, dataStr.trim());
        } else if (currentEvent === 'RESULT') {
          const cleaned = dataStr.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
          let parsed: MarketIntelData;
          try {
            parsed = JSON.parse(cleaned) as MarketIntelData;
          } catch {
            parsed = {} as MarketIntelData;
          }
          callbacks.onResult(index, parsed);
          return true; // terminal
        } else if (currentEvent === 'ERROR') {
          callbacks.onError(index, dataStr.trim());
          return true; // terminal
        }
        return false;
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, '');

            if (line.startsWith(':')) {
              // SSE comment (heartbeat) — skip
            } else if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              currentDataLines.push(line.slice(5).trimStart());
            } else if (line.trim() === '') {
              // Blank line = end of event block — dispatch
              terminal = dispatch();
              currentEvent = '';
              currentDataLines = [];
              if (terminal) break;
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
