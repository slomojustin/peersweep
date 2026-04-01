import { Card } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { getConceptsBySection, sectionOrder } from "@/lib/ubprConceptMap";

interface QuarterData {
  report_date: string;
  metrics: Record<string, number | string>;
}

interface Props {
  bankName: string;
  rssd: string;
  quarters: QuarterData[];
}

function formatValue(raw: unknown, fmt: string): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const num = typeof raw === "string" ? parseFloat(raw) : (raw as number);
  if (isNaN(num)) return String(raw);
  if (fmt === "dollar") return Math.round(num / 1000).toLocaleString("en-US");
  if (fmt === "ratio") return num.toFixed(2) + "%";
  if (fmt === "count") return Math.round(num).toLocaleString("en-US");
  return String(raw);
}

function formatQuarterLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth();
  const year = d.getFullYear();
  const q = month < 3 ? "Q1" : month < 6 ? "Q2" : month < 9 ? "Q3" : "Q4";
  return `${q} ${year}`;
}

const UBPRReportPreview = ({ bankName, rssd, quarters }: Props) => {
  const sorted = [...quarters]
    .sort((a, b) => b.report_date.localeCompare(a.report_date))
    .slice(0, 5);

  const quarterLabels = sorted.map((q) => formatQuarterLabel(q.report_date));
  const conceptsBySection = getConceptsBySection();

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="text-center space-y-1 pb-4 border-b-2 border-primary">
        <h2 className="text-lg font-bold text-foreground tracking-tight">
          Uniform Bank Performance Report (UBPR)
        </h2>
        <p className="text-sm text-muted-foreground">
          {bankName} &bull; RSSD #{rssd}
        </p>
        <p className="text-xs text-muted-foreground">
          Report generated{" "}
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          &bull; Dollar amounts in thousands
        </p>
      </div>

      {/* Sections */}
      {sectionOrder.map((sectionName) => {
        const items = conceptsBySection[sectionName];
        if (!items) return null;

        const visibleItems = items.filter((item) =>
          sorted.some(
            (q) =>
              q.metrics[item.code] !== undefined &&
              q.metrics[item.code] !== null
          )
        );
        if (visibleItems.length === 0) return null;

        return (
          <Card key={sectionName} className="overflow-hidden">
            <div className="bg-primary px-4 py-2">
              <h3 className="text-sm font-semibold text-primary-foreground">
                {sectionName}
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[220px] text-xs font-semibold">
                    Line Item
                  </TableHead>
                  {quarterLabels.map((label) => (
                    <TableHead
                      key={label}
                      className="text-right text-xs font-semibold"
                    >
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((item, idx) => (
                  <TableRow
                    key={item.code}
                    className={idx % 2 === 0 ? "" : "bg-muted/30"}
                  >
                    <TableCell className="text-xs font-medium py-1.5 px-4">
                      {item.label}
                    </TableCell>
                    {sorted.map((q) => (
                      <TableCell
                        key={q.report_date}
                        className="text-right text-xs py-1.5 px-4 tabular-nums"
                      >
                        {formatValue(q.metrics[item.code], item.format)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        );
      })}
    </div>
  );
};

export default UBPRReportPreview;
