import { supabase } from '@/integrations/supabase/client';

interface UBPRPdfResponse {
  success: boolean;
  error?: string;
  pdfUrl?: string | null;
  ffiecUrl?: string;
  message?: string;
  source?: 'cache' | 'live' | 'fallback';
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

  return data;
};
