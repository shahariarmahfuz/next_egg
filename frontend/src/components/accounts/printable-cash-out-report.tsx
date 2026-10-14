"use client";

import React from "react";
import { CashOutReportData } from "@/types";
import { formatCurrency, formatNumber, formatDate, formatDateTime } from "@/utils/formatters";
import { ReportPrintLayout } from "@/components/print/report-print-layout";

export interface PrintableCashOutReportProps {
  report: CashOutReportData;
}

export const PrintableCashOutReport = React.forwardRef<HTMLDivElement, PrintableCashOutReportProps>(
  ({ report }, ref) => {
    const { summary, reasons_breakdown, items } = report;

    const filters = [
      { label: "Date Range", value: `${report.start_date} to ${report.end_date}` },
      { label: "Total Transactions", value: formatNumber(summary.total_cash_outs) },
      { label: "Top Category", value: summary.top_reason || "None" },
      { label: "Timezone", value: report.timezone },
    ];

    const totalsBlock = (
      <div className="flex justify-end mt-4 mb-2 print-avoid-break">
        <div className="w-80 border border-slate-400 bg-slate-50 text-[11px] rounded overflow-hidden">
          <div className="bg-slate-200 px-3 py-1 font-bold text-slate-900 border-b border-slate-400 uppercase text-[10px]">
            Cash Out Executive Summary
          </div>
          <div className="p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Total Vouchers:</span>
              <span className="font-bold text-slate-900">{formatNumber(summary.total_cash_outs)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Average Cash Out:</span>
              <span className="font-bold text-slate-900">{formatCurrency(summary.average_amount)}</span>
            </div>
            {summary.top_reason && (
              <div className="flex justify-between text-slate-700">
                <span className="font-semibold">Top Reason:</span>
                <span className="font-bold text-slate-900 truncate max-w-[140px]">{summary.top_reason}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-400 pt-1.5 text-xs font-black text-rose-700">
              <span>Total Cash Out:</span>
              <span className="text-sm font-extrabold">{formatCurrency(summary.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <ReportPrintLayout
        ref={ref}
        title="Cash Out Report"
        subtitle="Daily & Periodic Cash Out Breakdown & Detailed Transactions"
        filters={filters}
        totals={totalsBlock}
        showSignatures={true}
        signatureTitles={["Prepared By / Cashier", "Manager / Authorized Signature"]}
        paperSize="a4"
      >
        {/* Reasons / Categories Breakdown Table */}
        {reasons_breakdown.length > 0 && (
          <div className="mb-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 border-b border-slate-300 pb-0.5">
              Category Breakdown (ক্যাটাগরি ভিত্তিক সারসংক্ষেপ)
            </div>
            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="py-1.5 px-2.5">Category / Reason</th>
                    <th className="py-1.5 px-2.5 text-center w-20">Vouchers</th>
                    <th className="py-1.5 px-2.5 text-right w-24">Percentage</th>
                    <th className="py-1.5 px-2.5 text-right w-32">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reasons_breakdown.map((r, idx) => (
                    <tr key={idx}>
                      <td className="py-1 px-2.5 font-medium text-slate-900">{r.reason}</td>
                      <td className="py-1 px-2.5 text-center font-mono">{r.count}</td>
                      <td className="py-1 px-2.5 text-right font-mono">{r.percentage}%</td>
                      <td className="py-1 px-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(r.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed Transactions Table */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 border-b border-slate-300 pb-0.5">
            Itemized Transactions (বিস্তারিত ক্যাশ আউট লেনদেন)
          </div>
          <div className="border border-slate-300 rounded overflow-hidden">
            <table className="w-full text-[10px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  <th className="py-1.5 px-2.5 w-10">#</th>
                  <th className="py-1.5 px-2.5 w-24">Voucher No</th>
                  <th className="py-1.5 px-2.5 w-28">Date & Time</th>
                  <th className="py-1.5 px-2.5">Reason / Recipient</th>
                  <th className="py-1.5 px-2.5 w-28">Created By</th>
                  <th className="py-1.5 px-2.5 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500 italic">
                      No cash out transactions found for the selected period.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-1.5 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900">{item.cash_out_no}</td>
                      <td className="py-1.5 px-2.5 text-slate-700">{formatDateTime(item.cash_out_date)}</td>
                      <td className="py-1.5 px-2.5">
                        <div className="font-semibold text-slate-900">{item.reason}</div>
                        {item.notes && <div className="text-[9px] text-slate-500">{item.notes}</div>}
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-700">{item.created_by_name || "—"}</td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-rose-700">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ReportPrintLayout>
    );
  }
);

PrintableCashOutReport.displayName = "PrintableCashOutReport";
