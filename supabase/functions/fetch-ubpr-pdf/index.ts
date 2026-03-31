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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we already have this PDF in storage
    const storagePath = `${rssd}/ubpr-latest.pdf`;
    const { data: existingFile } = await supabase.storage
      .from('ubpr-reports')
      .list(rssd, { limit: 1, search: 'ubpr-latest.pdf' });

    if (existingFile && existingFile.length > 0) {
      const { data: urlData } = supabase.storage
        .from('ubpr-reports')
        .getPublicUrl(storagePath);

      console.log(`PDF already cached for RSSD ${rssd}`);
      return new Response(
        JSON.stringify({ success: true, pdfUrl: urlData.publicUrl, source: 'cache' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`No cached PDF for RSSD ${rssd}, fetching from FFIEC CDR via TinyFish...`);

    const apiKey = Deno.env.get('TINYFISH_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'TinyFish API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use TinyFish to navigate the FFIEC CDR and download the UBPR PDF
    const tinyFishResponse = await fetch('https://agent.tinyfish.ai/v1/automation/run', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://cdr.ffiec.gov/public/ManageFacsimiles.aspx',
        goal: `On this FFIEC CDR page, I need to download the UBPR (Uniform Bank Performance Report) PDF for a specific bank:

1. In the "Financial Institution" field or search box, enter the RSSD ID: ${rssd}
2. If there's a search button, click it to find the institution "${bankName}"
3. Select "UBPR" as the report type
4. Select the most recent report date available
5. Click the button to generate/view the PDF report
6. Download the PDF file

Return the download URL of the PDF file. If a PDF was downloaded or displayed, return the URL where the PDF can be accessed. Format as JSON: {"pdfUrl": "https://..."}`,
        browser_profile: 'lite',
        download: true,
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
    console.log('TinyFish result:', JSON.stringify(tinyFishResult).substring(0, 500));

    // Try to get the PDF URL from TinyFish result
    let pdfSourceUrl: string | null = null;
    
    // Check if TinyFish returned a download URL
    if (tinyFishResult.downloads && tinyFishResult.downloads.length > 0) {
      pdfSourceUrl = tinyFishResult.downloads[0].url || tinyFishResult.downloads[0];
    }
    
    // Check result field
    if (!pdfSourceUrl && tinyFishResult.result) {
      let resultData = tinyFishResult.result;
      if (typeof resultData === 'string') {
        const jsonStart = resultData.indexOf('{');
        const jsonEnd = resultData.lastIndexOf('}') + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          try {
            const parsed = JSON.parse(resultData.substring(jsonStart, jsonEnd));
            pdfSourceUrl = parsed.pdfUrl || parsed.url || parsed.downloadUrl;
          } catch (e) {
            // Check if the result itself is a URL
            if (resultData.includes('http') && resultData.includes('.pdf')) {
              const urlMatch = resultData.match(/https?:\/\/[^\s"']+\.pdf[^\s"']*/);
              if (urlMatch) pdfSourceUrl = urlMatch[0];
            }
          }
        }
      } else if (resultData.pdfUrl) {
        pdfSourceUrl = resultData.pdfUrl;
      }
    }

    if (!pdfSourceUrl) {
      // If TinyFish couldn't get the PDF, construct the FFIEC CDR direct URL
      // The FFIEC CDR has a pattern for UBPR reports
      console.log('Could not extract PDF URL from TinyFish, returning FFIEC CDR link');
      const ffiecUrl = `https://cdr.ffiec.gov/public/ManageFacsimiles.aspx`;
      return new Response(
        JSON.stringify({ 
          success: true, 
          pdfUrl: null, 
          ffiecUrl,
          message: 'Could not automatically download PDF. Use the FFIEC CDR link to access the report.',
          source: 'fallback' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download the PDF and store it in Supabase Storage
    try {
      const pdfResponse = await fetch(pdfSourceUrl);
      if (pdfResponse.ok) {
        const pdfBuffer = await pdfResponse.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from('ubpr-reports')
          .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
        } else {
          console.log(`PDF stored for RSSD ${rssd}`);
          const { data: urlData } = supabase.storage
            .from('ubpr-reports')
            .getPublicUrl(storagePath);

          return new Response(
            JSON.stringify({ success: true, pdfUrl: urlData.publicUrl, source: 'live' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (downloadErr) {
      console.error('Failed to download/store PDF:', downloadErr);
    }

    // If storage failed, return the source URL directly
    return new Response(
      JSON.stringify({ success: true, pdfUrl: pdfSourceUrl, source: 'live' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching UBPR PDF:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
