"use client";

import React from "react";
import { DailyCashReportData } from "@/types";
import { formatCurrency, formatNumber, formatDate } from "@/utils/formatters";
import { useSettingsStore } from "@/store/settings";

export interface PrintableCashReportProps {
  report: DailyCashReportData;
}

export const PrintableCashReport = React.forwardRef<
  HTMLDivElement,
  PrintableCashReportProps
>(({ report }, ref) => {
  const { settings } = useSettingsStore();

  const businessName =
    report.company_name || settings.business_name || "BUSINESS MANAGEMENT SYSTEM";
  const businessAddress =
    report.company_address || settings.business_address || "";
  const businessPhone =
    report.company_phone || settings.business_phone || "";
  const currencySymbol = settings.currency?.symbol || "৳";

  const { breakdown } = report;
  const cashSales = breakdown?.cash_sales || [];
  const customerCollections = breakdown?.customer_collections || [];
  const cashOuts = breakdown?.cash_outs || [];
  const expenses = breakdown?.expenses || [];

  return (
    <div
      ref={ref}
      className="printable-cash-report font-sans text-gray-900 bg-white p-6 max-w-[210mm] mx-auto text-xs leading-tight print:p-2 print:m-0 print:max-w-none print:w-full"
    >
      {/* 1. BUSINESS HEADER */}
      <header className="border-b-2 border-gray-900 pb-3 mb-4 flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">
            {businessName}
          </h1>
          {businessAddress && (
            <p className="text-[11px] text-gray-600 mt-0.5">{businessAddress}</p>
          )}
          {businessPhone && (
            <p className="text-[11px] text-gray-600">Phone / Mobile: {businessPhone}</p>
          )}
        </div>
        <div className="text-right">
          <div className="inline-block bg-gray-900 text-white font-bold text-xs uppercase px-2.5 py-1 rounded">
            Daily Cash Report
          </div>
          <p className="text-[11px] font-semibold text-gray-800 mt-1">
            Period: <span className="font-mono">{report.target_date}</span>
          </p>
          <p className="text-[10px] text-gray-500">
            Timezone: {report.timezone}
          </p>
        </div>
      </header>

      {/* 2. FINANCIAL SUMMARY CARDS */}
      <section className="mb-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-1.5 border-b border-gray-300 pb-0.5">
          Executive Cash Flow Summary (ক্যাশ ফ্লো সারসংক্ষেপ)
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {/* Cash In Box */}
          <div className="border border-emerald-600 bg-emerald-50/50 rounded p-2.5">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-emerald-900 uppercase text-[11px]">
                Total Cash In (মোট প্রাপ্তি)
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                + Inflow
              </span>
            </div>
            <div className="text-base font-extrabold text-emerald-800 font-mono">
              {formatCurrency(report.total_cash_in)}
            </div>
            <div className="mt-1 pt-1 border-t border-emerald-200 text-[10px] text-emerald-900 space-y-0.5">
              <div className="flex justify-between">
                <span>Cash Sales ({cashSales.length}):</span>
                <span className="font-mono font-medium">{formatCurrency(report.cash_sales_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Due Collections ({customerCollections.length}):</span>
                <span className="font-mono font-medium">{formatCurrency(report.customer_collections_amount)}</span>
              </div>
            </div>
          </div>

          {/* Cash Out Box */}
          <div className="border border-rose-600 bg-rose-50/50 rounded p-2.5">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-rose-900 uppercase text-[11px]">
                Total Cash Out (মোট প্রদান)
              </span>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1 rounded">
                - Outflow
              </span>
            </div>
            <div className="text-base font-extrabold text-rose-800 font-mono">
              {formatCurrency(report.total_cash_out)}
            </div>
            <div className="mt-1 pt-1 border-t border-rose-200 text-[10px] text-rose-900 space-y-0.5">
              <div className="flex justify-between">
                <span>Cash Out / Withdrawal ({cashOuts.length}):</span>
                <span className="font-mono font-medium">{formatCurrency(report.cash_out_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Expenses ({expenses.length}):</span>
                <span className="font-mono font-medium">{formatCurrency(report.expenses_amount)}</span>
              </div>
            </div>
          </div>

          {/* Net Remaining Cash Box */}
          <div
            className={`border rounded p-2.5 ${
              report.remaining_cash >= 0
                ? "border-blue-600 bg-blue-50/50 text-blue-950"
                : "border-red-600 bg-red-50/50 text-red-950"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold uppercase text-[11px]">
                Net Remaining Cash (অবশিষ্ট ব্যালেন্স)
              </span>
              <span
                className={`text-[10px] font-bold px-1 rounded ${
                  report.remaining_cash >= 0
                    ? "text-blue-700 bg-blue-100"
                    : "text-red-700 bg-red-100"
                }`}
              >
                {report.remaining_cash >= 0 ? "Surplus" : "Deficit"}
              </span>
            </div>
            <div
              className={`text-base font-extrabold font-mono ${
                report.remaining_cash >= 0 ? "text-blue-800" : "text-red-800"
              }`}
            >
              {formatCurrency(report.remaining_cash)}
            </div>
            <div className="mt-1 pt-1 border-t border-gray-200 text-[10px] space-y-0.5 text-gray-700">
              <div className="flex justify-between">
                <span>Total Cash In:</span>
                <span className="font-mono font-medium text-emerald-700">+{formatCurrency(report.total_cash_in)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Cash Out:</span>
                <span className="font-mono font-medium text-rose-700">-{formatCurrency(report.total_cash_out)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CASH INFLOW DETAILS */}
      <section className="mb-5">
        <div className="flex items-center justify-between border-b-2 border-emerald-700 pb-1 mb-2">
          <h3 className="font-bold text-xs uppercase tracking-wide text-emerald-900">
            1. Cash Inflow Breakdown (নগদ প্রাপ্তি বিবরণী)
          </h3>
          <span className="font-mono font-bold text-emerald-800 text-xs">
            Subtotal: {formatCurrency(report.total_cash_in)}
          </span>
        </div>

        {/* 1A. Cash Sales Table */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1 bg-emerald-100/60 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-900">
            <span>A. Today's Cash Sales (নগদ বিক্রয়)</span>
            <span>Total: {formatCurrency(report.cash_sales_amount)}</span>
          </div>
          {cashSales.length === 0 ? (
            <p className="text-[10px] text-gray-500 italic py-1 px-2">No cash sales recorded for this period.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300 text-[10px]">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 px-1.5 py-1 w-8 text-center">#</th>
                  <th className="border border-gray-300 px-1.5 py-1">Invoice No</th>
                  <th className="border border-gray-300 px-1.5 py-1">Customer</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-right">Grand Total</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-right bg-emerald-50 text-emerald-900 font-bold">
                    Paid (Cash In)
                  </th>
                  <th className="border border-gray-300 px-1.5 py-1 text-right">Due</th>
                  <th className="border border-gray-300 px-1.5 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {cashSales.map((s, idx) => (
                  <tr key={s.id} className={idx % 2 === 1 ? "bg-gray-50/50" : ""}>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-center">{idx + 1}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 font-mono">{s.invoice_no}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5">{s.customer_name}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-right font-mono">{formatNumber(s.grand_total)}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30">
                      {formatNumber(s.paid_amount)}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-right font-mono text-gray-600">
                      {formatNumber(s.due_amount)}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-0.5 capitalize text-[9px] text-gray-600">{s.payment_status}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold bg-gray-100">
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-1.5 py-1 text-right">
                    Total Cash Sales:
                  </td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono text-emerald-900 bg-emerald-100/50">
                    {currencySymbol} {formatNumber(report.cash_sales_amount)}
                  </td>
                  <td colSpan={2} className="border border-gray-300"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* 1B. Customer Collections Table */}
        <div>
          <div className="flex justify-between items-center mb-1 bg-emerald-100/60 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-900">
            <span>B. Today's Customer Due Collections (বাকি আদায়)</span>
            <span>Total: {formatCurrency(report.customer_collections_amount)}</span>
          </div>
          {customerCollections.length === 0 ? (
            <p className="text-[10px] text-gray-500 italic py-1 px-2">No customer collections recorded for this period.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300 text-[10px]">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 px-1.5 py-1 w-8 text-center">#</th>
                  <th className="border border-gray-300 px-1.5 py-1">Receipt / Voucher</th>
                  <th className="border border-gray-300 px-1.5 py-1">Customer</th>
                  <th className="border border-gray-300 px-1.5 py-1">Method</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-right bg-emerald-50 text-emerald-900 font-bold">
                    Collected Amount
                  </th>
                  <th className="border border-gray-300 px-1.5 py-1">Notes / Ref</th>
                </tr>
              </thead>
              <tbody>
                {customerCollections.map((c, idx) => (
                  <tr key={c.id} className={idx % 2 === 1 ? "bg-gray-50/50" : ""}>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-center">{idx + 1}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 font-mono">{c.collection_no}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5">{c.customer_name}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 capitalize text-gray-600">{c.payment_method}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30">
                      {formatNumber(c.amount)}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-gray-600">{c.notes || c.reference_no || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold bg-gray-100">
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-1.5 py-1 text-right">
                    Total Collections:
                  </td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono text-emerald-900 bg-emerald-100/50">
                    {currencySymbol} {formatNumber(report.customer_collections_amount)}
                  </td>
                  <td className="border border-gray-300"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>

      {/* 4. CASH OUTFLOW DETAILS */}
      <section className="mb-5">
        <div className="flex items-center justify-between border-b-2 border-rose-700 pb-1 mb-2">
          <h3 className="font-bold text-xs uppercase tracking-wide text-rose-900">
            2. Cash Outflow Breakdown (নগদ প্রদান বিবরণী)
          </h3>
          <span className="font-mono font-bold text-rose-800 text-xs">
            Subtotal: {formatCurrency(report.total_cash_out)}
          </span>
        </div>

        {/* 2A. Cash Out / Withdrawals Table */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1 bg-rose-100/60 px-2 py-0.5 rounded text-[10px] font-bold text-rose-900">
            <span>A. Today's Cash Out / Deposits (ক্যাশ আউট / উত্তোলন)</span>
            <span>Total: {formatCurrency(report.cash_out_amount)}</span>
          </div>
          {cashOuts.length === 0 ? (
            <p className="text-[10px] text-gray-500 italic py-1 px-2">No cash withdrawals recorded for this period.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300 text-[10px]">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 px-1.5 py-1 w-8 text-center">#</th>
                  <th className="border border-gray-300 px-1.5 py-1">Voucher No</th>
                  <th className="border border-gray-300 px-1.5 py-1">Reason / Purpose</th>
                  <th className="border border-gray-300 px-1.5 py-1">Authorized By</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-right bg-rose-50 text-rose-900 font-bold">
                    Amount (Cash Out)
                  </th>
                  <th className="border border-gray-300 px-1.5 py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {cashOuts.map((co, idx) => (
                  <tr key={co.id} className={idx % 2 === 1 ? "bg-gray-50/50" : ""}>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-center">{idx + 1}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 font-mono">{co.cash_out_no}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 font-medium">{co.reason}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-gray-600">{co.created_by_name || "—"}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-right font-mono font-bold text-rose-800 bg-rose-50/30">
                      {formatNumber(co.amount)}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-gray-600">{co.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold bg-gray-100">
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-1.5 py-1 text-right">
                    Total Cash Out:
                  </td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono text-rose-900 bg-rose-100/50">
                    {currencySymbol} {formatNumber(report.cash_out_amount)}
                  </td>
                  <td className="border border-gray-300"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* 2B. Expenses Table */}
        <div>
          <div className="flex justify-between items-center mb-1 bg-rose-100/60 px-2 py-0.5 rounded text-[10px] font-bold text-rose-900">
            <span>B. Today's Expenses (দৈনন্দিন খরচ)</span>
            <span>Total: {formatCurrency(report.expenses_amount)}</span>
          </div>
          {expenses.length === 0 ? (
            <p className="text-[10px] text-gray-500 italic py-1 px-2">No expenses recorded for this period.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300 text-[10px]">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 px-1.5 py-1 w-8 text-center">#</th>
                  <th className="border border-gray-300 px-1.5 py-1">Voucher No</th>
                  <th className="border border-gray-300 px-1.5 py-1">Category</th>
                  <th className="border border-gray-300 px-1.5 py-1">Method</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-right bg-rose-50 text-rose-900 font-bold">
                    Amount
                  </th>
                  <th className="border border-gray-300 px-1.5 py-1">Description</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e, idx) => (
                  <tr key={e.id} className={idx % 2 === 1 ? "bg-gray-50/50" : ""}>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-center">{idx + 1}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 font-mono">{e.voucher_no}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 font-medium">{e.category_name}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 capitalize text-gray-600">{e.payment_method}</td>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-right font-mono font-bold text-rose-800 bg-rose-50/30">
                      {formatNumber(e.amount)}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-0.5 text-gray-600">{e.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold bg-gray-100">
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-1.5 py-1 text-right">
                    Total Expenses:
                  </td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right font-mono text-rose-900 bg-rose-100/50">
                    {currencySymbol} {formatNumber(report.expenses_amount)}
                  </td>
                  <td className="border border-gray-300"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>

      {/* 5. AUTHORIZATION FOOTER */}
      <footer className="mt-8 pt-6 border-t border-gray-400">
        <div className="grid grid-cols-3 text-center text-[10px] text-gray-700">
          <div>
            <div className="w-32 border-b border-gray-400 mx-auto mb-1"></div>
            <span>Prepared By (প্রস্তুতকারী)</span>
          </div>
          <div>
            <div className="w-32 border-b border-gray-400 mx-auto mb-1"></div>
            <span>Checked & Verified By (যাচাইকারী)</span>
          </div>
          <div>
            <div className="w-32 border-b border-gray-400 mx-auto mb-1"></div>
            <span>Authorized Signature (স্বত্বাধিকারী)</span>
          </div>
        </div>
        <div className="text-center text-[9px] text-gray-400 mt-4">
          Report generated automatically by Business Management System • {new Date().toLocaleString()}
        </div>
      </footer>
    </div>
  );
});

PrintableCashReport.displayName = "PrintableCashReport";
