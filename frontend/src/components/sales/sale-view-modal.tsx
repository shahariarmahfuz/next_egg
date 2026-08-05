"use client";

import Link from "next/link";
import { X, ShoppingCart, User, Printer, Calendar, FileText } from "lucide-react";
import { SaleItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface SaleViewModalProps {
  sale: SaleItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SaleViewModal({ sale, isOpen, onClose }: SaleViewModalProps) {
  if (!isOpen || !sale) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="success" className="capitalize text-[10px]">Paid</Badge>;
      case "partial":
        return <Badge variant="warning" className="capitalize text-[10px]">Partial</Badge>;
      default:
        return <Badge variant="destructive" className="capitalize text-[10px]">Unpaid</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Sale Invoice #{sale.invoice_no}
                {getStatusBadge(sale.payment_status)}
              </h2>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {formatDate(sale.sale_date)}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/sales/${sale.id}/print`}>
                <Printer className="mr-1.5 h-4 w-4 text-primary" />
                Print Studio (A4/A5/POS)
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Customer Information */}
        <div className="p-4 rounded-xl bg-muted/30 border space-y-2 text-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-primary" /> Customer Profile
              </span>
              <div className="font-bold text-sm text-foreground pt-1">{sale.customer?.name || "Walk-in Cash Customer"}</div>
              <div className="text-muted-foreground ">
                {sale.customer?.phone} {sale.customer?.email && `| ${sale.customer.email}`}
              </div>
            </div>
            {sale.customer && (
              <div className="text-right ">
                <span className="text-muted-foreground text-[10px] block">Customer Current Due</span>
                <span className="font-bold text-amber-500">{formatCurrency(sale.customer.current_balance)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="p-3">Product Item</th>
                <th className="p-3 text-center">Qty</th>
                <th className="p-3 text-center">Unit Price</th>
                <th className="p-3 text-center">Discount</th>
                <th className="p-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sale.items.map((item) => (
                <tr key={item.id} className="hover:bg-accent/30">
                  <td className="p-3">
                    <div className="font-bold text-foreground">{item.product?.name || "Product"}</div>
                    <div className="text-[10px] text-muted-foreground ">{item.product?.product_code}</div>
                  </td>
                  <td className="p-3 text-center font-medium">
                    {item.quantity} {item.product?.unit || ""}
                  </td>
                  <td className="p-3 text-center ">{formatCurrency(item.unit_price)}</td>
                  <td className="p-3 text-center text-amber-500">{formatCurrency(item.discount)}</td>
                  <td className="p-3 text-right font-bold text-foreground">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Order Financial Totals */}
        <div className="p-4 rounded-xl bg-muted/20 border space-y-2 text-xs">
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Subtotal:</span>
            <span className="font-semibold text-foreground">{formatCurrency(sale.subtotal)}</span>
          </div>

          {sale.discount_amount > 0 && (
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Order Discount:</span>
              <span className="text-amber-500">-{formatCurrency(sale.discount_amount)}</span>
            </div>
          )}

          {sale.tax_amount > 0 && (
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Tax / Charges:</span>
              <span className="">{formatCurrency(sale.tax_amount)}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t font-bold text-sm">
            <span className="text-foreground">Grand Total:</span>
            <span className="text-primary">{formatCurrency(sale.grand_total)}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t text-xs">
            <span className="text-muted-foreground">Paid Amount:</span>
            <span className="font-bold text-emerald-500">{formatCurrency(sale.paid_amount)}</span>
          </div>

          <div className="flex justify-between items-center font-bold text-xs">
            <span className="text-muted-foreground">Outstanding Due Amount:</span>
            <span className={`${sale.due_amount > 0 ? "text-amber-500" : "text-emerald-500"}`}>
              {formatCurrency(sale.due_amount)}
            </span>
          </div>
        </div>

        {sale.notes && (
          <div className="p-3 rounded-xl bg-muted/20 border text-xs space-y-1">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Notes
            </span>
            <p className="text-foreground">{sale.notes}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t flex justify-between items-center text-xs">
          <span className="text-muted-foreground text-[11px]">Invoice Created: {formatDate(sale.created_at)}</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
