import { supabase } from '@/integrations/supabase/client';

export const cancelAgentRuns = async (runIds: string[]): Promise<void> => {
  if (runIds.length === 0) return;
  try {
    await supabase.functions.invoke('cancel-market-intel', { body: { runIds } });
  } catch (err) {
    console.warn('[cancelMarketIntel] best-effort cancellation failed:', err);
  }
};
