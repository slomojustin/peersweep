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
      if (rssd && date) {
        contextMap.set(id, { rssd, date });
      }
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
      banks.set(key, {
        rssd: ctxInfo.rssd,
        reportDate: ctxInfo.date,
        metrics: {},
        sourceConcepts: {},
      });
    }

    const bank = banks.get(key)!;
    const conceptName = tagName.includes(':') ? tagName.split(':')[1] : tagName;
    if (!conceptName) continue;
    if (['schemaRef', 'context', 'unit'].some(skip => tagName.includes(skip))) continue;

    const unitRef = el.getAttribute('unitRef') || '';
    let parsedValue: number | string = value;
    if (unitRef === 'USD' || unitRef === 'PURE') {
      const num = parseFloat(value);
      if (!isNaN(num)) parsedValue = num;
    }

    if (conceptName.startsWith('UBPR')) {
      bank.metrics[conceptName] = parsedValue;
    } else if (conceptName.startsWith('RCON') || conceptName.startsWith('RIAD')) {
      bank.sourceConcepts[conceptName] = parsedValue;
    }
  }

  return Array.from(banks.values());
}

function parseTabDelimited(content: string): ParsedBank[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map(h => h.trim());
  const rssdIdx = headers.findIndex(h => /rssd|idrssd|id_rssd/i.test(h));
  const dateIdx = headers.findIndex(h => /date|repdte|report.*date/i.test(h));

  if (rssdIdx === -1) {
    console.error('Could not find RSSD column. Headers:', headers.slice(0, 20));
    return [];
  }

  const banks: Map<string, ParsedBank> = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const rssd = cols[rssdIdx]?.trim();
    if (!rssd) continue;

    const reportDate = dateIdx >= 0 ? cols[dateIdx]?.trim() || 'unknown' : 'unknown';
    const key = `${rssd}_${reportDate}`;

    if (!banks.has(key)) {
      banks.set(key, { rssd, reportDate, metrics: {}, sourceConcepts: {} });
    }

    const bank = banks.get(key)!;
    for (let j = 0; j < headers.length; j++) {
      if (j === rssdIdx || j === dateIdx) continue;
      const header = headers[j];
      const val = cols[j]?.trim();
      if (!header || !val || val === '') continue;

      const num = parseFloat(val);
      const parsedVal = isNaN(num) ? val : num;

      if (header.startsWith('UBPR')) {
        bank.metrics[header] = parsedVal;
      } else if (header.startsWith('RCON') || header.startsWith('RIAD')) {
        bank.sourceConcepts[header] = parsedVal;
      } else {
        bank.metrics[header] = parsedVal;
      }
    }
  }

  return Array.from(banks.values());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { downloadUrl, storagePath, jobId } = await req.json();

    if (!downloadUrl && !storagePath) {
      return new Response(
        JSON.stringify({ success: false, error: 'downloadUrl or storagePath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let content: string;

    if (storagePath) {
      console.log(`Reading from storage: ${storagePath}`);
      const { data: fileData, error: dlError } = await supabase.storage
        .from('ubpr-reports')
        .download(storagePath);

      if (dlError || !fileData) {
        throw new Error(`Failed to download from storage: ${dlError?.message || 'no data'}`);
      }
      content = await fileData.text();
    } else {
      console.log(`Downloading from URL: ${downloadUrl}`);
      const downloadResponse = await fetch(downloadUrl);
      if (!downloadResponse.ok) {
        throw new Error(`Failed to download: ${downloadResponse.status}`);
      }
      content = await downloadResponse.text();
    }

    console.log(`Content length: ${content.length} chars`);

    let allBanks: ParsedBank[] = [];

    if (content.includes('<?xml') || content.includes('<xbrl')) {
      console.log('Detected XBRL format');
      allBanks = parseXBRL(content);
    } else if (content.includes('\t')) {
      console.log('Detected tab-delimited format');
      allBanks = parseTabDelimited(content);
    } else {
      console.log('Content format not recognized. First 500 chars:', content.substring(0, 500));
      throw new Error('File format not recognized. Expected XBRL or tab-delimited.');
    }

    console.log(`Parsed ${allBanks.length} bank-period records`);

    let inserted = 0;
    let errors = 0;
    const batchSize = 50;

    for (let i = 0; i < allBanks.length; i += batchSize) {
      const batch = allBanks.slice(i, i + batchSize).map((b) => ({
        rssd: b.rssd,
        report_date: b.reportDate,
        metrics: b.metrics,
        source_concepts: b.sourceConcepts,
      }));

      const { error } = await supabase.from('ubpr_data').upsert(batch, {
        onConflict: 'rssd,report_date',
      });

      if (error) {
        console.error(`Batch upsert error at offset ${i}:`, error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    console.log(`Bulk import complete: ${inserted} records inserted, ${errors} errors`);

    if (jobId) {
      await supabase
        .from('ffiec_report_jobs')
        .update({
          status: errors === 0 ? 'completed' : 'completed',
          completed_at: new Date().toISOString(),
          result_metrics: { totalRecords: allBanks.length, inserted, errors },
        })
        .eq('id', jobId);
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
