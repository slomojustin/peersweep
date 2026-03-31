import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedBank {
  rssd: string;
  reportDate: string;
  metrics: Record<string, number | string>;
  sourceConcepts: Record<string, number | string>;
}

function parseXBRL(xmlContent: string): ParsedBank[] {
  const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
  if (!doc) return [];

  const banks: Map<string, ParsedBank> = new Map();
  const contexts = doc.querySelectorAll('context');
  const contextMap: Map<string, { rssd: string; date: string }> = new Map();

  for (const ctx of contexts) {
    const id = ctx.getAttribute('id') || '';
    const identifier = ctx.querySelector('identifier');
    const instant = ctx.querySelector('instant');
    const endDate = ctx.querySelector('endDate');
    if (identifier) {
      const rssd = identifier.textContent?.trim() || '';
      const date = instant?.textContent?.trim() || endDate?.textContent?.trim() || '';
      if (rssd && date) contextMap.set(id, { rssd, date });
    }
  }

  const allElements = doc.documentElement?.children || [];
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const tagName = el.tagName || '';
    const contextRef = el.getAttribute('contextRef') || '';
    const value = el.textContent?.trim() || '';
    if (!contextRef || !value) continue;
    const ctxInfo = contextMap.get(contextRef);
    if (!ctxInfo) continue;

    const key = `${ctxInfo.rssd}_${ctxInfo.date}`;
    if (!banks.has(key)) {
      banks.set(key, { rssd: ctxInfo.rssd, reportDate: ctxInfo.date, metrics: {}, sourceConcepts: {} });
    }

    const bank = banks.get(key)!;
    const conceptName = tagName.includes(':') ? tagName.split(':')[1] : tagName;
    if (!conceptName || ['schemaRef', 'context', 'unit'].some(s => tagName.includes(s))) continue;

    const unitRef = el.getAttribute('unitRef') || '';
    let parsedValue: number | string = value;
    if (unitRef === 'USD' || unitRef === 'PURE') {
      const num = parseFloat(value);
      if (!isNaN(num)) parsedValue = num;
    }

    if (conceptName.startsWith('UBPR')) bank.metrics[conceptName] = parsedValue;
    else if (conceptName.startsWith('RCON') || conceptName.startsWith('RIAD')) bank.sourceConcepts[conceptName] = parsedValue;
  }

  return Array.from(banks.values());
}

