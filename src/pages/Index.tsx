import { useState } from "react";
import { cn } from "@/lib/utils";
import { type BankInfo, generateMockMetrics, generateNarrative } from "@/data/bankData";
import { fetchUBPR } from "@/lib/api/ubpr";
import BankSelector from "@/components/BankSelector";
import UBPRReport from "@/components/UBPRReport";
import AINarrativePanel from "@/components/AINarrativePanel";
import PeerComparison from "@/components/PeerComparison";
import DepositAnalysis from "@/components/DepositAnalysis";
import MarketResearch from "@/components/MarketResearch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Brain, Users, Landmark, Globe, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BankMetrics } from "@/data/bankData";


const Index = () => {
  const [subjectBank, setSubjectBank] = useState<BankInfo[]>([]);
  const [peerBanks, setPeerBanks] = useState<BankInfo[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<BankMetrics[]>([]);
  const [dataSource, setDataSource] = useState<"live" | "mock">("live");
  const [analysisReady, setAnalysisReady] = useState(false);
  const [activeTab, setActiveTab] = useState("ubpr");
  const { toast } = useToast();

  const selectedBank = subjectBank[0];
  const narratives = selectedBank ? generateNarrative(selectedBank, metrics.length > 0 ? metrics : generateMockMetrics(selectedBank.rssd)) : [];

  const handleAnalyze = async () => {
    if (!selectedBank) return;
    
    setIsLoading(true);
    try {
      const result = await fetchUBPR(selectedBank.rssd, selectedBank.name);
      setMetrics(result.metrics);
      setDataSource(result.source === "cache" ? "live" : "live");
      setAnalysisReady(true);
      toast({
        title: result.source === "cache" ? "Cached FFIEC Data Loaded" : "Live FFIEC Data Loaded",
        description: result.source === "cache" 
          ? `Using cached data for ${selectedBank.name}.`
          : `UBPR data for ${selectedBank.name} retrieved from FFIEC CDR.`,
      });
    } catch (error) {
      console.error("Failed to fetch live UBPR data:", error);
      // Fall back to mock data
      const mockData = generateMockMetrics(selectedBank.rssd);
      setMetrics(mockData);
      setDataSource("mock");
      setAnalysisReady(true);
      toast({
        title: "Using Sample Data",
        description: "Could not reach FFIEC CDR. Showing estimated data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showDashboard && selectedBank) {
    return (
      <div className="min-h-screen bg-background">
        {/* Dashboard Header */}
        <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowDashboard(false)} className="font-brand text-lg cursor-pointer hover:opacity-80 transition-opacity">
                <span className="text-primary">Peer</span><span className="text-accent">Sweep</span>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {selectedBank.name} | {selectedBank.rssd}
              </span>
              {dataSource === "live" ? (
                <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-medium">
                  Live FFIEC Data
                </span>
              ) : (
                <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full font-medium">
                  Sample Data
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowDashboard(false)}>
                Change Bank
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="container py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
              <UBPRReport bankName={selectedBank.name} rssd={selectedBank.rssd} peerBanks={peerBanks} />
            </TabsContent>

            <TabsContent value="insights">
              <AINarrativePanel narratives={narratives} bankName={selectedBank.name} metrics={metrics} />
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
          <div className="text-center mb-12 animate-fade-in">
              <h1 className="font-brand text-4xl md:text-5xl mb-1 tracking-tight">
                <span className="text-primary">Peer</span><span className="text-accent">Sweep</span>
              </h1>
              <p className="text-accent font-semibold tracking-wide uppercase text-sm">
                Actionable Market Intel — Fast.
              </p>
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
              disabled={!selectedBank || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching FFIEC Data…
                </>
              ) : (
                <>
                  Analyze Performance
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          <div className="mt-12 grid grid-cols-4 gap-4 text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
            {[
              { icon: BarChart3, label: "FFIEC Reports", tab: "ubpr" },
              { icon: Brain, label: "AI Narratives", tab: "insights" },
              { icon: Users, label: "Peer Analysis", tab: "peers" },
              { icon: Globe, label: "Market Intel", tab: "market" },
            ].map(({ icon: Icon, label, tab }) => (
              <button
                key={label}
                disabled={!analysisReady}
                onClick={() => {
                  setActiveTab(tab);
                  setShowDashboard(true);
                }}
                className={cn(
                  "p-3 rounded-lg transition-all",
                  analysisReady
                    ? "bg-accent/15 border-2 border-accent text-accent cursor-pointer hover:bg-accent/25 hover:scale-105"
                    : "bg-muted/50 text-muted-foreground cursor-default"
                )}
              >
                <Icon className={cn("h-5 w-5 mx-auto mb-1.5", analysisReady ? "text-accent" : "text-primary/70")} />
                <p className="text-xs font-medium">{label}</p>
              </button>
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
