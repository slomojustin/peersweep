import { type BankMetrics } from "@/data/bankData";
import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DepositAnalysisProps {
  bankName: string;
  metrics: BankMetrics[];
}

const DepositAnalysis = ({ bankName, metrics }: DepositAnalysisProps) => {
  const chartData = [...metrics].reverse().map(m => ({
    quarter: m.quarter,
    costOfFunds: m.costOfFunds,
    loanToDeposit: m.loanToDeposit,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-warning pb-3">
        <h3 className="font-display text-lg text-foreground">Deposit & Funding Analysis</h3>
        <p className="text-sm text-muted-foreground">{bankName} — Trend Analysis</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h4 className="text-sm font-semibold mb-4 text-foreground">Cost of Funds Trend</h4>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="costOfFunds"
                  stroke="hsl(var(--warning))"
                  fill="hsl(var(--warning) / 0.15)"
                  name="Cost of Funds %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h4 className="text-sm font-semibold mb-4 text-foreground">Loan-to-Deposit Ratio Trend</h4>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="loanToDeposit"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.1)"
                  name="L/D Ratio %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5 border-l-4 border-l-warning/60">
        <h4 className="text-sm font-semibold mb-2">Funding Outlook</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Cost of funds has trended {chartData[chartData.length - 1]?.costOfFunds > chartData[0]?.costOfFunds ? 'higher' : 'lower'} over
          the observation period, reflecting {chartData[chartData.length - 1]?.costOfFunds > chartData[0]?.costOfFunds ? 'competitive deposit markets and rising rate pressures' : 'improved funding efficiency'}. 
          Management should monitor deposit mix shifts and evaluate wholesale funding alternatives.
        </p>
      </Card>
    </div>
  );
};

export default DepositAnalysis;
