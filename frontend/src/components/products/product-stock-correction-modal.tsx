import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productService } from "@/services/api";
import { ProductItem } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ProductStockCorrectionModalProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductStockCorrectionModal({
  product,
  isOpen,
  onClose,
}: ProductStockCorrectionModalProps) {
  const queryClient = useQueryClient();
  const [actualStock, setActualStock] = useState<string>("");

  useEffect(() => {
    if (product && isOpen) {
      setActualStock(product.current_stock.toString());
    }
  }, [product, isOpen]);

  const mutation = useMutation({
    mutationFn: (newStock: number) =>
      productService.correctStock(product!.id, { actual_stock: newStock }),
    onSuccess: () => {
      toast.success("Stock updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        "Failed to update stock.";
      toast.error(msg);
    },
  });

  const handleSave = () => {
    if (!product) return;
    const stockValue = parseFloat(actualStock);
    if (isNaN(stockValue) || stockValue < 0) {
      toast.error("Please enter a valid non-negative number.");
      return;
    }
    mutation.mutate(stockValue);
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Correct Stock</DialogTitle>
          <DialogDescription>
            Directly update the current physical stock for this product.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Product</Label>
            <div className="col-span-3 font-medium">{product.name}</div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Current Stock</Label>
            <div className="col-span-3">
              {product.current_stock} {product.unit}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="actualStock" className="text-right">
              Actual Stock
            </Label>
            <Input
              id="actualStock"
              type="number"
              min="0"
              step="any"
              value={actualStock}
              onChange={(e) => setActualStock(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
