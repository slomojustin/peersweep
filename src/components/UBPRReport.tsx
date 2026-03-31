import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Loader2, AlertTriangle, Users } from "lucide-react";
import { fetchUBPRPdf } from "@/lib/api/ubprPdf";
import { useToast } from "@/hooks/use-toast";

interface UBPRReportProps {
  bankName: string;
  rssd?: string;
}

const UBPRReport = ({ bankName, rssd }: UBPRReportProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [ffiecUrl, setFfiecUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);

  const { toast } = useToast();

  const handleFetchPdf = async () => {
    if (!rssd) return;
    setIsLoadingPdf(true);
    setPdfError(null);
    setStreamingUrl(null);

    try {
      const result = await fetchUBPRPdf(rssd, bankName, (url) => setStreamingUrl(url));
      if (result.pdfUrl) {
        setPdfUrl(result.pdfUrl);
        toast({ title: "FFIEC Report Loaded", description: `UBPR PDF for ${bankName} retrieved successfully.` });
      } else if (result.ffiecUrl) {
        setFfiecUrl(result.ffiecUrl);
        setPdfError(result.message || "Could not auto-download the PDF.");
      }
    } catch (error) {
      console.error("Failed to fetch UBPR PDF:", error);
      setPdfError("Could not retrieve the FFIEC PDF report. You can access it directly from the FFIEC CDR.");
      setFfiecUrl("https://cdr.ffiec.gov/public/ManageFacsimiles.aspx");
    } finally {
      setIsLoadingPdf(false);
      setStreamingUrl(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-primary pb-3">
        <h3 className="font-display text-lg text-foreground">FFIEC Reports</h3>
        <p className="text-sm text-muted-foreground">{bankName} — Uniform Bank Performance Report</p>
      </div>

      {/* UBPR PDF Section */}
      {!pdfUrl && (
        <ReportCard
          icon={<FileText className="h-12 w-12 text-primary/60" />}
          title="UBPR Facsimile Report"
          description="Retrieve the official UBPR facsimile report from the FFIEC Central Data Repository."
          buttonLabel="Retrieve UBPR Report"
          loadingLabel="Retrieving from FFIEC CDR…"
          isLoading={isLoadingPdf}
          disabled={!rssd}
          onFetch={handleFetchPdf}
          streamingUrl={streamingUrl}
          error={pdfError}
          fallbackUrl={ffiecUrl}
        />
      )}

      {pdfUrl && (
        <PdfViewer url={pdfUrl} title={`UBPR Report for ${bankName}`} label="FFIEC UBPR Facsimile" />
      )}

    </div>
  );
};

/* Reusable report request card */
const ReportCard = ({
  icon,
  title,
  description,
  buttonLabel,
  loadingLabel,
  isLoading,
  disabled,
  onFetch,
  streamingUrl,
  error,
  fallbackUrl,
  peerBanks,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  loadingLabel: string;
  isLoading: boolean;
  disabled: boolean;
  onFetch: () => void;
  streamingUrl: string | null;
  error: string | null;
  fallbackUrl: string | null;
  peerBanks?: BankInfo[];
}) => (
  <Card className="p-6">
    <div className="flex flex-col items-center gap-4 text-center">
      {icon}
      <div>
        <h4 className="font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      {peerBanks && peerBanks.length > 0 && (
        <div className="w-full text-left bg-muted/30 rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Peer Banks:</p>
          <div className="flex flex-wrap gap-1.5">
            {peerBanks.map((bank) => (
              <span key={bank.rssd} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {bank.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <Button onClick={onFetch} disabled={isLoading || disabled} className="gap-2">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            {buttonLabel}
          </>
        )}
      </Button>

      {isLoading && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 w-full text-left space-y-2">
          <p className="font-medium">Navigating the FFIEC website to generate your report…</p>
          <p>This may take several minutes. The process is automating interactions with the FFIEC CDR portal.</p>
          {streamingUrl && (
            <a
              href={streamingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
            >
              Watch live progress
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 w-full">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="text-left">
            <p>{error}</p>
            {fallbackUrl && (
              <a
                href={fallbackUrl}
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
);

/* PDF embed viewer */
const PdfViewer = ({ url, title, label }: { url: string; title: string; label: string }) => (
  <Card className="overflow-hidden">
    <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
      >
        Open in new tab <ExternalLink className="h-3 w-3" />
      </a>
    </div>
    <iframe src={url} className="w-full h-[700px] border-0" title={title} />
  </Card>
);

export default UBPRReport;
