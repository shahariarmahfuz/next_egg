"use client";

import { X, ShoppingBag, Truck, User, Calendar, FileText, DollarSign, CheckCircle2, Clock } from "lucide-react";
import { PurchaseItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface PurchaseViewModalProps {
  purchase: PurchaseItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PurchaseViewModal({ purchase, isOpen, onClose }: PurchaseViewModalProps) {
  if (!isOpen || !purchase) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Purchase Order #{purchase.purchase_no}</h2>
              {purchase.invoice_no && (
                <div className="text-xs text-muted-foreground">Supplier Invoice: {purchase.invoice_no}</div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Vendor & General Metadata */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Truck className="h-3.5 w-3.5 text-primary" /> Supplier
            </span>
            <span className="font-semibold text-foreground block">
              {purchase.supplier?.name || "Supplier"}
            </span>
            <span className="text-[11px] text-muted-foreground block">
              {purchase.supplier?.phone}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Purchase Date
            </span>
            <span className="font-semibold text-foreground block">
              {formatDate(purchase.purchase_date)}
            </span>
          </div>
        </div>

        {/* Purchased Products Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Purchased Items</h3>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Code</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchase.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-medium text-foreground">
                      {item.product?.name || "Product"}
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground">
                      {item.product?.product_code || "-"}
                    </td>
                    <td className="p-3 text-right font-bold">
                      {item.quantity} {item.product?.unit || "pcs"}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="p-3 text-right font-bold text-foreground">
                      {formatCurrency(item.total_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-4 rounded-xl bg-muted/20 border space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="">{formatCurrency(purchase.subtotal)}</span>
          </div>
          {purchase.discount_amount > 0 && (
            <div className="flex justify-between text-amber-500">
              <span>Overall Discount:</span>
              <span className="">-{formatCurrency(purchase.discount_amount)}</span>
            </div>
          )}
          {purchase.tax_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax Amount:</span>
              <span className="">+{formatCurrency(purchase.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t pt-2">
            <span>Grand Total:</span>
            <span className="text-primary">{formatCurrency(purchase.grand_total)}</span>
          </div>
          <div className="flex justify-between text-emerald-500">
            <span>Paid Amount:</span>
            <span className="">{formatCurrency(purchase.paid_amount)}</span>
          </div>
          <div className="flex justify-between font-bold text-amber-500 border-t pt-1">
            <span>Remaining Due:</span>
            <span className="">{formatCurrency(purchase.due_amount)}</span>
          </div>
        </div>

        {purchase.notes && (
          <div className="p-3 rounded-xl bg-muted/20 border text-xs space-y-1">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Notes
            </span>
            <p className="text-foreground">{purchase.notes}</p>
          </div>
        )}

        <div className="pt-2 border-t flex justify-between items-center text-[11px] text-muted-foreground">
          <span>Processed: {formatDate(purchase.created_at)}</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
