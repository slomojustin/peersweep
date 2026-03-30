import { supabase } from '@/integrations/supabase/client';
import type { BankMetrics } from '@/data/bankData';

interface UBPRResponse {
  success: boolean;
  error?: string;
  data?: {
    quarters: Array<{
      quarter: string;
      date: string;
      roaa: number;
      roae: number;
      nim: number;
      efficiencyRatio: number;
      costOfFunds: number;
      loanToDeposit: number;
      tier1Capital: number;
      totalCapital: number;
      nplRatio: number;
      allowanceRatio: number;
    }>;
  };
}

export const fetchUBPR = async (rssd: string, bankName: string): Promise<BankMetrics[]> => {
  const { data, error } = await supabase.functions.invoke<UBPRResponse>('fetch-ubpr', {
    body: { rssd, bankName },
  });

  if (error) {
    throw new Error(`Failed to fetch UBPR: ${error.message}`);
  }

  if (!data?.success || !data?.data?.quarters) {
    throw new Error(data?.error || 'No UBPR data returned');
  }

  // Map the TinyFish response to our BankMetrics format
  return data.data.quarters.map((q) => ({
    quarter: q.quarter,
    roaa: Number(q.roaa) || 0,
    roae: Number(q.roae) || 0,
    nim: Number(q.nim) || 0,
    efficiencyRatio: Number(q.efficiencyRatio) || 0,
    costOfFunds: Number(q.costOfFunds) || 0,
    loanToDeposit: Number(q.loanToDeposit) || 0,
    tier1Capital: Number(q.tier1Capital) || 0,
    totalCapital: Number(q.totalCapital) || 0,
    nplRatio: Number(q.nplRatio) || 0,
    allowanceRatio: Number(q.allowanceRatio) || 0,
  }));
};
