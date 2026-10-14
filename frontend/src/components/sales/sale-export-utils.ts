import React from "react";
import { SaleItem } from "@/types";
import { saleService } from "@/services/api";
import { printService } from "@/lib/print-service";
import { PrintableInvoice, PrintTemplateFormat } from "./printable-invoice";

export async function printSaleInvoice(sale: SaleItem, template: PrintTemplateFormat = "a4") {
  let fullSale = sale;
  if (!fullSale.items || fullSale.items.length === 0) {
    try {
      const res = await saleService.getSaleById(sale.id);
      if (res?.data) {
        fullSale = res.data;
      }
    } catch (err) {
      console.error("Failed to fetch sale details for printing:", err);
    }
  }
  await printService.printDocument(
    React.createElement(PrintableInvoice, { sale: fullSale, template })
  );
}
