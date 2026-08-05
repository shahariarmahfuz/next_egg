"use client";

import { X, Printer, Calendar, User, Phone, ShoppingCart, FileText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SaleReturnItem } from "@/types";
import { formatCurrency, formatDateTime, printSaleReturnVoucher } from "./sale-return-export-utils";

interface SaleReturnViewModalProps {
  saleReturn: SaleReturnItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SaleReturnViewModal({ saleReturn, isOpen, onClose }: SaleReturnViewModalProps) {
  if (!isOpen || !saleReturn) return null;

  const netCredit = Math.max(0, saleReturn.grand_total - saleReturn.refund_amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30">
                {saleReturn.return_no}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                Invoice: {saleReturn.sale?.invoice_no || "N/A"}
              </Badge>
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">Sale Return Voucher Details</h2>
            <span className="text-xs text-muted-foreground ">
              Recorded on {formatDateTime(saleReturn.return_date)}
            </span>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 py-2">
          {/* Customer & Invoice Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-accent/40 border space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                <User className="h-3.5 w-3.5 text-primary" /> Customer Account
              </span>
              <span className="font-bold text-foreground block">{saleReturn.customer?.name || "N/A"}</span>
            </div>

            <div className="p-3 rounded-xl bg-accent/40 border space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                <ShoppingCart className="h-3.5 w-3.5 text-primary" /> Original Sale Invoice
              </span>
              <span className="font-bold text-primary block">{saleReturn.sale?.invoice_no || "N/A"}</span>
              <span className="text-[10px] text-muted-foreground">
                Collector: {saleReturn.user?.full_name || saleReturn.user?.username || "System User"}
              </span>
            </div>
          </div>

          {/* Returned Items Table */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                  <th className="p-3">Returned Product</th>
                  <th className="p-3 text-center">Quantity Returned</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Total Price</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {saleReturn.items.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/40 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-foreground">{item.product?.name || "Product"}</div>
                      <div className="text-[10px] text-muted-foreground ">{item.product?.product_code}</div>
                    </td>
                    <td className="p-3 text-center font-bold text-amber-500">
                      {item.quantity} {item.product?.unit || "pcs"}
                    </td>
                    <td className="p-3 text-right ">{formatCurrency(item.unit_price)}</td>
                    <td className="p-3 text-right font-bold">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div className="p-4 rounded-xl border bg-amber-500/10 border-amber-500/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium">Total Goods Returned Value:</span>
              <span className="font-bold text-foreground text-sm">{formatCurrency(saleReturn.grand_total)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium">Cash Refund Paid to Customer:</span>
              <span className="font-bold text-amber-600 text-sm">{formatCurrency(saleReturn.refund_amount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold border-t pt-2 border-amber-500/30">
              <span className="text-emerald-600">Net Credit Adjusted Against Customer Due:</span>
              <span className="text-emerald-500 text-base">{formatCurrency(netCredit)}</span>
            </div>
          </div>

          {/* Reason */}
          {saleReturn.reason && (
            <div className="p-3 rounded-lg border bg-card/60 space-y-1">
              <span className="text-xs text-muted-foreground block font-semibold flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-primary" /> Return Reason
              </span>
              <p className="text-xs text-foreground leading-relaxed">{saleReturn.reason}</p>
            </div>
          )}
        </div>

        <div className="border-t pt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => printSaleReturnVoucher(saleReturn)}>
            <Printer className="mr-1.5 h-4 w-4 text-primary" />
            Print Official Voucher
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
