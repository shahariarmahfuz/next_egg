"use client";

import { X, Printer, User, Phone, ShoppingBag, FileText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductReturnItem } from "@/types";
import { formatCurrency, formatDateTime, printProductReturnVoucher } from "./product-return-export-utils";

interface ProductReturnViewModalProps {
  productReturn: ProductReturnItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductReturnViewModal({ productReturn, isOpen, onClose }: ProductReturnViewModalProps) {
  if (!isOpen || !productReturn) return null;

  const netDebtReduction = Math.max(0, productReturn.grand_total - productReturn.refund_received);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                {productReturn.return_no}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                PO: {productReturn.purchase?.purchase_no || productReturn.purchase?.invoice_no || "N/A"}
              </Badge>
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">Product Return Voucher Details</h2>
            <span className="text-xs text-muted-foreground ">
              Recorded on {formatDateTime(productReturn.return_date)}
            </span>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 py-2">
          {/* Supplier & Purchase Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-accent/40 border space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                <User className="h-3.5 w-3.5 text-primary" /> Supplier Account
              </span>
              <span className="font-bold text-foreground block">{productReturn.supplier?.name || "N/A"}</span>
              <span className="text-[10px] text-muted-foreground ">
                {productReturn.supplier?.supplier_code} • {productReturn.supplier?.phone}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-accent/40 border space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" /> Purchase Order
              </span>
              <span className="font-bold text-primary block">
                {productReturn.purchase?.purchase_no || productReturn.purchase?.invoice_no || "N/A"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Processed By: {productReturn.user?.full_name || productReturn.user?.username || "System User"}
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
                  <th className="p-3 text-right">Return Price</th>
                  <th className="p-3 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {productReturn.items.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/40 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-foreground">{item.product?.name || "Product"}</div>
                      <div className="text-[10px] text-muted-foreground ">{item.product?.product_code}</div>
                    </td>
                    <td className="p-3 text-center font-bold text-blue-500">
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
          <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium">Total Product Return Value:</span>
              <span className="font-bold text-foreground text-sm">{formatCurrency(productReturn.grand_total)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium">Cash Refund Received from Supplier:</span>
              <span className="font-bold text-blue-600 text-sm">{formatCurrency(productReturn.refund_received)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold border-t pt-2 border-blue-500/30">
              <span className="text-blue-600">Net Reduction in Supplier Due Balance:</span>
              <span className="text-blue-500 text-base">{formatCurrency(netDebtReduction)}</span>
            </div>
          </div>

          {/* Reason */}
          {productReturn.reason && (
            <div className="p-3 rounded-lg border bg-card/60 space-y-1">
              <span className="text-xs text-muted-foreground block font-semibold flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-primary" /> Return Reason & Notes
              </span>
              <p className="text-xs text-foreground leading-relaxed">{productReturn.reason}</p>
            </div>
          )}
        </div>

        <div className="border-t pt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => printProductReturnVoucher(productReturn)}>
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
