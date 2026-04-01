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
import { Globe, ExternalLink, Loader2, Landmark, Newspaper, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchMarketIntel, type MarketIntelData } from "@/lib/api/marketIntel";
import type { BankInfo } from "@/data/bankData";

interface MarketResearchProps {
  bank: BankInfo;
  peerBanks: BankInfo[];
  cachedData?: MarketIntelData | null;
  onDataLoaded?: (data: MarketIntelData) => void;
}

const MarketResearch = ({ bank, peerBanks, cachedData, onDataLoaded }: MarketResearchProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<MarketIntelData | null>(cachedData ?? null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFetch = async () => {
    setIsLoading(true);
    setStreamingUrl(null);
    try {
      const result = await fetchMarketIntel(bank, peerBanks, (url) => setStreamingUrl(url));
      setData(result);
      onDataLoaded?.(result);
      toast({ title: "Market Intel Retrieved", description: "Live market data loaded successfully." });
    } catch (err) {
      console.error("Market intel error:", err);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to fetch market intel", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setStreamingUrl(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-primary pb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg text-foreground">Market Research</h3>
        </div>
        <p className="text-sm text-muted-foreground">Competitive intelligence for {bank.name}</p>
      </div>

      {/* Fetch button */}
      {!data && (
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
          {streamingUrl && (
            <p className="text-xs text-muted-foreground">
              <a href={streamingUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Watch live extraction →
              </a>
            </p>
          )}
        </Card>
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
          <div className="text-center pt-2">
            <Button variant="outline" size="sm" onClick={handleFetch} disabled={isLoading} className="gap-2">
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
              Refresh Market Intel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketResearch;
