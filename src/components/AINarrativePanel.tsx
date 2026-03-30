import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, AlertTriangle, Shield, DollarSign, Brain, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { BankMetrics } from "@/data/bankData";
import {
  deriveInputsFromMetrics,
  deriveSignals,
  classifyBehaviorProfile,
  PROFILE_LABELS,
  type DerivedSignals,
  type BehaviorProfile,
} from "@/lib/depositBehaviorFramework";

interface AINarrativePanelProps {
  narratives: string[]; // fallback template narratives
  bankName: string;
  metrics?: BankMetrics[];
}

const sectionMeta = [
  { label: "Deposit Need", icon: DollarSign },
  { label: "Pricing Posture", icon: TrendingUp },
  { label: "Growth Capacity", icon: TrendingUp },
  { label: "Earnings Pressure", icon: TrendingDown },
  { label: "Behavior & Outlook", icon: Brain },
];

const signalColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  moderate: "bg-yellow-500/10 text-yellow-700",
  low: "bg-green-500/10 text-green-700",
  strong: "bg-green-500/10 text-green-700",
  constrained: "bg-destructive/10 text-destructive",
  pressured: "bg-destructive/10 text-destructive",
  already_competitive: "bg-primary/10 text-primary",
  becoming_competitive: "bg-yellow-500/10 text-yellow-700",
  not_rate_competitive: "bg-muted text-muted-foreground",
};

const AINarrativePanel = ({ narratives: fallbackNarratives, bankName, metrics }: AINarrativePanelProps) => {
  const [aiNarratives, setAiNarratives] = useState<string[]>([]);
  const [signals, setSignals] = useState<DerivedSignals | null>(null);
  const [profile, setProfile] = useState<BehaviorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const narratives = aiNarratives.length > 0 ? aiNarratives : fallbackNarratives;
  const isAI = aiNarratives.length > 0;

  const generateAINarratives = async () => {
    if (!metrics || metrics.length < 2) return;

    setIsLoading(true);
    setError(null);

    try {
      const inputs = deriveInputsFromMetrics(metrics);
      const derivedSignals = deriveSignals(inputs);
      const behaviorProfile = classifyBehaviorProfile(derivedSignals);

      setSignals(derivedSignals);
      setProfile(behaviorProfile);

      const { data, error: fnError } = await supabase.functions.invoke("analyze-deposit-behavior", {
        body: { bankName, inputs, signals: derivedSignals, profile: behaviorProfile },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (data?.narratives?.length > 0) {
        setAiNarratives(data.narratives);
      }
    } catch (e) {
      console.error("AI narrative error:", e);
      setError(e instanceof Error ? e.message : "Failed to generate AI narratives");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (metrics && metrics.length >= 2) {
      // Derive signals immediately for the badge display
      const inputs = deriveInputsFromMetrics(metrics);
      const derivedSignals = deriveSignals(inputs);
      const behaviorProfile = classifyBehaviorProfile(derivedSignals);
      setSignals(derivedSignals);
      setProfile(behaviorProfile);
    }
  }, [metrics]);

  const icons = isAI
    ? sectionMeta.map((s) => s.icon)
    : [TrendingUp, TrendingDown, AlertTriangle, Shield];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-accent pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-foreground">
            {isAI ? "AI Deposit Behavior Analysis" : "AI Performance Insights"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAI ? "UBPR-driven framework analysis" : "Automated analysis"} for {bankName}
          </p>
        </div>
        {metrics && metrics.length >= 2 && (
          <Button
            variant="outline"
            size="sm"
            onClick={generateAINarratives}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyzing…
              </>
            ) : isAI ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </>
            ) : (
              <>
                <Brain className="h-3.5 w-3.5" />
                Generate AI Analysis
              </>
            )}
          </Button>
        )}
      </div>

      {/* Signal badges */}
      {signals && profile && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="font-semibold">
            {PROFILE_LABELS[profile]}
          </Badge>
          {Object.entries(signals).map(([key, value]) => (
            <Badge key={key} variant="secondary" className={signalColors[value] || ""}>
              {key.replace(/_/g, " ")}: {String(value).replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      )}

      {error && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      <div className="grid gap-4">
        {narratives.map((text, i) => {
          const Icon = icons[i % icons.length];
          const sectionLabel = isAI ? sectionMeta[i]?.label : undefined;
          return (
            <Card key={i} className="p-5 border-l-4 border-l-accent/60 hover:shadow-md transition-shadow">
              <div className="flex gap-4">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <div className="space-y-1">
                  {sectionLabel && (
                    <p className="text-xs font-semibold text-accent uppercase tracking-wide">{sectionLabel}</p>
                  )}
                  <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 bg-muted/30 border-dashed">
        <p className="text-xs text-muted-foreground text-center">
          {isAI
            ? "🤖 Narratives generated by AI using the UBPR Deposit Behavior Analysis Framework."
            : '🤖 Template narratives shown. Click "Generate AI Analysis" for AI-powered deposit behavior insights.'}
        </p>
      </Card>
    </div>
  );
};

export default AINarrativePanel;
