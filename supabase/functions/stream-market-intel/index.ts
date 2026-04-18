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
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            if (currentEvent === 'STREAMING_URL' || currentEvent === 'RESULT' || currentEvent === 'ERROR') {
              const chunk = `event: ${currentEvent}\ndata:${line.slice(5)}\n\n`;
              await writer.write(encoder.encode(chunk));

              if (currentEvent === 'RESULT' || currentEvent === 'ERROR') {
                clearInterval(heartbeat);
                await writer.close();
                return;
              }
            }
            // Reset after dispatch so bare data: lines without a named event are ignored
            currentEvent = '';
          } else if (line === '') {
            // Blank line boundary — reset current event accumulator
            currentEvent = '';
          }
        }
      }

      clearInterval(heartbeat);
      await writer.close();
    } catch (err) {
      clearInterval(heartbeat);
      if (err instanceof Error && err.name === 'AbortError') {
        // Client disconnected — expected, not an error
        return;
      }
      console.error(`[stream-market-intel] runId=${runId} stream error:`, err);
      try {
        await writer.abort(err);
      } catch {
        // writer may already be closed
      }
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
