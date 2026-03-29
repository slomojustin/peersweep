import { useState } from "react";
import { MOCK_BANKS, type BankInfo } from "@/data/bankData";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface BankSelectorProps {
  label: string;
  description: string;
  selected: BankInfo[];
  onSelect: (banks: BankInfo[]) => void;
  multiple?: boolean;
  maxSelections?: number;
}

const BankSelector = ({ label, description, selected, onSelect, multiple = false, maxSelections = 25 }: BankSelectorProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (bank: BankInfo) => {
    if (multiple) {
      const isSelected = selected.some(b => b.rssd === bank.rssd);
      if (isSelected) {
        onSelect(selected.filter(b => b.rssd !== bank.rssd));
      } else if (selected.length < maxSelections) {
        onSelect([...selected, bank]);
      }
    } else {
      onSelect([bank]);
      setOpen(false);
    }
  };

  const removeBank = (rssd: string) => {
    onSelect(selected.filter(b => b.rssd !== rssd));
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium text-foreground">{label}</label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[40px] text-left"
          >
            {selected.length === 0 ? (
              <span className="text-muted-foreground">Select bank{multiple ? 's' : ''}...</span>
            ) : !multiple ? (
              <span>{selected[0].name} | {selected[0].rssd} | {selected[0].city}, {selected[0].state}</span>
            ) : (
              <span className="text-muted-foreground">{selected.length} bank{selected.length > 1 ? 's' : ''} selected</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[460px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by name, RSSD, city, or state..." />
            <CommandList>
              <CommandEmpty>No bank found.</CommandEmpty>
              <CommandGroup>
                {MOCK_BANKS.map((bank) => (
                  <CommandItem
                    key={bank.rssd}
                    value={`${bank.name} ${bank.rssd} ${bank.city} ${bank.state}`}
                    onSelect={() => handleSelect(bank)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.some(b => b.rssd === bank.rssd) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-medium">{bank.name}</span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      | {bank.rssd} | {bank.city}, {bank.state}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {multiple && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map((bank) => (
            <Badge key={bank.rssd} variant="secondary" className="gap-1 pr-1">
              {bank.name}
              <button onClick={() => removeBank(bank.rssd)} className="ml-1 rounded-full hover:bg-muted">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default BankSelector;
