import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

/**
 * Generates the last 12 completed quarters (3 years) ending at the most
 * recently completed quarter before today. Index 0 = most recent.
 */
export function generateAvailableQuarters(): string[] {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  let lastQ: number;
  let lastYear = year;
  if (month >= 9) lastQ = 3;       // Oct–Dec → Q3 complete
  else if (month >= 6) lastQ = 2;  // Jul–Sep → Q2 complete
  else if (month >= 3) lastQ = 1;  // Apr–Jun → Q1 complete
  else { lastQ = 4; lastYear = year - 1; } // Jan–Mar → Q4 of prior year

  const quarters: string[] = [];
  let q = lastQ;
  let y = lastYear;
  for (let i = 0; i < 12; i++) {
    quarters.push(`Q${q} ${y}`);
    q--;
    if (q === 0) { q = 4; y--; }
  }
  return quarters;
}

interface Props {
  value: string[];
  onChange: (quarters: string[]) => void;
  availableQuarters: string[];
}

const QuarterRangePicker = ({ value, onChange, availableQuarters }: Props) => {
  const [open, setOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<string | null>(null);

  const idxOf = (q: string) => availableQuarters.indexOf(q);

  const valueIndices = value.map(idxOf).filter((i) => i >= 0);
  const rangeStart = valueIndices.length > 0 ? Math.min(...valueIndices) : -1;
  const rangeEnd   = valueIndices.length > 0 ? Math.max(...valueIndices) : -1;

  const getState = (q: string): "endpoint" | "in-range" | "disabled" | "default" => {
    const idx = idxOf(q);
    if (pendingStart !== null) {
      const pIdx = idxOf(pendingStart);
      if (q === pendingStart) return "endpoint";
      if (Math.abs(idx - pIdx) >= 5) return "disabled";
      return "default";
    }
    if (rangeStart < 0) return "default";
    if (idx === rangeStart || idx === rangeEnd) return "endpoint";
    if (idx > rangeStart && idx < rangeEnd) return "in-range";
    return "default";
  };

  const handleClick = (q: string) => {
    if (pendingStart === null) {
      setPendingStart(q);
    } else {
      const aIdx = idxOf(pendingStart);
      const bIdx = idxOf(q);
      const lo = Math.min(aIdx, bIdx);
      const hi = Math.min(Math.max(aIdx, bIdx), lo + 4); // max 5 quarters
      onChange(availableQuarters.slice(lo, hi + 1));
      setPendingStart(null);
      setOpen(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setPendingStart(null);
  };

  // Group by year descending
  const years: number[] = [];
  const byYear: Record<number, boolean[]> = {}; // byYear[y][q-1] = available
  for (const q of availableQuarters) {
    const [, yearStr] = q.split(" ");
    const y = Number(yearStr);
    if (!byYear[y]) { byYear[y] = [false, false, false, false]; years.push(y); }
    const qNum = Number(q[1]);
    byYear[y][qNum - 1] = true;
  }
  years.sort((a, b) => b - a);

  const triggerLabel =
    value.length === 0
      ? "Select quarters"
      : value.length === 1
      ? value[0]
      : `${value[value.length - 1]} – ${value[0]}`;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs h-8 font-normal">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b">
            <p className="text-xs font-semibold text-foreground">Quarter Range</p>
            <p className="text-xs text-muted-foreground">
              {pendingStart ? "Select end quarter" : "Select start quarter"}
            </p>
          </div>

          <div className="space-y-1.5">
            {years.map((year) => (
              <div key={year} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-9 shrink-0 font-medium">
                  {year}
                </span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((qNum) => {
                    const label = `Q${qNum} ${year}`;
                    const available = byYear[year]?.[qNum - 1] ?? false;
                    const state = available ? getState(label) : null;
                    return (
                      <button
                        key={qNum}
                        disabled={!available || state === "disabled"}
                        onClick={() => available && state !== "disabled" && handleClick(label)}
                        className={cn(
                          "w-10 h-7 rounded text-xs font-medium transition-colors select-none",
                          !available && "opacity-20 cursor-default text-muted-foreground",
                          available && state === "endpoint" &&
                            "bg-accent text-accent-foreground ring-1 ring-accent",
                          available && state === "in-range" &&
                            "bg-accent/25 text-foreground",
                          available && state === "disabled" &&
                            "opacity-30 cursor-not-allowed text-foreground",
                          available && state === "default" &&
                            "hover:bg-muted text-foreground cursor-pointer",
                        )}
                      >
                        Q{qNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {value.length > 0 && pendingStart === null && (
            <div className="pt-1 border-t">
              <button
                onClick={() => onChange(availableQuarters.slice(0, 5))}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset to recent 5 quarters
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default QuarterRangePicker;
