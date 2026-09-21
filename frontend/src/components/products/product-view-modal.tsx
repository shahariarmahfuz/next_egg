"use client";

import { X, Package, Tag, Barcode, AlertTriangle, Layers, Building2 } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-x-hidden">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />

      <div className="relative w-full max-w-[calc(100vw-1.5rem)] sm:max-w-lg min-w-0 max-h-[90vh] overflow-y-auto overflow-x-hidden bg-card border rounded-2xl p-5 sm:p-6 shadow-2xl z-50 animate-in zoom-in-95 duration-200 space-y-5 sm:space-y-6">
        <div className="flex items-start justify-between gap-3 pb-4 border-b">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-foreground break-words min-w-0">{product.name}</h2>
                {product.product_type === "FARM" ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] shrink-0">
                    Farm Product (Tracking Only)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">
                    Normal Product
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground block truncate">{product.product_code}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 -mr-1 -mt-1 h-8 w-8 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Stock Status Warning Banner */}
        {isLowStock && (
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="min-w-0 break-words flex-1">
              Low Stock Alert: Current stock ({product.current_stock} {product.unit}) is at or below minimum threshold ({product.minimum_stock} {product.unit}).
            </span>
          </div>
        )}

        {/* Attribute Cards */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-muted/30 border space-y-1 min-w-0">
            <span className="text-muted-foreground flex items-center gap-1 truncate">
              <Layers className="h-3.5 w-3.5 text-primary shrink-0" /> Category
            </span>
            <span className="font-semibold text-foreground block truncate" title={product.category || "Unassigned"}>
              {product.category || "Unassigned"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border space-y-1 min-w-0">
            <span className="text-muted-foreground flex items-center gap-1 truncate">
              <Building2 className="h-3.5 w-3.5 text-primary shrink-0" /> Brand
            </span>
            <span className="font-semibold text-foreground block truncate" title={product.brand || "Generic"}>
              {product.brand || "Generic"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border space-y-1 min-w-0">
            <span className="text-muted-foreground flex items-center gap-1 truncate">
              <Barcode className="h-3.5 w-3.5 text-primary shrink-0" /> Barcode
            </span>
            <span className="text-foreground block font-mono text-[11px] break-all">
              {product.barcode || "N/A"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border space-y-1 min-w-0">
            <span className="text-muted-foreground flex items-center gap-1 truncate">
              <Tag className="h-3.5 w-3.5 text-primary shrink-0" /> Unit
            </span>
            <span className="font-semibold text-foreground uppercase block truncate">
              {product.unit}
            </span>
          </div>
        </div>

        {/* Inventory Stock & Pricing Breakdown */}
        <div className="p-4 rounded-xl bg-muted/20 border space-y-3 text-xs">
          <div className="flex justify-between items-center gap-2 pb-2 border-b">
            <span className="text-muted-foreground font-medium min-w-0">Opening Stock:</span>
            <span className="shrink-0 font-semibold text-right">{product.opening_stock} {product.unit}</span>
          </div>

          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground font-medium min-w-0">Current Inventory Stock:</span>
            <span className={`shrink-0 font-bold text-right ${isLowStock ? "text-amber-500" : "text-emerald-500"}`}>
              {product.current_stock} {product.unit}
            </span>
          </div>

          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground font-medium min-w-0">Available Stock:</span>
            <span className="shrink-0 font-semibold text-foreground text-right">
              {product.available_stock} {product.unit}
            </span>
          </div>

          {product.product_type !== "FARM" && (
            <>
              <div className="flex justify-between items-center gap-2 pt-2 border-t">
                <span className="text-muted-foreground font-medium min-w-0">Opening Stock Unit Cost:</span>
                <span className="shrink-0 text-foreground text-right">{formatCurrency(product.opening_stock_unit_cost)}</span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground font-medium min-w-0">Selling Price (Retail):</span>
                <span className="shrink-0 font-bold text-primary text-right">{formatCurrency(product.selling_price)}</span>
              </div>
            </>
          )}
        </div>

        {product.notes && (
          <div className="p-3 rounded-xl bg-muted/20 border text-xs space-y-1 min-w-0">
            <span className="font-semibold text-muted-foreground">Notes:</span>
            <p className="text-foreground break-words whitespace-pre-wrap">{product.notes}</p>
          </div>
        )}

        <div className="pt-2 border-t flex flex-wrap gap-2 justify-between items-center text-[11px] text-muted-foreground">
          <span className="truncate min-w-0">Catalog Added: {formatDate(product.created_at)}</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 px-3 ml-auto shrink-0">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
