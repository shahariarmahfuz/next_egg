"use client";

import React from "react";
import { SupplierItem, SupplierLedgerSummary, SupplierLedgerTransaction } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { ReportPrintLayout } from "@/components/print/report-print-layout";

export interface PrintableSupplierStatementProps {
  supplier: SupplierItem;
  summary: SupplierLedgerSummary;
  transactions: SupplierLedgerTransaction[];
  startDate?: string;
  endDate?: string;
}

export const PrintableSupplierStatement = React.forwardRef<HTMLDivElement, PrintableSupplierStatementProps>(
  ({ supplier, summary, transactions, startDate, endDate }, ref) => {
    const filters = [
      { label: "Supplier Name", value: supplier.name },
      { label: "Supplier Code", value: supplier.supplier_code },
      { label: "Contact Phone", value: supplier.phone || "N/A" },
      {
        label: "Statement Period",
        value: `${startDate ? formatDate(startDate) : "Beginning of Account"}  to  ${
          endDate ? formatDate(endDate) : "Present Date"
        }`,
      },
    ];

    return (
      <ReportPrintLayout
        ref={ref}
        title="SUPPLIER FINANCIAL LEDGER STATEMENT"
        subtitle="Complete Account Statement & Transaction History"
        filters={filters}
        showSignatures
        signatureTitles={["Supplier Acknowledgment", "Authorized Stamp / Signature"]}
      >
        {/* Supplier & Statement Summary Card */}
        <div className="grid grid-cols-6 gap-2 my-3 print-avoid-break">
          <div className="border border-slate-300 bg-slate-50 p-2 rounded text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 block">
              Opening Due
            </span>
            <span className="text-xs font-extrabold text-slate-900 block mt-0.5">
              {formatCurrency(summary.opening_balance)}
            </span>
          </div>

          <div className="border border-slate-300 bg-slate-50 p-2 rounded text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 block">
              Total Purchases
            </span>
            <span className="text-xs font-extrabold text-blue-700 block mt-0.5">
              {formatCurrency(summary.total_purchases)}
            </span>
          </div>

          <div className="border border-slate-300 bg-slate-50 p-2 rounded text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 block">
              Payments
            </span>
            <span className="text-xs font-extrabold text-emerald-700 block mt-0.5">
              {formatCurrency(summary.total_payments)}
            </span>
          </div>

          <div className="border border-slate-300 bg-slate-50 p-2 rounded text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 block">
              Returns
            </span>
            <span className="text-xs font-extrabold text-purple-700 block mt-0.5">
              {formatCurrency(summary.total_returns)}
            </span>
          </div>

          <div className="border border-slate-300 bg-slate-50 p-2 rounded text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 block">
              Adjustments
            </span>
            <span className="text-xs font-extrabold text-slate-800 block mt-0.5">
              {formatCurrency(summary.manual_adjustments)}
            </span>
          </div>

          <div className="border-2 border-slate-900 bg-amber-50 p-2 rounded text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-800 block">
              Current Due
            </span>
            <span className="text-xs font-black text-amber-900 block mt-0.5">
              {formatCurrency(summary.current_due)}
            </span>
          </div>
        </div>

        {/* Transactions Table */}
        <table className="w-full border-collapse border border-slate-400 text-[10px] my-3">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-400 px-2 py-1.5 text-center w-8 font-bold uppercase text-[9.5px]">
                #
              </th>
              <th className="border border-slate-400 px-2 py-1.5 text-left w-20 font-bold uppercase text-[9.5px]">
                Date
              </th>
              <th className="border border-slate-400 px-2 py-1.5 text-left w-24 font-bold uppercase text-[9.5px]">
                Voucher #
              </th>
              <th className="border border-slate-400 px-2 py-1.5 text-left w-20 font-bold uppercase text-[9.5px]">
                Type
              </th>
              <th className="border border-slate-400 px-2 py-1.5 text-left font-bold uppercase text-[9.5px]">
                Description
              </th>
              <th className="border border-slate-400 px-2 py-1.5 text-right w-20 font-bold uppercase text-[9.5px]">
                Debit
              </th>
              <th className="border border-slate-400 px-2 py-1.5 text-right w-20 font-bold uppercase text-[9.5px]">
                Credit
              </th>
              <th className="border border-slate-400 px-2 py-1.5 text-right w-24 font-bold uppercase text-[9.5px]">
                Running Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, idx) => (
              <tr key={tx.id || idx} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">
                  {idx + 1}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-slate-800 whitespace-nowrap">
                  {formatDate(tx.date)}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 font-bold text-slate-900 whitespace-nowrap">
                  {tx.voucher_no}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 font-semibold text-slate-800 uppercase text-[9px]">
                  {tx.type}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-slate-700 break-words">
                  {tx.description}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-slate-800">
                  {tx.debit > 0 ? formatCurrency(tx.debit) : "-"}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-slate-800">
                  {tx.credit > 0 ? formatCurrency(tx.credit) : "-"}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums whitespace-nowrap font-bold text-slate-950">
                  {formatCurrency(tx.running_balance)}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={8} className="border border-slate-300 p-6 text-center text-slate-500 italic">
                  No ledger transactions recorded for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ReportPrintLayout>
    );
  }
);

PrintableSupplierStatement.displayName = "PrintableSupplierStatement";
