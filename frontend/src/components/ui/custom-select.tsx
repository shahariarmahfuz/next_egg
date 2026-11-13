"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface CustomSelectOption {
  value: string;
  label: string;
  keywords?: string;
}

export interface CustomSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  searchable?: boolean;
  disabled?: boolean;
  portal?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  ariaLabel?: string;
  icon?: React.ReactNode;
}

export function CustomSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  searchable,
  disabled = false,
  portal = true,
  className,
  triggerClassName,
  contentClassName,
  ariaLabel,
  icon,
}: CustomSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const showSearch = searchable ?? options.length > 5;

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filteredOptions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.keywords && opt.keywords.toLowerCase().includes(q))
    );
  }, [options, search]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
    }
  };

  const contentNode = (
    <PopoverPrimitive.Content
      align="start"
      sideOffset={4}
      className={cn(
        "z-50 w-[max(var(--radix-popover-trigger-width),12.5rem)] max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-0 text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        contentClassName
      )}
    >
      <Command shouldFilter={false}>
        {showSearch && (
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
        )}
        <CommandList className="max-h-64">
          {filteredOptions.length === 0 ? (
            <CommandEmpty>{emptyText}</CommandEmpty>
          ) : (
            <CommandGroup>
              {filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.value}`}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "py-2.5 px-3 cursor-pointer text-xs flex items-center justify-between gap-2",
                      isSelected && "bg-accent/70 font-semibold text-foreground"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </PopoverPrimitive.Content>
  );

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-9 px-3 text-xs font-medium bg-background border-input hover:bg-accent/40 rounded-lg",
              !selectedOption && "text-muted-foreground font-normal",
              triggerClassName
            )}
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              {icon ?? (showSearch ? <Search className="h-3.5 w-3.5 shrink-0 opacity-60" /> : null)}
              <span className="truncate">
                {selectedOption ? selectedOption.label : placeholder}
              </span>
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {portal ? (
          <PopoverPrimitive.Portal>{contentNode}</PopoverPrimitive.Portal>
        ) : (
          contentNode
        )}
      </Popover>
    </div>
  );
}
