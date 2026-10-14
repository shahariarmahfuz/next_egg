import React from "react";
import { PurchaseItem } from "@/types";
import { purchaseService } from "@/services/api";
import { printService } from "@/lib/print-service";
import { PrintablePurchaseVoucher } from "./printable-purchase-voucher";

export async function printPurchaseVoucher(purchase: PurchaseItem) {
  let fullPurchase = purchase;
  if (!fullPurchase.items || fullPurchase.items.length === 0) {
    try {
      const res = await purchaseService.getPurchaseById(purchase.id);
      if (res?.data) {
        fullPurchase = res.data;
      }
    } catch (err) {
      console.error("Failed to fetch purchase details for printing:", err);
    }
  }
  await printService.printDocument(
    React.createElement(PrintablePurchaseVoucher, { purchase: fullPurchase })
  );
}
