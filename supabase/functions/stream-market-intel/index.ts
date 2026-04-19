const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');

  if (!runId) {
    return new Response(
      JSON.stringify({ success: false, error: 'runId query parameter is required' }),
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

  const upstreamResp = await fetch(
    `https://agent.tinyfish.ai/v1/automation/run-sse/${runId}`,
    { headers: { 'X-API-Key': apiKey }, signal: req.signal },
  );

  if (!upstreamResp.ok) {
    return new Response(
      JSON.stringify({ success: false, error: `Upstream SSE error: ${upstreamResp.status}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!upstreamResp.body) {
    return new Response(
      JSON.stringify({ success: false, error: 'Upstream SSE body is null' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  (async () => {
    const heartbeat = setInterval(async () => {
      try {
        await writer.write(encoder.encode(': heartbeat\n\n'));
      } catch {
        clearInterval(heartbeat);
      }
    }, 15_000);

    try {
      const reader = upstreamResp.body!.getReader();
      let buffer = '';
      // Accumulate per-event state; dispatch on blank line (proper SSE spec)
      let currentEvent = '';
      let currentDataLines: string[] = [];

      const dispatch = async (): Promise<boolean> => {
        if (!currentEvent || currentDataLines.length === 0) return false;
        const data = currentDataLines.join('\n');
        if (currentEvent === 'STREAMING_URL' || currentEvent === 'RESULT' || currentEvent === 'ERROR') {
          await writer.write(encoder.encode(`event: ${currentEvent}\ndata: ${data}\n\n`));
          if (currentEvent === 'RESULT' || currentEvent === 'ERROR') {
            clearInterval(heartbeat);
            await writer.close();
            return true; // terminal
          }
        }
        return false;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let terminal = false;
        for (const rawLine of lines) {
          const line = rawLine.replace(/\r$/, ''); // strip \r from \r\n line endings

          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentDataLines.push(line.slice(5).trimStart());
          } else if (line.trim() === '') {
            // Blank line = end of event block — dispatch accumulated event
            terminal = await dispatch();
            currentEvent = '';
            currentDataLines = [];
            if (terminal) break;
          }
          // Ignore comment lines (starting with ':'), id:, retry:, etc.
        }
        if (terminal) break;
      }

      clearInterval(heartbeat);
      try { await writer.close(); } catch { /* already closed */ }
    } catch (err) {
      clearInterval(heartbeat);
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error(`[stream-market-intel] runId=${runId} stream error:`, err);
      try { await writer.abort(err); } catch { /* writer may already be closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
