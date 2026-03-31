import { supabase } from '@/integrations/supabase/client';

export interface FFIECJobStatusResponse {
  success: boolean;
  jobId?: string;
  reportType?: 'ubpr_metrics' | 'ubpr_pdf';
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  source?: 'cache' | 'live' | 'fallback';
  data?: {
    quarters: Array<Record<string, unknown>>;
  };
  pdfUrl?: string | null;
  ffiecUrl?: string;
  message?: string;
  error?: string;
  streamingUrl?: string | null;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const pollFFIECJob = async (jobId: string): Promise<FFIECJobStatusResponse> => {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.functions.invoke<FFIECJobStatusResponse>('ffiec-job-status', {
      body: { jobId },
    });

    if (error) {
      throw new Error(`Failed to check FFIEC job status: ${error.message}`);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to check FFIEC job status');
    }

    if (data.status === 'completed' || data.status === 'failed') {
      return data;
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error('FFIEC retrieval is taking longer than expected. Please try again.');
};
