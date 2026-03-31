import { supabase } from '@/integrations/supabase/client';
import { pollFFIECJob } from '@/lib/api/ffiecJobs';

interface UBPRPdfResponse {
  success: boolean;
  error?: string;
  pdfUrl?: string | null;
  ffiecUrl?: string;
  message?: string;
  source?: 'cache' | 'live' | 'fallback';
  status?: 'processing' | 'completed' | 'failed';
  jobId?: string;
}

export const fetchUBPRPdf = async (rssd: string, bankName: string): Promise<UBPRPdfResponse> => {
  const { data, error } = await supabase.functions.invoke<UBPRPdfResponse>('fetch-ubpr-pdf', {
    body: { rssd, bankName },
  });

  if (error) {
    throw new Error(`Failed to fetch UBPR PDF: ${error.message}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to retrieve UBPR PDF');
  }

  if (data.pdfUrl || data.source === 'cache') {
    return data;
  }

  if (data.status === 'processing' && data.jobId) {
    const finalJob = await pollFFIECJob(data.jobId);

    if (finalJob.status === 'failed') {
      throw new Error(finalJob.error || 'Failed to retrieve UBPR PDF');
    }

    return {
      success: true,
      pdfUrl: finalJob.pdfUrl,
      ffiecUrl: finalJob.ffiecUrl,
      message: finalJob.message,
      source: finalJob.source,
    };
  }

  return data;
};
