import { useState } from "react";
import { cn } from "@/lib/utils";
import { type BankInfo, generateNarrative } from "@/data/bankData";
import { fetchUBPR } from "@/lib/api/ubpr";
import BankSelector from "@/components/BankSelector";
import UBPRReport from "@/components/UBPRReport";
import AINarrativePanel from "@/components/AINarrativePanel";
import PeerComparison from "@/components/PeerComparison";

import MarketResearch from "@/components/MarketResearch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Brain, Users, Globe, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BankMetrics } from "@/data/bankData";
import type { MarketIntelData } from "@/lib/api/marketIntel";

// Hardcoded peer banks for quick testing — swap for any 6 banks you prefer
const TEST_PEER_BANKS: BankInfo[] = [
  { rssd: "852218",  name: "JPMORGAN CHASE BANK",    city: "Columbus",      state: "OH" },
  { rssd: "480228",  name: "BANK OF AMERICA",         city: "Charlotte",     state: "NC" },
  { rssd: "451965",  name: "WELLS FARGO BANK",        city: "Sioux Falls",   state: "SD" },
  { rssd: "476810",  name: "CITIBANK",                city: "Sioux Falls",   state: "SD" },
  { rssd: "504713",  name: "U.S. BANK",               city: "Cincinnati",    state: "OH" },
  { rssd: "817824",  name: "PNC BANK",                city: "Wilmington",    state: "DE" },
];

const Index = () => {
  const [subjectBank, setSubjectBank] = useState<BankInfo[]>([]);
  const [peerBanks, setPeerBanks] = useState<BankInfo[]>([]);
  const [bypassPeerMin, setBypassPeerMin] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<BankMetrics[]>([]);
  const [dataSource, setDataSource] = useState<"live" | "cache" | "mock" | null>(null);
  const [isUbprLoading, setIsUbprLoading] = useState(false);
  const [ubprError, setUbprError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [activeTab, setActiveTab] = useState("ubpr");
  const [marketIntelData, setMarketIntelData] = useState<MarketIntelData | null>(null);
  const { toast } = useToast();

  const selectedBank = subjectBank[0];
  const narratives = selectedBank && metrics.length >= 2 ? generateNarrative(selectedBank, metrics) : [];

  const handleNavigate = async (tab: string) => {
    if (!selectedBank) return;

    setActiveTab(tab);
    setShowDashboard(true);

    // TEMP: UBPR fetch disabled for testing — re-enable when needed
    // setUbprError(null);
    // setStatusMessage(null);
    // setIsUbprLoading(true);
    // try {
    //   const result = await fetchUBPR(selectedBank.rssd, selectedBank.name, setStatusMessage);
    //   setMetrics(result.metrics);
    //   setDataSource(result.source);
    //   setAnalysisReady(true);
    // } catch (error) {
    //   console.error('UBPR fetch failed:', error);
    //   setUbprError(error instanceof Error ? error.message : 'Failed to load UBPR data');
    //   setMetrics([]);
    //   setDataSource('mock');
    // } finally {
    //   setIsUbprLoading(false);
    //   setStatusMessage(null);
    // }
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
              {isUbprLoading ? (
                <span className="text-xs text-muted-foreground px-2 py-0.5">Loading data…</span>
              ) : ubprError ? (
                <span className="text-xs bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full font-medium">
                  {ubprError}
                </span>
              ) : (dataSource === "live" || dataSource === "cache") ? (
                <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-medium">
                  Live FFIEC Data
                </span>
              ) : dataSource === "mock" ? (
                <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full font-medium">
                  Sample Data
                </span>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => setShowDashboard(false)}>
                Change Bank
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="container py-6">
          {isUbprLoading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {statusMessage ?? "Loading UBPR data…"}
            </div>
          )}
          {ubprError && !isUbprLoading && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 text-red-600 text-sm">
              {ubprError}
            </div>
          )}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
             <TabsList className="grid w-full grid-cols-4 h-11">
              <TabsTrigger value="ubpr" className="gap-2 text-xs">
                <FileText className="h-3.5 w-3.5" />
                FFIEC Reports
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-2 text-xs">
                <Brain className="h-3.5 w-3.5" />
                AI Insights
              </TabsTrigger>
              <TabsTrigger value="peers" className="gap-2 text-xs">
                <Users className="h-3.5 w-3.5" />
                Peer Analysis
              </TabsTrigger>
              <TabsTrigger value="market" className="gap-2 text-xs">
                <Globe className="h-3.5 w-3.5" />
                Market
              </TabsTrigger>
             </TabsList>

            <TabsContent value="ubpr">
              <UBPRReport bankName={selectedBank.name} rssd={selectedBank.rssd} selectedQuarters={[]} />
            </TabsContent>

            <TabsContent value="insights">
              <AINarrativePanel narratives={narratives} bankName={selectedBank.name} metrics={metrics} />
            </TabsContent>

            <TabsContent value="peers">
              <PeerComparison subjectBank={selectedBank} subjectMetrics={metrics} peerBanks={peerBanks} selectedQuarters={[]} />
            </TabsContent>


            <TabsContent value="market">
              <MarketResearch bank={selectedBank} peerBanks={peerBanks} cachedData={marketIntelData} onDataLoaded={setMarketIntelData} />
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
            <div className="flex items-center gap-2 mt-1">
              <p className={cn("text-xs", peerBanks.length >= 6 || bypassPeerMin ? "text-green-600" : "text-yellow-600")}>
                {peerBanks.length >= 6
                  ? `${peerBanks.length} peers selected ✓`
                  : bypassPeerMin
                  ? `${peerBanks.length} peers selected (min bypassed)`
                  : `${peerBanks.length} of 6 minimum selected`}
              </p>
              <button
                onClick={() => setPeerBanks(TEST_PEER_BANKS)}
                className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              >
                load 6 test banks
              </button>
              <button
                onClick={() => { setBypassPeerMin(b => !b); setPeerBanks([]); }}
                className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              >
                {bypassPeerMin ? "re-enable min" : "bypass for testing"}
              </button>
            </div>

          </div>

          <div className="mt-8 grid grid-cols-4 gap-4 text-center animate-fade-in" style={{ animationDelay: "0.15s" }}>
            {[
              { icon: BarChart3, label: "Subject Bank\nFFIEC Report", tab: "ubpr" },
              { icon: Users, label: "Peer Group\nAnalysis", tab: "peers" },
              { icon: Brain, label: "Detailed\nAnalysis", tab: "insights" },
              { icon: Globe, label: "Current Market\nIntelligence", tab: "market" },
            ].map(({ icon: Icon, label, tab }) => (
              <button
                key={label}
                disabled={!selectedBank || isUbprLoading || peerBanks.length < 6 && !bypassPeerMin}
                onClick={() => handleNavigate(tab)}
                className={cn(
                  "p-3 rounded-lg transition-all",
                  selectedBank && !isUbprLoading && (peerBanks.length >= 6 || bypassPeerMin)
                    ? "bg-accent/15 border-2 border-accent text-accent cursor-pointer hover:bg-accent/25 hover:scale-105"
                    : "bg-muted/50 text-muted-foreground cursor-default"
                )}
              >
                <Icon className={cn("h-5 w-5 mx-auto mb-1.5", selectedBank && !isUbprLoading && (peerBanks.length >= 6 || bypassPeerMin) ? "text-accent" : "text-primary/70")} />
                <p className="text-xs font-medium whitespace-pre-line">{label}</p>
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
