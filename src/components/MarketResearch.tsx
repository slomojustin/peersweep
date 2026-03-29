import { Card } from "@/components/ui/card";
import { Globe, ExternalLink } from "lucide-react";

interface MarketResearchProps {
  bankName: string;
}

const MarketResearch = ({ bankName }: MarketResearchProps) => {
  const mockRates = [
    { institution: "Regional Credit Union", product: "12-Month CD", rate: "4.75%", source: "bankrate.com", date: "Mar 2026" },
    { institution: "Online Direct Bank", product: "High-Yield Savings", rate: "4.50%", source: "depositaccounts.com", date: "Mar 2026" },
    { institution: "National Bank Corp", product: "Money Market", rate: "4.25%", source: "nerdwallet.com", date: "Mar 2026" },
    { institution: "Community Savings Bank", product: "18-Month CD", rate: "4.60%", source: "bankrate.com", date: "Mar 2026" },
    { institution: "Digital-First Bank", product: "High-Yield Savings", rate: "4.65%", source: "depositaccounts.com", date: "Mar 2026" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-primary pb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg text-foreground">Market Research</h3>
        </div>
        <p className="text-sm text-muted-foreground">Competitive rate intelligence for {bankName}</p>
      </div>

      <Card className="p-4 bg-muted/30 border-dashed">
        <p className="text-xs text-muted-foreground text-center">
          🔍 Live market research requires TinyFish API integration. Below is sample competitive rate data.
        </p>
      </Card>

      <div className="grid gap-3">
        {mockRates.map((rate, i) => (
          <Card key={i} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-foreground">{rate.institution}</p>
                <p className="text-xs text-muted-foreground">{rate.product}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums text-accent">{rate.rate}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{rate.source}</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5 border-l-4 border-l-accent/60">
        <h4 className="text-sm font-semibold mb-2">Market Rate Summary</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Competitive analysis indicates deposit rates ranging from 4.25% to 4.75% APY across 
          comparable products. Online-only institutions continue to lead pricing, 
          creating competitive pressure for community bank deposit retention strategies.
        </p>
      </Card>
    </div>
  );
};

export default MarketResearch;
