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
    const { records } = await req.json();

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'records array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (records.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Maximum 100 records per batch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const rows = records.map((r: any) => ({
      rssd: String(r.rssd),
      report_date: String(r.report_date),
      bank_name: r.bank_name || null,
      metrics: r.metrics || {},
      source_concepts: r.source_concepts || {},
    }));

    const { error } = await supabase
      .from('ubpr_data')
      .upsert(rows, { onConflict: 'rssd,report_date' });

    if (error) {
      console.error('Upsert error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message, inserted: 0, errors: rows.length }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, inserted: rows.length, errors: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in insert-ubpr-batch:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
