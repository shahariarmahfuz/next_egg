"use client";

import { useState } from "react";
import { X, ShoppingCart, User, Calendar, FileText, Printer, Loader2 } from "lucide-react";
import { SaleItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatNumber } from "@/utils/formatters";
import { printSaleInvoice } from "./sale-export-utils";

interface SaleViewModalProps {
  sale: SaleItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SaleViewModal({ sale, isOpen, onClose }: SaleViewModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !sale) return null;

  const dueAmount = Number(sale.due_amount || 0);
  const paidAmount = Number(sale.paid_amount || 0);
  const grandTotal = Number(sale.grand_total || 0);
  const subtotal = Number(sale.subtotal || 0);
  const discountAmount = Number(sale.discount_amount || 0);
  const taxAmount = Number(sale.tax_amount || 0);

  const isPaid = dueAmount <= 0;
  const isPartial = paidAmount > 0 && dueAmount > 0;
  const hasDiscountOrTax = discountAmount > 0 || taxAmount > 0;

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      await printSaleInvoice(sale);
    } catch (err) {
      console.error("Failed to print sale invoice:", err);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Modal Dialog (Receipt Look) */}
      <div className="relative w-full max-w-lg bg-card border rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* 1. Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b shrink-0 bg-card">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                Sale Invoice Details
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="font-mono bg-muted/80 border px-2 py-0.5 rounded text-[11px] font-medium text-foreground">
                  #{sale.invoice_no}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {isPaid ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold py-0.5 px-2.5">
                Paid
              </Badge>
            ) : isPartial ? (
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-semibold py-0.5 px-2.5">
                Partial Due
              </Badge>
            ) : (
              <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[11px] font-semibold py-0.5 px-2.5">
                Unpaid
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* 2. Combined 2-Column Customer & Date Box */}
          <div className="bg-muted/40 dark:bg-muted/20 border rounded-xl p-3 sm:p-3.5 grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-0.5 min-w-0 pr-2 border-r border-border/60">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                <User className="h-3 w-3 text-primary shrink-0" /> Customer
              </span>
              <div className="font-semibold text-foreground truncate text-xs sm:text-sm">
                {sale.customer?.name || "Walk-in Cash Customer"}
              </div>
              {sale.customer?.phone && (
                <div className="text-[10px] text-muted-foreground truncate">
                  {sale.customer.phone}
                </div>
              )}
            </div>

            <div className="space-y-0.5 min-w-0 pl-1">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                <Calendar className="h-3 w-3 text-primary shrink-0" /> Sale Date
              </span>
              <div className="font-semibold text-foreground text-xs sm:text-sm">
                {formatDate(sale.sale_date)}
              </div>
            </div>
          </div>

          {/* 3. Compact Sold Items List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                Sold Items ({sale.items?.length || 0})
              </span>
            </div>

            <div className="border rounded-xl divide-y divide-dashed divide-border/80 bg-card max-h-[230px] sm:max-h-[260px] overflow-y-auto">
              {!sale.items || sale.items.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No items recorded in this invoice.
                </div>
              ) : (
                sale.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-semibold text-foreground text-xs sm:text-sm leading-snug break-words">
                        {item.product?.name || "Product"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/85">
                          {formatNumber(item.quantity)} {item.product?.unit || "pcs"} × {formatCurrency(item.unit_price)}
                        </span>
                        {item.discount > 0 && (
                          <span className="ml-2 text-amber-600 dark:text-amber-400 text-[10px]">
                            (Disc: -{formatCurrency(item.discount)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm sm:text-base font-bold text-foreground">
                        {formatCurrency(item.total_price)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. Financial Summary */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-muted/25 border space-y-2.5 text-xs">
            {/* Show Subtotal only when discount or tax exists */}
            {hasDiscountOrTax && (
              <>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                    <span>Overall Discount:</span>
                    <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Tax:</span>
                    <span className="font-medium">+{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="border-t border-border/60 my-1" />
              </>
            )}

            {/* Grand Total & Paid Amount in clean, strong typography */}
            <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-foreground">
              <span>Grand Total:</span>
              <span className="text-sm sm:text-base font-bold">{formatCurrency(grandTotal)}</span>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Paid Amount:</span>
              <span className="font-medium text-foreground">{formatCurrency(paidAmount)}</span>
            </div>

            {/* Prominent Highlighted Remaining Due Box */}
            <div
              className={`p-2.5 rounded-lg border flex justify-between items-center text-xs sm:text-sm font-bold ${
                isPaid
                  ? "bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  : isPartial
                  ? "bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/30 text-amber-700 dark:text-amber-400"
                  : "bg-rose-500/10 dark:bg-rose-950/40 border-rose-500/30 text-rose-700 dark:text-rose-400"
              }`}
            >
              <span>Remaining Due:</span>
              <span className="text-sm sm:text-base">
                {formatCurrency(dueAmount)}
                {isPaid && <span className="text-[11px] ml-1.5 font-normal opacity-90">(Fully Paid)</span>}
              </span>
            </div>
          </div>

          {/* Optional Notes */}
          {Boolean(sale.notes || sale.note) && (
            <div className="p-3 rounded-xl bg-muted/20 border text-xs space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                <FileText className="h-3 w-3 text-primary shrink-0" /> Note
              </span>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed break-words text-[11px]">
                {sale.notes || sale.note}
              </p>
            </div>
          )}
        </div>

        {/* 5. Fixed Sticky Footer */}
        <div className="p-3.5 sm:p-4 border-t bg-muted/15 shrink-0 flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground truncate">
            Invoice Created: {formatDate(sale.created_at)}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="gap-1.5 h-8 px-2.5 sm:px-3 text-xs"
            >
              {isPrinting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span>Print</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onClose}
              className="h-8 px-3 text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
