import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import { fetchUBPRData, UBPRPdfData } from "@/lib/api/ubprPdf";
import { generateUBPRPdf } from "@/lib/generateUBPRPdf";
import { useToast } from "@/hooks/use-toast";
import UBPRReportPreview from "./UBPRReportPreview";

interface UBPRReportProps {
  bankName: string;
  rssd?: string;
}

const UBPRReport = ({ bankName, rssd }: UBPRReportProps) => {
  const [quarters, setQuarters] = useState<UBPRPdfData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!rssd) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchUBPRData(rssd);
        if (cancelled) return;
        setQuarters(data);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch UBPR data:", err);
        setError(err instanceof Error ? err.message : "Failed to load UBPR data.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [rssd, bankName]);

  const handleDownload = async () => {
    if (!quarters || !rssd) return;
    setIsDownloading(true);
    try {
      const dataUri = await generateUBPRPdf(bankName, rssd, quarters);
      const a = document.createElement("a");
      a.href = dataUri;
      a.download = `UBPR_${bankName.replace(/\s+/g, "_")}_${rssd}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: "PDF Downloaded", description: `UBPR PDF for ${bankName} saved.` });
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast({ title: "Download Failed", description: "Could not generate PDF.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b-2 border-primary pb-3">
        <div>
          <h3 className="font-display text-lg text-foreground">FFIEC Reports</h3>
          <p className="text-sm text-muted-foreground">{bankName} — Uniform Bank Performance Report</p>
        </div>
        {quarters && (
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading} className="gap-1">
            {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Download PDF
          </Button>
        )}
      </div>

      {isLoading && (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading UBPR data…</p>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-6">
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {quarters && rssd && (
        <UBPRReportPreview bankName={bankName} rssd={rssd} quarters={quarters} />
      )}
    </div>
  );
};

export default UBPRReport;
