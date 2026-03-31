import { supabase } from '@/integrations/supabase/client';
import { pollFFIECJob } from '@/lib/api/ffiecJobs';
import type { BankInfo } from '@/data/bankData';

export interface CompetitorRate {
  institution: string;
  product: string;
  rate: number;
  source: string;
  date: string;
}

export interface FDICCompetitor {
  name: string;
  deposits: number;
  branches: number;
  marketSharePct: number;
}

export interface FDICMarketShare {
  bankName: string;
  marketArea: string;
  totalDeposits: number;
  branches: number;
  marketSharePct: number;
  competitors: FDICCompetitor[];
}

export interface PeerBankRate {
  bankName: string;
  product: string;
  rate: number;
  source: string;
}

export interface LocalNewsItem {
  headline: string;
  source: string;
  url: string | null;
  date: string | null;
  summary: string;
}

export interface SocialMediaEntry {
  bankName: string;
  platform: string;
  profileUrl: string | null;
  followers: number | null;
  recentPromo: string | null;
  lastPostDate: string | null;
}

export interface MarketIntelData {
  competitorRates?: CompetitorRate[];
  fdicMarketShare?: FDICMarketShare | null;
  peerBankRates?: PeerBankRate[];
  localNews?: LocalNewsItem[];
  socialMedia?: SocialMediaEntry[];
}

interface MarketIntelResponse {
  success: boolean;
  error?: string;
  source?: 'cache' | 'live';
  status?: 'processing' | 'completed' | 'failed';
  jobId?: string;
  data?: MarketIntelData;
}

export const fetchMarketIntel = async (
  bank: BankInfo,
  peerBanks: BankInfo[],
  onStreamingUrl?: (url: string) => void,
): Promise<MarketIntelData> => {
  const { data, error } = await supabase.functions.invoke<MarketIntelResponse>('fetch-market-intel', {
    body: {
      bankName: bank.name,
      rssd: bank.rssd,
      state: bank.state,
      city: bank.city,
      peerBanks: peerBanks.map(p => ({ name: p.name, rssd: p.rssd })),
    },
  });

  if (error) {
    throw new Error(`Failed to fetch market intel: ${error.message}`);
  }

  if (data?.success && data?.status === 'completed' && data?.data) {
    return data.data;
  }

  if (data?.success && data?.status === 'processing' && data?.jobId) {
    const finalJob = await pollFFIECJob(data.jobId, onStreamingUrl);

    if (finalJob.status !== 'completed' || !finalJob.data) {
      throw new Error(finalJob.error || 'No market intel data returned');
    }

    return finalJob.data as unknown as MarketIntelData;
  }

  throw new Error(data?.error || 'No market intel data returned');
};
