import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Globe, ExternalLink, Loader2, Landmark, Newspaper, Share2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { fetchMarketIntel, type MarketIntelData, type AgentStreamInfo } from "@/lib/api/marketIntel";
import type { BankInfo } from "@/data/bankData";

interface MarketResearchProps {
  bank: BankInfo;
  peerBanks: BankInfo[];
  cachedData?: MarketIntelData | null;
  onDataLoaded?: (data: MarketIntelData) => void;
}

const TinyFishBadge = () => (
  <a
    href="https://tinyfish.ai"
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-full px-2 py-0.5 hover:text-foreground transition-colors"
  >
    <img src="/tinyfish-logo.png" alt="TinyFish" className="h-4 w-4 object-contain" />
    Powered by TinyFish
  </a>
);

const AgentStreamPanel = ({
  stream,
  index,
  isExpanded,
  onToggle,
}: {
  stream: AgentStreamInfo;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const panelId = `agent-stream-${index}`;
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{stream.bankName}</span>
          <span className={cn(
            "shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium",
            stream.streamingUrl
              ? "bg-blue-500/10 text-blue-600"
              : "bg-muted text-muted-foreground",
          )}>
            {stream.streamingUrl ? "Running" : "Pending"}
          </span>
        </div>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
          isExpanded && "rotate-180",
        )} />
      </button>
      {isExpanded && (
        <div id={panelId} className="px-3 py-2 border-t bg-muted/20">
          {stream.streamingUrl ? (
            <a
              href={stream.streamingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Watch live extraction →
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting for agent to start…</p>
          )}
        </div>
      )}
    </div>
  );
};

const MarketResearch = ({ bank, peerBanks, cachedData, onDataLoaded }: MarketResearchProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<MarketIntelData | null>(cachedData ?? null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [agentStreams, setAgentStreams] = useState<AgentStreamInfo[]>([]);
  const [expandedPanels, setExpandedPanels] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const togglePanel = (i: number) =>
    setExpandedPanels(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  const expandAll = () => setExpandedPanels(new Set(agentStreams.map((_, i) => i)));
  const collapseAll = () => setExpandedPanels(new Set());

  const handleFetch = async () => {
    setIsLoading(true);
    setStreamingUrl(null);
    setExpandedPanels(new Set());
    // Initialise one panel per peer bank so they're visible from the start (all Pending)
    setAgentStreams(peerBanks.map(p => ({ bankName: p.name, streamingUrl: null })));
    try {
      const result = await fetchMarketIntel(
        bank,
        peerBanks,
        (url) => setStreamingUrl(url),
        (streams) => setAgentStreams(streams),
      );
      setData(result);
      onDataLoaded?.(result);
      toast({ title: "Market Intel Retrieved", description: "Live market data loaded successfully." });
    } catch (err) {
      console.error("Market intel error:", err);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to fetch market intel", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setStreamingUrl(null);
      setAgentStreams([]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-primary pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg text-foreground">Market Research</h3>
          </div>
          <TinyFishBadge />
        </div>
        <p className="text-sm text-muted-foreground">Competitive intelligence for {bank.name}</p>
      </div>

      {/* Fetch button */}
      {!data && (
        <div className="space-y-4">
          <Card className="p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Scrape peer bank websites for deposit rates, search local news coverage, and scan social media for competitor marketing activity.
            </p>
            <Button onClick={handleFetch} disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gathering Market Intel…
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" />
                  Retrieve Market Intel
                </>
              )}
            </Button>
          </Card>

          {isLoading && (
            <div className="space-y-4 px-1">
              {/* Overall progress bar */}
              <div className="space-y-2">
                <div className="relative h-3 w-full rounded-full bg-muted overflow-visible">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-primary"
                    style={{ animation: 'swim 90s ease-in-out forwards' }}
                  >
                    <img
                      src="/tinyfish-logo.png"
                      alt="TinyFish extracting data"
                      className="absolute right-0 top-1/2 h-7 w-7 object-contain -translate-y-1/2 translate-x-1/2"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  TinyFish is researching {agentStreams.length} peer bank{agentStreams.length !== 1 ? 's' : ''} in parallel…
                </p>
              </div>

              {/* Per-agent stream panels */}
              {agentStreams.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-medium">
                      {agentStreams.filter(s => s.streamingUrl).length} of {agentStreams.length} agents running
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={expandAll}
                        className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                      >
                        Expand all
                      </button>
                      <button
                        onClick={collapseAll}
                        className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                      >
                        Collapse all
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {agentStreams.map((stream, i) => (
                      <AgentStreamPanel
                        key={i}
                        stream={stream}
                        index={i}
                        isExpanded={expandedPanels.has(i)}
                        onToggle={() => togglePanel(i)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-8">
          {/* Peer Bank Rates */}
          {data.peerBankRates && data.peerBankRates.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-accent" />
                <h4 className="font-semibold text-sm">Peer Bank Advertised Rates</h4>
              </div>
              <Card className="overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="font-semibold">Bank</TableHead>
                      <TableHead className="font-semibold">Product</TableHead>
                      <TableHead className="text-right font-semibold">APY (%)</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.peerBankRates.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{r.bankName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.product}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-accent">{r.rate}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {r.source}
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </section>
          )}

          {/* Local News */}
          {data.localNews && data.localNews.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-accent" />
                <h4 className="font-semibold text-sm">Local News & Market Coverage</h4>
              </div>
              <div className="space-y-2">
                {data.localNews.map((item, i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <h5 className="text-sm font-medium leading-tight">
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">
                              {item.headline}
                            </a>
                          ) : item.headline}
                        </h5>
                        <p className="text-xs text-muted-foreground">{item.summary}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">{item.source}</span>
                          {item.date && <span>• {item.date}</span>}
                        </div>
                      </div>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Social Media */}
          {data.socialMedia && data.socialMedia.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-accent" />
                <h4 className="font-semibold text-sm">Social Media & Marketing Activity</h4>
              </div>
              <Card className="overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="font-semibold">Bank</TableHead>
                      <TableHead className="font-semibold">Platform</TableHead>
                      <TableHead className="text-right font-semibold">Followers</TableHead>
                      <TableHead className="font-semibold">Recent Promotion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.socialMedia.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{s.bankName}</TableCell>
                        <TableCell className="text-sm">
                          {s.profileUrl ? (
                            <a href={s.profileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              {s.platform} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : s.platform}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {s.followers != null ? s.followers.toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {s.recentPromo || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </section>
          )}

          {/* Refresh */}
          <div className="text-center pt-2 space-y-3">
            <Button variant="outline" size="sm" onClick={handleFetch} disabled={isLoading} className="gap-2">
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
              Refresh Market Intel
            </Button>
            <div className="flex justify-center">
              <TinyFishBadge />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketResearch;
