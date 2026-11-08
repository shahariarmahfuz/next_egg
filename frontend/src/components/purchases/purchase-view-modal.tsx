"use client";

import { X, ShoppingBag, Truck, Calendar, FileText } from "lucide-react";
import { PurchaseItem } from "@/types";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface PurchaseViewModalProps {
  purchase: PurchaseItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PurchaseViewModal({ purchase, isOpen, onClose }: PurchaseViewModalProps) {
  if (!isOpen || !purchase) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-card border rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-4 sm:space-y-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold shrink-0">
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                Purchase Order #{purchase.purchase_no}
              </h2>
              {purchase.invoice_no && (
                <div className="text-xs text-muted-foreground truncate">Supplier Invoice: {purchase.invoice_no}</div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8 sm:h-9 sm:w-9">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Vendor & General Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 text-xs">
          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1 font-medium">
              <Truck className="h-3.5 w-3.5 text-primary shrink-0" /> Supplier
            </span>
            <span className="font-semibold text-foreground block truncate">
              {purchase.supplier?.name || "Supplier"}
            </span>
            {purchase.supplier?.phone && (
              <span className="text-[11px] text-muted-foreground block truncate">
                {purchase.supplier.phone}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1 font-medium">
              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" /> Purchase Date
            </span>
            <span className="font-semibold text-foreground block">
              {formatDate(purchase.purchase_date)}
            </span>
          </div>
        </div>

        {/* Purchased Products Table & Mobile Cards */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Purchased Items ({purchase.items?.length || 0})
          </h3>

          {/* Mobile Card Layout (<sm view) */}
          <div className="sm:hidden divide-y divide-border border rounded-xl overflow-hidden bg-card">
            {!purchase.items || purchase.items.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">No items in this purchase order.</div>
            ) : (
              purchase.items.map((item) => (
                <div key={item.id} className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground leading-snug break-words">
                        {item.product?.name || "Product"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Code: {item.product?.product_code || "-"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-foreground">{formatCurrency(item.total_price)}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] bg-muted/40 px-2.5 py-1.5 rounded-lg border">
                    <span className="text-muted-foreground">
                      Qty: <span className="font-semibold text-foreground">{item.quantity} {item.product?.unit || "pcs"}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Rate: <span className="font-semibold text-foreground">{formatCurrency(item.unit_price)}</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (>=sm view with horizontal scroll protection) */}
          <div className="hidden sm:block border rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[500px]">
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
                {purchase.items?.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">
                      {item.product?.name || "Product"}
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground">
                      {item.product?.product_code || "-"}
                    </td>
                    <td className="p-3 text-right font-bold whitespace-nowrap">
                      {item.quantity} {item.product?.unit || "pcs"}
                    </td>
                    <td className="p-3 text-right text-muted-foreground whitespace-nowrap">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="p-3 text-right font-bold text-foreground whitespace-nowrap">
                      {formatCurrency(item.total_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-muted/20 border space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">{formatCurrency(purchase.subtotal)}</span>
          </div>
          {purchase.discount_amount > 0 && (
            <div className="flex justify-between text-amber-500">
              <span>Overall Discount:</span>
              <span className="font-medium">-{formatCurrency(purchase.discount_amount)}</span>
            </div>
          )}
          {purchase.tax_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax Amount:</span>
              <span className="font-medium">+{formatCurrency(purchase.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t pt-2">
            <span>Grand Total:</span>
            <span className="text-primary">{formatCurrency(purchase.grand_total)}</span>
          </div>
          <div className="flex justify-between text-emerald-500">
            <span>Paid Amount:</span>
            <span className="font-medium">{formatCurrency(purchase.paid_amount)}</span>
          </div>
          <div className="flex justify-between font-bold text-amber-500 border-t pt-1">
            <span>Remaining Due:</span>
            <span className="font-medium">{formatCurrency(purchase.due_amount)}</span>
          </div>
        </div>

        {Boolean(purchase.notes || (purchase as any).note) && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-1.5">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" /> Note
            </span>
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed break-words">
              {purchase.notes || (purchase as any).note}
            </p>
          </div>
        )}

        <div className="pt-2 border-t flex justify-between items-center text-[11px] text-muted-foreground">
          <span className="truncate mr-2">Processed: {formatDate(purchase.created_at)}</span>
          <Button variant="outline" size="sm" onClick={onClose} className="shrink-0 h-8 px-3">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
