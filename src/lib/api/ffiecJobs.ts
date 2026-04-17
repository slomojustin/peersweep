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
  // One entry per peer run, null for runs not yet streaming. Index matches peerBanks order.
  streamingUrls?: (string | null)[];
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const pollFFIECJob = async (
  jobId: string,
  onStreamingUrl?: (url: string) => void,
  onStatusUpdate?: (message: string) => void,
  onStreamingUrls?: (urls: (string | null)[]) => void,
): Promise<FFIECJobStatusResponse> => {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    if (attempt === 0) onStatusUpdate?.("Connecting to FFIEC data source…");
    else if (attempt === 1) onStatusUpdate?.("Fetching bank data — this takes 30–60 seconds for new banks…");
    else if (attempt === 6) onStatusUpdate?.("Still working, FFIEC can be slow…");
    else if (attempt === 12) onStatusUpdate?.("Almost there, finalizing data…");

    const { data, error } = await supabase.functions.invoke<FFIECJobStatusResponse>('ffiec-job-status', {
      body: { jobId },
    });

    if (error) {
      throw new Error(`Failed to check FFIEC job status: ${error.message}`);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to check FFIEC job status');
    }

    if (data.streamingUrl && onStreamingUrl) {
      onStreamingUrl(data.streamingUrl);
    }
    if (data.streamingUrls && onStreamingUrls) {
      onStreamingUrls(data.streamingUrls);
    }

    if (data.status === 'completed') {
      onStatusUpdate?.("Data loaded successfully");
      return data;
    }

    if (data.status === 'failed') {
      onStatusUpdate?.(data.error || 'FFIEC retrieval failed');
      return data;
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error('FFIEC retrieval is taking longer than expected. Please try again.');
};
