import { useState } from "react";
import { type BankInfo, generateMockMetrics, generateNarrative } from "@/data/bankData";
import BankSelector from "@/components/BankSelector";
import UBPRReport from "@/components/UBPRReport";
import AINarrativePanel from "@/components/AINarrativePanel";
import PeerComparison from "@/components/PeerComparison";
import DepositAnalysis from "@/components/DepositAnalysis";
import MarketResearch from "@/components/MarketResearch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Brain, Users, Landmark, Globe, ArrowRight } from "lucide-react";
import peersweepLogo from "@/assets/peersweep-logo.png";

const Index = () => {
  const [subjectBank, setSubjectBank] = useState<BankInfo[]>([]);
  const [peerBanks, setPeerBanks] = useState<BankInfo[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);

  const selectedBank = subjectBank[0];
  const metrics = selectedBank ? generateMockMetrics(selectedBank.rssd) : [];
  const narratives = selectedBank ? generateNarrative(selectedBank, metrics) : [];

  const handleAnalyze = () => {
    if (selectedBank) setShowDashboard(true);
  };

  if (showDashboard && selectedBank) {
    return (
      <div className="min-h-screen bg-background">
        {/* Dashboard Header */}
        <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <img src={peersweepLogo} alt="PeerSweep" className="h-6 w-6" />
              <span className="font-display text-lg">Peer<span className="text-accent">Sweep</span></span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {selectedBank.name} | {selectedBank.rssd}
              </span>
              <Button variant="outline" size="sm" onClick={() => setShowDashboard(false)}>
                Change Bank
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="container py-6">
          <Tabs defaultValue="ubpr" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 h-11">
              <TabsTrigger value="ubpr" className="gap-2 text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                UBPR Report
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-2 text-xs">
                <Brain className="h-3.5 w-3.5" />
                AI Insights
              </TabsTrigger>
              <TabsTrigger value="peers" className="gap-2 text-xs">
                <Users className="h-3.5 w-3.5" />
                Peer Analysis
              </TabsTrigger>
              <TabsTrigger value="deposits" className="gap-2 text-xs">
                <Landmark className="h-3.5 w-3.5" />
                Deposits
              </TabsTrigger>
              <TabsTrigger value="market" className="gap-2 text-xs">
                <Globe className="h-3.5 w-3.5" />
                Market
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ubpr">
              <UBPRReport bankName={selectedBank.name} metrics={metrics} />
            </TabsContent>

            <TabsContent value="insights">
              <AINarrativePanel narratives={narratives} bankName={selectedBank.name} />
            </TabsContent>

            <TabsContent value="peers">
              <PeerComparison subjectBank={selectedBank} subjectMetrics={metrics} peerBanks={peerBanks} />
            </TabsContent>

            <TabsContent value="deposits">
              <DepositAnalysis bankName={selectedBank.name} metrics={metrics} />
            </TabsContent>

            <TabsContent value="market">
              <MarketResearch bankName={selectedBank.name} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex items-center justify-center">
        <div className="container max-w-2xl py-16">
          <div className="flex items-center justify-center gap-2 mb-12 animate-fade-in">
            <img src={peersweepLogo} alt="PeerSweep" className="h-60 w-60 object-contain -mr-4" />
            <div className="text-left">
              <h1 className="font-display text-4xl md:text-5xl text-foreground mb-1">
                Peer<span className="text-accent">Sweep</span>
              </h1>
              <p className="text-accent font-semibold tracking-wide uppercase text-sm">
                Actionable Market Intel — Fast.
              </p>
            </div>
          </div>

          <div className="space-y-6 animate-fade-in" style={{ animationDelay: "0.15s" }}>
            <BankSelector
              label="Subject Bank"
              description="Select the bank to analyze"
              selected={subjectBank}
              onSelect={setSubjectBank}
            />

            <BankSelector
              label="Peer Group"
              description="Select up to 25 banks for comparison"
              selected={peerBanks}
              onSelect={setPeerBanks}
              multiple
              maxSelections={25}
            />

            <Button
              className="w-full h-12 text-base gap-2"
              onClick={handleAnalyze}
              disabled={!selectedBank}
            >
              Analyze Performance
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-12 grid grid-cols-4 gap-4 text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
            {[
              { icon: BarChart3, label: "FFIEC Reports" },
              { icon: Brain, label: "AI Narratives" },
              { icon: Users, label: "Peer Analysis" },
              { icon: Globe, label: "Market Intel" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="p-3 rounded-lg bg-muted/50">
                <Icon className="h-5 w-5 mx-auto mb-1.5 text-primary/70" />
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Data sourced from FFIEC CDR • AI-powered analysis • Not a substitute for regulatory examination
      </footer>
    </div>
  );
};

export default Index;
