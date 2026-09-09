"use client";

import React from "react";
import { Expense } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { ReportPrintLayout } from "@/components/print/report-print-layout";

export interface PrintableExpenseVoucherProps {
  expense: Expense;
}

export const PrintableExpenseVoucher = React.forwardRef<HTMLDivElement, PrintableExpenseVoucherProps>(
  ({ expense }, ref) => {
    const filters = [
      { label: "Expense Category", value: expense.category_name },
      { label: "Expense Date", value: formatDate(expense.expense_date) },
      { label: "Payment Method", value: expense.payment_method?.toUpperCase() || "CASH" },
      { label: "Reference No", value: expense.reference_no || "N/A" },
    ];

    const noteText = expense.notes || (expense as unknown as { note?: string }).note || expense.description;

    return (
      <ReportPrintLayout
        ref={ref}
        title="EXPENSE PAYMENT VOUCHER"
        subtitle="Official Operating Expense Payment Record"
        documentNo={expense.voucher_no}
        filters={filters}
        printedBy={expense.created_by_name}
        showSignatures
        signatureTitles={["Prepared / Paid By", "Authorized Approver"]}
      >
        <div className="space-y-4 my-2">
          {/* Amount Paid Highlight Box */}
          <div className="border-2 border-slate-900 bg-slate-50 p-4 rounded text-center my-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
              Total Amount Paid
            </span>
            <span className="text-2xl font-black text-slate-950 block mt-1">
              {formatCurrency(expense.amount)}
            </span>
          </div>

          {/* Details Table */}
          <table className="w-full border-collapse border border-slate-300 text-[11px] my-3">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Expense Category
                </td>
                <td className="p-2 font-semibold text-slate-900">{expense.category_name}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Expense Date
                </td>
                <td className="p-2 text-slate-800">{formatDate(expense.expense_date)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Payment Method
                </td>
                <td className="p-2 font-semibold text-slate-900">{expense.payment_method?.toUpperCase()}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Transaction / Reference No
                </td>
                <td className="p-2 text-slate-800">{expense.reference_no || "N/A"}</td>
              </tr>
              <tr>
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Created By / Prepared By
                </td>
                <td className="p-2 font-medium text-slate-800">{expense.created_by_name || "System"}</td>
              </tr>
            </tbody>
          </table>

          {/* Note / Description */}
          {Boolean(noteText) && (
            <div className="border border-slate-300 p-3 rounded bg-slate-50 text-[11px] space-y-1">
              <span className="font-bold text-slate-900 block">Note / Description:</span>
              <p className="text-slate-700 whitespace-pre-wrap">{noteText}</p>
            </div>
          )}
        </div>
      </ReportPrintLayout>
    );
  }
);

PrintableExpenseVoucher.displayName = "PrintableExpenseVoucher";
