// Bank data loaded from /banks.json
export interface BankInfo {
  rssd: string;
  name: string;
  city: string;
  state: string;
}

let _banksCache: BankInfo[] | null = null;

export const loadBanks = async (): Promise<BankInfo[]> => {
  if (_banksCache) return _banksCache;
  const res = await fetch('/banks.json');
  _banksCache = await res.json();
  return _banksCache!;
};

export interface BankMetrics {
  quarter: string;
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
}

export const generateMockMetrics = (bankRssd: string): BankMetrics[] => {
  const seed = parseInt(bankRssd.slice(0, 3));
  const quarters = ["Q4 2024", "Q3 2024", "Q2 2024", "Q1 2024", "Q4 2023", "Q3 2023", "Q2 2023", "Q1 2023"];
  
  return quarters.map((quarter, i) => ({
    quarter,
    roaa: +(0.8 + (seed % 7) * 0.1 + Math.sin(i) * 0.05).toFixed(2),
    roae: +(8 + (seed % 5) * 1.2 + Math.sin(i) * 0.5).toFixed(2),
    nim: +(2.8 + (seed % 4) * 0.15 + Math.cos(i) * 0.1).toFixed(2),
    efficiencyRatio: +(58 + (seed % 6) * 2 - Math.sin(i) * 1.5).toFixed(1),
    costOfFunds: +(1.5 + (seed % 5) * 0.2 + i * 0.05).toFixed(2),
    loanToDeposit: +(72 + (seed % 8) * 2 + Math.cos(i) * 1).toFixed(1),
    tier1Capital: +(10 + (seed % 4) * 0.5 - i * 0.05).toFixed(2),
    totalCapital: +(12 + (seed % 4) * 0.5 - i * 0.05).toFixed(2),
    nplRatio: +(0.3 + (seed % 5) * 0.1 + Math.sin(i) * 0.05).toFixed(2),
    allowanceRatio: +(1.0 + (seed % 3) * 0.15).toFixed(2),
  }));
};

export const generateNarrative = (bank: BankInfo, metrics: BankMetrics[]): string[] => {
  const latest = metrics[0];
  const prior = metrics[1];
  const narratives: string[] = [];

  if (latest.roaa > prior.roaa) {
    narratives.push(`${bank.name} posted improving profitability with ROAA rising to ${latest.roaa}% from ${prior.roaa}%, indicating stronger earning asset performance and effective cost management.`);
  } else {
    narratives.push(`${bank.name} experienced a modest decline in ROAA to ${latest.roaa}% from ${prior.roaa}%, warranting management attention to revenue generation and expense control.`);
  }

  if (latest.nim > prior.nim) {
    narratives.push(`Net interest margin expanded to ${latest.nim}%, suggesting favorable repricing dynamics and effective asset-liability management amid the current rate environment.`);
  } else {
    narratives.push(`Net interest margin compressed to ${latest.nim}% from ${prior.nim}%, reflecting competitive deposit pricing pressures and potential funding cost escalation.`);
  }

  if (latest.efficiencyRatio < 65) {
    narratives.push(`The efficiency ratio of ${latest.efficiencyRatio}% demonstrates strong operational discipline, well below the community bank median, positioning the bank competitively.`);
  } else {
    narratives.push(`An efficiency ratio of ${latest.efficiencyRatio}% indicates opportunities to optimize overhead and improve operating leverage relative to peers.`);
  }

  narratives.push(`Capital adequacy remains ${latest.tier1Capital > 10 ? 'well-capitalized' : 'adequately capitalized'} with a Tier 1 ratio of ${latest.tier1Capital}%, providing a buffer for growth and risk absorption.`);

  return narratives;
};
