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

  const rows = [
    { label: "ROAA (%)", subject: latest.roaa, peer: peerAvg(m => m.roaa), higher: true },
    { label: "ROAE (%)", subject: latest.roae, peer: peerAvg(m => m.roae), higher: true },
    { label: "Net Interest Margin (%)", subject: latest.nim, peer: peerAvg(m => m.nim), higher: true },
    { label: "Efficiency Ratio (%)", subject: latest.efficiencyRatio, peer: peerAvg(m => m.efficiencyRatio), higher: false },
    { label: "Cost of Funds (%)", subject: latest.costOfFunds, peer: peerAvg(m => m.costOfFunds), higher: false },
    { label: "Tier 1 Capital (%)", subject: latest.tier1Capital, peer: peerAvg(m => m.tier1Capital), higher: true },
    { label: "NPL Ratio (%)", subject: latest.nplRatio, peer: peerAvg(m => m.nplRatio), higher: false },
  ];

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
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead className="font-semibold">Metric</TableHead>
                <TableHead className="text-right font-semibold">{subjectBank.name}</TableHead>
                <TableHead className="text-right font-semibold">Peer Average</TableHead>
                <TableHead className="text-right font-semibold">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const variance = +(row.subject - row.peer).toFixed(2);
                const favorable = row.higher ? variance > 0 : variance < 0;
                return (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium text-sm">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{row.subject}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{row.peer}</TableCell>
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
