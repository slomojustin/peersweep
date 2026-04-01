import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import { fetchUBPRData } from "@/lib/api/ubprPdf";
import { generateUBPRPdf } from "@/lib/generateUBPRPdf";
import { useToast } from "@/hooks/use-toast";

interface UBPRReportProps {
  bankName: string;
  rssd?: string;
}

const UBPRReport = ({ bankName, rssd }: UBPRReportProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!rssd) return;
    let cancelled = false;

    const generate = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const quarters = await fetchUBPRData(rssd);
        const blob = await generateUBPRPdf(bankName, rssd, quarters);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        toast({ title: "Report Generated", description: `UBPR PDF for ${bankName} is ready.` });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to generate UBPR PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to generate UBPR report.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    generate();
    return () => { cancelled = true; };
  }, [rssd, bankName]);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `UBPR_${bankName.replace(/\s+/g, "_")}_${rssd}.pdf`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-primary pb-3">
        <h3 className="font-display text-lg text-foreground">FFIEC Reports</h3>
        <p className="text-sm text-muted-foreground">{bankName} — Uniform Bank Performance Report</p>
      </div>

      {isLoading && (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Generating UBPR report…</p>
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

      {pdfUrl && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
            <span className="text-sm font-medium text-muted-foreground">FFIEC UBPR Facsimile</span>
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
              <Download className="h-3 w-3" />
              Download PDF
            </Button>
          </div>
          <iframe src={pdfUrl} className="w-full h-[700px] border-0" title={`UBPR Report for ${bankName}`} />
        </Card>
      )}
    </div>
  );
};

export default UBPRReport;