function parseTabDelimited(content: string): ParsedBank[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map(h => h.trim());
  const rssdIdx = headers.findIndex(h => /rssd|idrssd|id_rssd/i.test(h));
  const dateIdx = headers.findIndex(h => /date|repdte|report.*date/i.test(h));
  if (rssdIdx === -1) return [];

  const banks: Map<string, ParsedBank> = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const rssd = cols[rssdIdx]?.trim();
    if (!rssd) continue;
    const reportDate = dateIdx >= 0 ? cols[dateIdx]?.trim() || 'unknown' : 'unknown';
    const key = `${rssd}_${reportDate}`;
    if (!banks.has(key)) banks.set(key, { rssd, reportDate, metrics: {}, sourceConcepts: {} });

    const bank = banks.get(key)!;
    for (let j = 0; j < headers.length; j++) {
      if (j === rssdIdx || j === dateIdx) continue;
      const header = headers[j];
      const val = cols[j]?.trim();
      if (!header || !val) continue;
      const num = parseFloat(val);
      const parsedVal = isNaN(num) ? val : num;
      if (header.startsWith('UBPR')) bank.metrics[header] = parsedVal;
      else if (header.startsWith('RCON') || header.startsWith('RIAD')) bank.sourceConcepts[header] = parsedVal;
      else bank.metrics[header] = parsedVal;
    }
  }
  return Array.from(banks.values());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { storagePath, downloadUrl, jobId, action } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ACTION: enqueue - just create a job and return immediately
    if (action === 'enqueue') {
      const { data: job, error: jobError } = await supabase
        .from('ffiec_report_jobs')
        .insert({
          rssd: 'BULK',
          bank_name: body.fileName || 'Bulk XBRL Upload',
          report_type: 'ubpr_bulk',
          status: 'pending',
          source: 'upload',
          error_message: storagePath, // store the path for later processing
        })
        .select('id')
        .single();

      if (jobError || !job) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create job', details: jobError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, jobId: job.id, status: 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ACTION: process-chunk - process a batch from a pending/processing job
    if (action === 'process-chunk') {
      if (!jobId) {
        return new Response(
          JSON.stringify({ success: false, error: 'jobId is required for process-chunk' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: job } = await supabase
        .from('ffiec_report_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!job) {
        return new Response(
          JSON.stringify({ success: false, error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const filePath = job.error_message; // we stored storagePath here
      const progress = (job.result_metrics as any) || { totalRecords: 0, inserted: 0, errors: 0, offset: 0, parsed: false };

      // If not yet parsed, parse the file and store record count
      if (!progress.parsed) {
        await supabase
          .from('ffiec_report_jobs')
          .update({ status: 'processing' })
          .eq('id', jobId);

        console.log(`Reading file from storage: ${filePath}`);
        const { data: fileData, error: dlError } = await supabase.storage
          .from('ubpr-reports')
          .download(filePath);

        if (dlError || !fileData) {
          await supabase.from('ffiec_report_jobs').update({
            status: 'failed',
            error_message: `Storage read failed: ${dlError?.message}`,
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);

          return new Response(
            JSON.stringify({ success: false, error: `Storage read failed: ${dlError?.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        const content = await fileData.text();
        console.log(`File content: ${content.length} chars`);

        let allBanks: ParsedBank[] = [];
        if (content.includes('<?xml') || content.includes('<xbrl')) {
          allBanks = parseXBRL(content);
        } else if (content.includes('\t')) {
          allBanks = parseTabDelimited(content);
        } else {
          await supabase.from('ffiec_report_jobs').update({
            status: 'failed',
            error_message: 'Unrecognized file format',
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);

          return new Response(
            JSON.stringify({ success: false, error: 'Unrecognized file format' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        console.log(`Parsed ${allBanks.length} bank records`);

        // Store parsed data in storage as JSON for chunked processing
        const jsonPath = `bulk-uploads/${jobId}-parsed.json`;
        const jsonBlob = new Blob([JSON.stringify(allBanks)], { type: 'application/json' });
        await supabase.storage.from('ubpr-reports').upload(jsonPath, jsonBlob, {
          contentType: 'application/json',
          upsert: true,
        });

        const newProgress = { totalRecords: allBanks.length, inserted: 0, errors: 0, offset: 0, parsed: true, jsonPath };
        await supabase.from('ffiec_report_jobs').update({
          result_metrics: newProgress,
          error_message: filePath, // keep original path
        }).eq('id', jobId);

        return new Response(
          JSON.stringify({ success: true, status: 'processing', progress: newProgress }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Already parsed - insert next chunk
      const CHUNK_SIZE = 200;
      const { jsonPath, offset = 0, totalRecords = 0, inserted = 0, errors: prevErrors = 0 } = progress;

      if (offset >= totalRecords) {
        // All done
        await supabase.from('ffiec_report_jobs').update({
          status: 'completed',
          error_message: null,
          completed_at: new Date().toISOString(),
          result_metrics: { totalRecords, inserted, errors: prevErrors, parsed: true },
        }).eq('id', jobId);

        return new Response(
          JSON.stringify({ success: true, status: 'completed', totalRecords, inserted, errors: prevErrors }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Read parsed JSON from storage
      const { data: jsonData } = await supabase.storage.from('ubpr-reports').download(jsonPath);
      if (!jsonData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Parsed data not found in storage' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const allBanks: ParsedBank[] = JSON.parse(await jsonData.text());
      const chunk = allBanks.slice(offset, offset + CHUNK_SIZE);

      let chunkInserted = 0;
      let chunkErrors = 0;
      const batchSize = 50;

      for (let i = 0; i < chunk.length; i += batchSize) {
        const batch = chunk.slice(i, i + batchSize).map(b => ({
          rssd: b.rssd,
          report_date: b.reportDate,
          metrics: b.metrics,
          source_concepts: b.sourceConcepts,
        }));

        const { error } = await supabase.from('ubpr_data').upsert(batch, { onConflict: 'rssd,report_date' });
        if (error) {
          console.error(`Batch error at offset ${offset + i}:`, error);
          chunkErrors += batch.length;
        } else {
          chunkInserted += batch.length;
        }
      }

      const newProgress2 = {
        totalRecords,
        inserted: inserted + chunkInserted,
        errors: prevErrors + chunkErrors,
        offset: offset + CHUNK_SIZE,
        parsed: true,
        jsonPath,
      };

      const isDone = newProgress2.offset >= totalRecords;
      await supabase.from('ffiec_report_jobs').update({
        status: isDone ? 'completed' : 'processing',
        error_message: isDone ? null : filePath,
        completed_at: isDone ? new Date().toISOString() : null,
        result_metrics: newProgress2,
      }).eq('id', jobId);

      return new Response(
        JSON.stringify({
          success: true,
          status: isDone ? 'completed' : 'processing',
          progress: newProgress2,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Legacy: direct processing (for backward compat with downloadUrl)
    if (!downloadUrl && !storagePath) {
      return new Response(
        JSON.stringify({ success: false, error: 'downloadUrl, storagePath, or action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let content: string;
    if (storagePath) {
      const { data: fileData, error: dlError } = await supabase.storage.from('ubpr-reports').download(storagePath);
      if (dlError || !fileData) throw new Error(`Storage read failed: ${dlError?.message}`);
      content = await fileData.text();
    } else {
      const resp = await fetch(downloadUrl);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      content = await resp.text();
    }

    let allBanks: ParsedBank[] = [];
    if (content.includes('<?xml') || content.includes('<xbrl')) allBanks = parseXBRL(content);
    else if (content.includes('\t')) allBanks = parseTabDelimited(content);
    else throw new Error('Unrecognized file format');

    let inserted = 0;
    let errors = 0;
    for (let i = 0; i < allBanks.length; i += 50) {
      const batch = allBanks.slice(i, i + 50).map(b => ({
        rssd: b.rssd, report_date: b.reportDate, metrics: b.metrics, source_concepts: b.sourceConcepts,
      }));
      const { error } = await supabase.from('ubpr_data').upsert(batch, { onConflict: 'rssd,report_date' });
      if (error) errors += batch.length; else inserted += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, totalRecords: allBanks.length, inserted, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error processing bulk UBPR:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
