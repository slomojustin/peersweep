import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const storagePath = `${rssd}/ubpr-latest.pdf`;
    const { data: existingFile } = await supabase.storage
      .from('ubpr-reports')
      .list(rssd, { limit: 1, search: 'ubpr-latest.pdf' });

    if (existingFile && existingFile.length > 0) {
      const { data: urlData } = supabase.storage.from('ubpr-reports').getPublicUrl(storagePath);
      console.log(`PDF already cached for RSSD ${rssd}`);
      return new Response(
        JSON.stringify({ success: true, pdfUrl: urlData.publicUrl, source: 'cache' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('TINYFISH_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`No cached PDF for RSSD ${rssd}, starting async TinyFish PDF run...`);

    const tinyFishResponse = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://cdr.ffiec.gov/public/ManageFacsimiles.aspx',
        goal: `On this FFIEC CDR page, I need to download the UBPR (Uniform Bank Performance Report) PDF for a specific bank:\n\n1. In the "Financial Institution" field or search box, enter the RSSD ID: ${rssd}\n2. If there's a search button, click it to find the institution "${bankName}"\n3. Select "UBPR" as the report type\n4. Select the most recent report date available\n5. Click the button to generate/view the PDF report\n6. Return the final PDF URL or download URL as JSON in this format: {"pdfUrl": "https://..."}\n\nIf you cannot extract a direct PDF URL, return a JSON object describing that the PDF could not be automatically extracted.`,
        browser_profile: 'lite',
      }),
    });

    if (!tinyFishResponse.ok) {
      const errorText = await tinyFishResponse.text();
      console.error('TinyFish async PDF start error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `TinyFish API error: ${tinyFishResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tinyFishResult = await tinyFishResponse.json();
    const runId = tinyFishResult?.run_id;

    if (!runId) {
      console.error('TinyFish async PDF run did not return a run_id:', tinyFishResult);
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
        report_type: 'ubpr_pdf',
        status: 'processing',
        source: 'live',
        tinyfish_run_id: runId,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('PDF job insert error:', jobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create FFIEC PDF job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Started TinyFish async PDF run ${runId} for RSSD ${rssd}`);

    return new Response(
      JSON.stringify({ success: true, source: 'live', status: 'processing', jobId: job.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error fetching UBPR PDF:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
