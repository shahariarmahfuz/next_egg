"use client";

import React from "react";
import { CashOutReportItem, CashOutItem } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { ReportPrintLayout } from "@/components/print/report-print-layout";

export interface PrintableCashOutVoucherProps {
  cashOut: CashOutReportItem | CashOutItem;
}

export const PrintableCashOutVoucher = React.forwardRef<HTMLDivElement, PrintableCashOutVoucherProps>(
  ({ cashOut }, ref) => {
    const filters = [
      { label: "Voucher No", value: cashOut.cash_out_no },
      { label: "Withdrawal Date", value: formatDateTime(cashOut.cash_out_date) },
      { label: "Category / Reason", value: cashOut.reason },
      { label: "Created By", value: cashOut.created_by_name || "Authorized Staff" },
      { label: "Status", value: "COMPLETED" },
    ];

    const noteText = cashOut.notes || (cashOut as any).note;

    const totalsBlock = (
      <div className="flex justify-end mt-4 mb-2 print-avoid-break">
        <div className="w-80 border border-slate-400 bg-slate-50 text-[11px] rounded overflow-hidden">
          <div className="bg-slate-200 px-3 py-1 font-bold text-slate-900 border-b border-slate-400 uppercase text-[10px]">
            Cash Out Details
          </div>
          <div className="p-3 space-y-1.5">
            <div className="flex justify-between items-center text-xs font-black text-rose-700">
              <span>Total Amount Withdrawn:</span>
              <span className="text-base font-extrabold">{formatCurrency(cashOut.amount)}</span>
            </div>
            <div className="flex justify-between text-slate-600 text-[10px] pt-1 border-t border-slate-200">
              <span>Payment Type:</span>
              <span className="font-semibold text-slate-800">Physical Cash Out</span>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <ReportPrintLayout
        ref={ref}
        title="Cash Out Payment Voucher"
        subtitle="Official Cash Withdrawal Document"
        documentNo={cashOut.cash_out_no}
        filters={filters}
        totals={totalsBlock}
        showSignatures={true}
        signatureTitles={["Authorized By / Cashier", "Receiver Signature"]}
        paperSize="a5"
      >
        <div className="border border-slate-300 rounded overflow-hidden my-3">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <th className="py-2 px-3 w-16">Item</th>
                <th className="py-2 px-3">Description / Purpose</th>
                <th className="py-2 px-3 w-32">Category</th>
                <th className="py-2 px-3 text-right w-36">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 px-3 font-mono font-medium">1</td>
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-slate-900">{cashOut.reason}</div>
                  {noteText && <div className="text-[10px] text-slate-500 mt-0.5">{noteText}</div>}
                </td>
                <td className="py-2.5 px-3 text-slate-700">{cashOut.reason}</td>
                <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                  {formatCurrency(cashOut.amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {noteText && (
          <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700">
            <span className="font-bold text-slate-900">Notes / Remarks: </span>
            {noteText}
          </div>
        )}
      </ReportPrintLayout>
    );
  }
);

PrintableCashOutVoucher.displayName = "PrintableCashOutVoucher";
