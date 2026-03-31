import { useState } from "react";
import { type BankMetrics } from "@/data/bankData";
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
import { FileText, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { fetchUBPRPdf } from "@/lib/api/ubprPdf";
import { useToast } from "@/hooks/use-toast";

interface UBPRReportProps {
  bankName: string;
  metrics: BankMetrics[];
  rssd?: string;
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

const UBPRReport = ({ bankName, metrics, rssd }: UBPRReportProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [ffiecUrl, setFfiecUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFetchPdf = async () => {
    if (!rssd) return;
    setIsLoadingPdf(true);
    setPdfError(null);

    try {
      const result = await fetchUBPRPdf(rssd, bankName);
      if (result.pdfUrl) {
        setPdfUrl(result.pdfUrl);
        toast({
          title: "FFIEC Report Loaded",
          description: `UBPR PDF for ${bankName} retrieved successfully.`,
        });
      } else if (result.ffiecUrl) {
        setFfiecUrl(result.ffiecUrl);
        setPdfError(result.message || "Could not auto-download the PDF.");
      }
    } catch (error) {
      console.error("Failed to fetch UBPR PDF:", error);
      setPdfError("Could not retrieve the FFIEC PDF report. Showing summary data below.");
      setFfiecUrl("https://cdr.ffiec.gov/public/ManageFacsimiles.aspx");
    } finally {
      setIsLoadingPdf(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-primary pb-3">
        <h3 className="font-display text-lg text-foreground">FFIEC UBPR Report</h3>
        <p className="text-sm text-muted-foreground">{bankName} — Uniform Bank Performance Report</p>
      </div>

      {/* PDF Section */}
      {!pdfUrl && (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <FileText className="h-12 w-12 text-primary/60" />
            <div>
              <h4 className="font-semibold text-foreground">FFIEC PDF Report</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Download the official UBPR facsimile report from the FFIEC Central Data Repository.
              </p>
            </div>
            <Button
              onClick={handleFetchPdf}
              disabled={isLoadingPdf || !rssd}
              className="gap-2"
            >
              {isLoadingPdf ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching from FFIEC CDR…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Retrieve FFIEC Report
                </>
              )}
            </Button>

            {pdfError && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 w-full">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="text-left">
                  <p>{pdfError}</p>
                  {ffiecUrl && (
                    <a
                      href={ffiecUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                    >
                      Open FFIEC CDR directly
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {pdfUrl && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
            <span className="text-sm font-medium text-muted-foreground">FFIEC UBPR Facsimile</span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Open in new tab <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <iframe
            src={pdfUrl}
            className="w-full h-[700px] border-0"
            title={`UBPR Report for ${bankName}`}
          />
        </Card>
      )}

      {/* Summary Data Table */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Summary Ratios
        </h4>
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
    </div>
  );
};

export default UBPRReport;
