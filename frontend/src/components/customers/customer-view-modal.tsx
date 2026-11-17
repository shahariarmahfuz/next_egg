"use client";

import { X, Users, Phone, MapPin, FileText, ShieldCheck, BookOpen } from "lucide-react";
import { CustomerItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface CustomerViewModalProps {
  customer: CustomerItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerViewModal({ customer, isOpen, onClose }: CustomerViewModalProps) {
  if (!isOpen || !customer) return null;

  const balance = customer.current_balance;
  const balanceColor =
    balance > 0
      ? "text-amber-600 dark:text-amber-400"
      : balance < 0
      ? "text-blue-600 dark:text-blue-400"
      : "text-emerald-600 dark:text-emerald-400";
  const balanceLabel = balance > 0 ? "(Due)" : balance < 0 ? "(Advance)" : "(Paid)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-card border rounded-2xl p-4 sm:p-5 shadow-2xl z-50 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight break-words">
                  {customer.name}
                </h2>
                <Badge
                  variant={customer.status === "active" ? "success" : "secondary"}
                  className="capitalize text-[10px] py-0 px-1.5 h-4.5 shrink-0"
                >
                  {customer.status}
                </Badge>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                {customer.customer_code}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 shrink-0 -mr-1 -mt-1"
            aria-label="Close customer profile"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Contact & Physical Page Details */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-muted/30 border space-y-1 min-w-0">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3 text-primary shrink-0" /> Phone
            </span>
            <span className="font-semibold text-foreground block truncate">
              {customer.phone || "N/A"}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-muted/30 border space-y-1 min-w-0">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <BookOpen className="h-3 w-3 text-primary shrink-0" /> Physical Page No.
            </span>
            {customer.physical_page_number ? (
              <Badge
                variant="outline"
                className="font-semibold text-xs px-2 py-0 bg-primary/10 text-primary border-primary/30"
              >
                {customer.physical_page_number}
              </Badge>
            ) : (
              <span className="font-medium text-muted-foreground block">N/A</span>
            )}
          </div>

          <div className="col-span-2 p-2.5 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary shrink-0" /> Address
            </span>
            <span className="font-medium text-foreground block break-words">
              {customer.address || "No address on file."}
            </span>
          </div>

          {customer.nid && (
            <div className="col-span-2 p-2.5 rounded-xl bg-muted/30 border space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-primary shrink-0" /> NID / Tax ID
              </span>
              <span className="font-medium text-foreground block break-words">
                {customer.nid}
              </span>
            </div>
          )}
        </div>

        {/* Financial Due Summary */}
        <div className="p-3.5 rounded-xl bg-muted/20 border flex items-center justify-between gap-2 text-xs">
          <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
            Current Balance
          </span>
          <div className={`text-sm sm:text-base font-extrabold tabular-nums ${balanceColor}`}>
            {balance < 0 && "-"}
            {formatCurrency(Math.abs(balance))}
            <span className="text-[11px] ml-1 font-semibold">{balanceLabel}</span>
          </div>
        </div>

        {customer.notes && (
          <div className="p-2.5 rounded-xl bg-muted/20 border text-xs space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> Notes
            </span>
            <p className="text-foreground break-words leading-relaxed">{customer.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2.5 border-t flex justify-between items-center text-[11px] text-muted-foreground">
          <span>Registered: {formatDate(customer.created_at)}</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 px-3 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
