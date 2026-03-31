import { type BankInfo, type BankMetrics, generateMockMetrics } from "@/data/bankData";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PeerComparisonProps {
  subjectBank: BankInfo;
  subjectMetrics: BankMetrics[];
  peerBanks: BankInfo[];
}

type MetricRow = {
  label: string;
  getValue: (m: BankMetrics) => number;
  higher: boolean; // true = higher is favorable
};

const metricRows: MetricRow[] = [
  { label: "ROAA (%)", getValue: m => m.roaa, higher: true },
  { label: "Net Interest Margin (%)", getValue: m => m.nim, higher: true },
  { label: "Efficiency Ratio (%)", getValue: m => m.efficiencyRatio, higher: false },
  { label: "Cost of Funds (%)", getValue: m => m.costOfFunds, higher: false },
  { label: "Net Loans & Leases to Deposits (%)", getValue: m => m.loanToDeposit, higher: true },
  { label: "Total Interest Bearing Deposits (%)", getValue: m => m.costOfFunds, higher: false },
  { label: "Tier 1 Capital (%)", getValue: m => m.tier1Capital, higher: true },
  { label: "NPL Ratio (%)", getValue: m => m.nplRatio, higher: false },
];

const PeerComparison = ({ subjectBank, subjectMetrics, peerBanks }: PeerComparisonProps) => {
  const latest = subjectMetrics[0];
  const peerData = peerBanks.map(bank => ({
    bank,
    metrics: generateMockMetrics(bank.rssd)[0],
  }));

  const peerAvg = (fn: (m: BankMetrics) => number) => {
    if (peerData.length === 0) return 0;
    return +(peerData.reduce((sum, p) => sum + fn(p.metrics), 0) / peerData.length).toFixed(2);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-primary pb-3">
        <h3 className="font-display text-lg text-foreground">Peer Comparison</h3>
        <p className="text-sm text-muted-foreground">
          {subjectBank.name} vs. {peerBanks.length} peer{peerBanks.length !== 1 ? 's' : ''} — {latest.quarter}
        </p>
      </div>

      {peerBanks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Select peer banks to enable comparison analysis.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead className="font-semibold">Metric</TableHead>
                <TableHead className="text-right font-semibold bg-primary/10 border-x border-primary/20">{subjectBank.name}</TableHead>
                {peerData.map(({ bank }) => (
                  <TableHead key={bank.rssd} className="text-right font-semibold text-xs">
                    {bank.name}
                  </TableHead>
                ))}
                <TableHead className="text-right font-semibold bg-muted/30 border-l-2 border-border">Peer Avg</TableHead>
                <TableHead className="text-right font-semibold">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metricRows.map((row) => {
                const subjectVal = row.getValue(latest);
                const avg = peerAvg(row.getValue);
                const variance = +(subjectVal - avg).toFixed(2);
                const favorable = row.higher ? variance > 0 : variance < 0;
                return (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium text-sm">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-semibold bg-primary/5 border-x border-primary/20">{subjectVal}</TableCell>
                    {peerData.map(({ bank, metrics }) => (
                      <TableCell key={bank.rssd} className="text-right tabular-nums text-sm">
                        {row.getValue(metrics)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums text-sm bg-muted/30 font-medium">{avg}</TableCell>
                    <TableCell className={`text-right tabular-nums text-sm font-semibold ${favorable ? 'text-success' : 'text-destructive'}`}>
                      {variance > 0 ? '+' : ''}{variance}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default PeerComparison;
