import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle, Shield } from "lucide-react";

interface AINarrativePanelProps {
  narratives: string[];
  bankName: string;
}

const icons = [TrendingUp, TrendingDown, AlertTriangle, Shield];

const AINarrativePanel = ({ narratives, bankName }: AINarrativePanelProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-accent pb-3">
        <h3 className="font-display text-lg text-foreground">AI Performance Insights</h3>
        <p className="text-sm text-muted-foreground">Automated analysis for {bankName}</p>
      </div>

      <div className="grid gap-4">
        {narratives.map((text, i) => {
          const Icon = icons[i % icons.length];
          return (
            <Card key={i} className="p-5 border-l-4 border-l-accent/60 hover:shadow-md transition-shadow">
              <div className="flex gap-4">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 bg-muted/30 border-dashed">
        <p className="text-xs text-muted-foreground text-center">
          🤖 Narratives powered by AI analysis. Connect Lovable Cloud for live AI-generated insights with Lovable AI.
        </p>
      </Card>
    </div>
  );
};

export default AINarrativePanel;
