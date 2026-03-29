import { type BankMetrics } from "@/data/bankData";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UBPRReportProps {
  bankName: string;
  metrics: BankMetrics[];
}

const MetricRow = ({ label, values, format = "percent" }: { label: string; values: number[]; format?: string }) => (
  <TableRow>
    <TableCell className="font-medium text-sm">{label}</TableCell>
    {values.map((v, i) => (
      <TableCell key={i} className="text-right text-sm tabular-nums">
        {format === "percent" ? `${v}%` : v.toFixed(2)}
      </TableCell>
    ))}
  </TableRow>
);

const UBPRReport = ({ bankName, metrics }: UBPRReportProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-primary pb-3">
        <h3 className="font-display text-lg text-foreground">Uniform Bank Performance Report</h3>
        <p className="text-sm text-muted-foreground">{bankName} — Summary Ratios</p>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5">
              <TableHead className="w-[200px] font-semibold">Performance Metric</TableHead>
              {metrics.slice(0, 6).map((m) => (
                <TableHead key={m.quarter} className="text-right font-semibold text-xs">{m.quarter}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={7} className="bg-muted/50 font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2">
                Earnings & Profitability
              </TableCell>
            </TableRow>
            <MetricRow label="Return on Average Assets" values={metrics.slice(0, 6).map(m => m.roaa)} />
            <MetricRow label="Return on Average Equity" values={metrics.slice(0, 6).map(m => m.roae)} />
            <MetricRow label="Net Interest Margin" values={metrics.slice(0, 6).map(m => m.nim)} />
            <MetricRow label="Efficiency Ratio" values={metrics.slice(0, 6).map(m => m.efficiencyRatio)} />

            <TableRow>
              <TableCell colSpan={7} className="bg-muted/50 font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2">
                Funding & Liquidity
              </TableCell>
            </TableRow>
            <MetricRow label="Cost of Funds" values={metrics.slice(0, 6).map(m => m.costOfFunds)} />
            <MetricRow label="Loan-to-Deposit Ratio" values={metrics.slice(0, 6).map(m => m.loanToDeposit)} />

            <TableRow>
              <TableCell colSpan={7} className="bg-muted/50 font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2">
                Capital Adequacy
              </TableCell>
            </TableRow>
            <MetricRow label="Tier 1 Capital Ratio" values={metrics.slice(0, 6).map(m => m.tier1Capital)} />
            <MetricRow label="Total Capital Ratio" values={metrics.slice(0, 6).map(m => m.totalCapital)} />

            <TableRow>
              <TableCell colSpan={7} className="bg-muted/50 font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2">
                Asset Quality
              </TableCell>
            </TableRow>
            <MetricRow label="Non-Performing Loans / Total Loans" values={metrics.slice(0, 6).map(m => m.nplRatio)} />
            <MetricRow label="Allowance / Total Loans" values={metrics.slice(0, 6).map(m => m.allowanceRatio)} />
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default UBPRReport;
