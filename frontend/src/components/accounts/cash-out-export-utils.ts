import React from "react";
import { CashOutReportItem, CashOutItem, CashOutReportData } from "@/types";
import { cashOutService } from "@/services/api";
import { printService } from "@/lib/print-service";
import { PrintableCashOutVoucher } from "./printable-cash-out-voucher";
import { PrintableCashOutReport } from "./printable-cash-out-report";

export async function printCashOutVoucher(cashOut: CashOutReportItem | CashOutItem) {
  let fullCashOut = cashOut;
  if (!fullCashOut.created_by_name) {
    try {
      const res = await cashOutService.getCashOut(cashOut.id);
      if (res?.data) {
        fullCashOut = res.data;
      }
    } catch (err) {
      console.error("Failed to fetch cash out details for printing:", err);
    }
  }
  await printService.printDocument(
    React.createElement(PrintableCashOutVoucher, { cashOut: fullCashOut })
  );
}

export async function printCashOutReport(report: CashOutReportData) {
  await printService.printDocument(
    React.createElement(PrintableCashOutReport, { report })
  );
}
