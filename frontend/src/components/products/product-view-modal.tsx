"use client";

import { X, Package, Tag, Barcode, DollarSign, AlertTriangle, Layers, Building2 } from "lucide-react";
import { ProductItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface ProductViewModalProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductViewModal({ product, isOpen, onClose }: ProductViewModalProps) {
  if (!isOpen || !product) return null;

  const isLowStock = product.current_stock <= product.minimum_stock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border rounded-2xl p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{product.name}</h2>
              <span className="text-xs text-muted-foreground">{product.product_code}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Stock Status Warning Banner */}
        {isLowStock && (
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Low Stock Alert: Current stock ({product.current_stock} {product.unit}) is at or below minimum threshold ({product.minimum_stock} {product.unit}).
            </span>
          </div>
        )}

        {/* Attribute Cards */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-primary" /> Category
            </span>
            <span className="font-semibold text-foreground block">{product.category || "Unassigned"}</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-primary" /> Brand
            </span>
            <span className="font-semibold text-foreground block">{product.brand || "Generic"}</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Barcode className="h-3.5 w-3.5 text-primary" /> Barcode
            </span>
            <span className="text-foreground block">{product.barcode || "N/A"}</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Tag className="h-3.5 w-3.5 text-primary" /> Unit
            </span>
            <span className="font-semibold text-foreground uppercase block">{product.unit}</span>
          </div>
        </div>

        {/* Inventory Stock & Pricing Breakdown */}
        <div className="p-4 rounded-xl bg-muted/20 border space-y-3 text-xs">
          <div className="flex justify-between items-center pb-2 border-b">
            <span className="text-muted-foreground font-medium">Opening Stock:</span>
            <span className="">{product.opening_stock} {product.unit}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Current Inventory Stock:</span>
            <span className={`font-bold ${isLowStock ? "text-amber-500" : "text-emerald-500"}`}>
              {product.current_stock} {product.unit}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Available Stock:</span>
            <span className="font-semibold text-foreground">
              {product.available_stock} {product.unit}
            </span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-muted-foreground font-medium">Opening Stock Unit Cost:</span>
            <span className="text-foreground">{formatCurrency(product.opening_stock_unit_cost)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Selling Price (Retail):</span>
            <span className="font-bold text-primary">{formatCurrency(product.selling_price)}</span>
          </div>
        </div>

        {product.notes && (
          <div className="p-3 rounded-xl bg-muted/20 border text-xs space-y-1">
            <span className="font-semibold text-muted-foreground">Notes:</span>
            <p className="text-foreground">{product.notes}</p>
          </div>
        )}

        <div className="pt-2 border-t flex justify-between items-center text-[11px] text-muted-foreground">
          <span>Catalog Added: {formatDate(product.created_at)}</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
