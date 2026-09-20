"use client";

import React from "react";
import { CashBookSummary } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useSettingsStore } from "@/store/settings";
import { useAuth } from "@/providers/auth-provider";

export interface PrintableCashBookStatementProps {
  summary: CashBookSummary;
}

export const PrintableCashBookStatement = React.forwardRef<
  HTMLDivElement,
  PrintableCashBookStatementProps
>(({ summary }, ref) => {
  const { settings } = useSettingsStore();
  const { user } = useAuth();

  const currentUser = user?.full_name || user?.username || "Authorized User";
  const currentPrintTime = formatDateTime(new Date());

  const contactItems = [
    settings.business_address,
    settings.business_phone ? `Tel: ${settings.business_phone}` : null,
  ].filter(Boolean);

  return (
    <div
      ref={ref}
      className="cash-book-print w-full bg-white text-slate-950 font-sans leading-normal p-0 m-0"
    >
      {/* Dedicated A5 Landscape & Thin-Row Print Stylesheet */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: A5 landscape;
              margin: 5mm;
            }

            @media print {
              @page {
                size: A5 landscape;
                margin: 5mm;
              }

              html, body {
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              #print-root {
                display: block !important;
                position: static !important;
                width: 100% !important;
                max-width: none !important;
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                min-height: 0 !important;
              }

              .cash-book-print {
                width: 100% !important;
                max-width: none !important;
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                min-height: 0 !important;
                box-sizing: border-box !important;
                font-family: system-ui, -apple-system, sans-serif !important;
                font-size: 8.5px !important;
                line-height: 1.1 !important;
                color: #000000 !important;
              }

              .cash-book-print * {
                box-sizing: border-box !important;
                page-break-before: auto !important;
                break-before: auto !important;
                page-break-after: auto !important;
                break-after: auto !important;
              }

              /* Compact Header */
              .cash-book-print .print-header {
                margin-bottom: 2.5px !important;
                padding-bottom: 2px !important;
                border-bottom: 1.5px solid #0f172a !important;
                text-align: center !important;
              }

              .cash-book-print .print-header h1 {
                font-size: 13px !important;
                font-weight: 900 !important;
                line-height: 1.1 !important;
                margin: 0 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.05em !important;
              }

              .cash-book-print .print-header p {
                font-size: 8px !important;
                line-height: 1.1 !important;
                margin: 1px 0 0 0 !important;
                color: #475569 !important;
              }

              .cash-book-print .doc-badge {
                display: inline-block !important;
                font-size: 9px !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.05em !important;
                background-color: #f1f5f9 !important;
                border: 0.5px solid #64748b !important;
                padding: 1px 8px !important;
                border-radius: 2px !important;
                margin-top: 2px !important;
              }

              /* Compact Metadata / Filter Bar */
              .cash-book-print .meta-bar {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                font-size: 8px !important;
                line-height: 1.15 !important;
                margin-bottom: 3px !important;
                padding-bottom: 2px !important;
                border-bottom: 0.5px solid #cbd5e1 !important;
              }

              /* Top Financial Summary Cards */
              .cash-book-print .kpi-grid {
                display: grid !important;
                grid-template-columns: repeat(4, 1fr) !important;
                gap: 4px !important;
                margin-bottom: 3.5px !important;
              }

              .cash-book-print .kpi-card {
                padding: 2px 4px !important;
                border: 0.5px solid #cbd5e1 !important;
                border-radius: 2px !important;
                background-color: #f8fafc !important;
                text-align: center !important;
              }

              .cash-book-print .kpi-card.highlight {
                border: 1px solid #047857 !important;
                background-color: #ecfdf5 !important;
              }

              .cash-book-print .kpi-label {
                font-size: 7px !important;
                font-weight: 700 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.04em !important;
                color: #475569 !important;
                display: block !important;
                line-height: 1 !important;
              }

              .cash-book-print .kpi-value {
                font-size: 9.5px !important;
                font-weight: 800 !important;
                display: block !important;
                margin-top: 1px !important;
                line-height: 1.1 !important;
              }

              /* Core Cash Book Table - 100% Full Width */
              .cash-book-print table.cash-book-table {
                width: 100% !important;
                max-width: none !important;
                border-collapse: collapse !important;
                table-layout: fixed !important;
                margin: 0 !important;
                box-sizing: border-box !important;
              }

              .cash-book-print thead {
                display: table-header-group !important;
              }

              .cash-book-print tfoot {
                display: table-footer-group !important;
              }

              .cash-book-print tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              .cash-book-print th,
              .cash-book-print td {
                padding: 2px 3px !important;
                line-height: 1.1 !important;
                font-size: 8.5px !important;
                border: 0.5px solid #94a3b8 !important;
                vertical-align: middle !important;
                box-sizing: border-box !important;
              }

              .cash-book-print th {
                font-weight: 700 !important;
                text-transform: uppercase !important;
                background-color: #f1f5f9 !important;
                padding: 2.5px 3px !important;
              }

              /* Prevent unwanted margin/padding on elements inside table cells */
              .cash-book-print td p,
              .cash-book-print td div,
              .cash-book-print td span {
                margin: 0 !important;
                padding: 0 !important;
                line-height: 1.1 !important;
              }

              /* Preserving financial colors */
              .cash-book-print .debit-cell {
                color: #b91c1c !important;
                font-weight: 600 !important;
                text-align: right !important;
                white-space: nowrap !important;
              }

              .cash-book-print .credit-cell {
                color: #047857 !important;
                font-weight: 600 !important;
                text-align: right !important;
                white-space: nowrap !important;
              }

              .cash-book-print .balance-cell {
                color: #020617 !important;
                font-weight: 700 !important;
                text-align: right !important;
                white-space: nowrap !important;
              }

              /* Table Footer */
              .cash-book-print table.cash-book-table tfoot td {
                padding: 2.5px 3px !important;
                line-height: 1.1 !important;
                font-size: 8.5px !important;
                font-weight: 700 !important;
                background-color: #f8fafc !important;
                border: 0.5px solid #64748b !important;
                border-top: 1px solid #0f172a !important;
              }

              /* Bottom Summary Box */
              .cash-book-print .bottom-summary-box {
                margin-top: 3.5px !important;
                padding: 2.5px 6px !important;
                font-size: 8px !important;
                border: 0.5px solid #cbd5e1 !important;
                border-radius: 2px !important;
                background-color: #f8fafc !important;
              }

              /* Document Running Footer */
              .cash-book-print .print-footer {
                margin-top: 3.5px !important;
                padding-top: 2px !important;
                font-size: 7px !important;
                line-height: 1 !important;
                border-top: 0.5px solid #cbd5e1 !important;
                color: #64748b !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
              }
            }
          `,
        }}
      />

      {/* 1. Header */}
      <header className="print-header mb-1 pb-1 border-b-[1.5px] border-slate-900 text-center">
        <h1 className="text-[13px] font-black uppercase tracking-wider text-slate-950 leading-tight">
          {settings.business_name || "BUSINESS ENTERPRISE HUB"}
        </h1>
        {contactItems.length > 0 && (
          <p className="text-[8px] text-slate-600 mt-0.5 leading-tight">
            {contactItems.join("  •  ")}
          </p>
        )}
        <div className="doc-badge mt-1 inline-block text-[9px] font-black uppercase tracking-wider text-slate-950 bg-slate-100 border border-slate-400 px-2 py-0.5 rounded">
          CASH STATEMENT / CASH BOOK
        </div>
      </header>

      {/* 2. Metadata Bar */}
      <div className="meta-bar flex justify-between items-center text-[8px] mb-1 pb-1 border-b border-slate-200">
        <div className="flex gap-4">
          <span>
            <strong className="font-bold text-slate-900">Date: </strong>
            <span className="text-slate-800 font-semibold">{summary.date}</span>
          </span>
          <span>
            <strong className="font-bold text-slate-900">Timezone: </strong>
            <span className="text-slate-800">{summary.timezone}</span>
          </span>
          <span>
            <strong className="font-bold text-slate-900">Currency: </strong>
            <span className="text-slate-800">{summary.currency_symbol}</span>
          </span>
        </div>
        <div className="flex gap-4">
          <span>
            <strong className="font-bold text-slate-900">Printed: </strong>
            <span className="text-slate-800">{currentPrintTime}</span>
          </span>
          <span>
            <strong className="font-bold text-slate-900">By: </strong>
            <span className="text-slate-800">{currentUser}</span>
          </span>
        </div>
      </div>

      {/* 3. Top Financial Summary Cards */}
      <div className="kpi-grid grid grid-cols-4 gap-1 mb-1">
        <div className="kpi-card border border-slate-300 bg-slate-50 p-1 rounded text-center">
          <span className="kpi-label text-[7px] font-bold uppercase tracking-wider text-slate-600 block leading-tight">
            Previous Balance
          </span>
          <span className="kpi-value text-[9.5px] font-black text-slate-900 block mt-0.5 leading-tight">
            {formatCurrency(summary.previous_balance)}
          </span>
        </div>

        <div className="kpi-card border border-slate-300 bg-slate-50 p-1 rounded text-center">
          <span className="kpi-label text-[7px] font-bold uppercase tracking-wider text-slate-600 block leading-tight">
            Today&apos;s Cash Received
          </span>
          <span className="kpi-value text-[9.5px] font-black text-emerald-700 block mt-0.5 leading-tight">
            {formatCurrency(summary.today_cash_received)}
          </span>
        </div>

        <div className="kpi-card border border-slate-300 bg-slate-50 p-1 rounded text-center">
          <span className="kpi-label text-[7px] font-bold uppercase tracking-wider text-slate-600 block leading-tight">
            Today&apos;s Cash Expense
          </span>
          <span className="kpi-value text-[9.5px] font-black text-rose-700 block mt-0.5 leading-tight">
            {formatCurrency(summary.today_cash_expense)}
          </span>
        </div>

        <div className="kpi-card highlight border border-slate-900 bg-emerald-50 p-1 rounded text-center">
          <span className="kpi-label text-[7px] font-bold uppercase tracking-wider text-slate-900 block leading-tight">
            Cash in Hand
          </span>
          <span className="kpi-value text-[9.5px] font-black text-emerald-900 block mt-0.5 leading-tight">
            {formatCurrency(summary.cash_in_hand)}
          </span>
        </div>
      </div>

      {/* 4. Cash Transactions Table (A5 Landscape Proportions) */}
      <table className="cash-book-table w-full border-collapse border border-slate-400 text-[8.5px] my-0 table-fixed">
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "11%" }} />
        </colgroup>
        <thead className="bg-slate-100">
          <tr>
            <th className="border border-slate-400 px-1 py-[2px] text-center font-bold uppercase text-[8.5px] leading-[1.1] whitespace-nowrap">
              #
            </th>
            <th className="border border-slate-400 px-1 py-[2px] text-left font-bold uppercase text-[8.5px] leading-[1.1] whitespace-nowrap">
              Date
            </th>
            <th className="border border-slate-400 px-1 py-[2px] text-left font-bold uppercase text-[8.5px] leading-[1.1]">
              Description
            </th>
            <th className="border border-slate-400 px-1 py-[2px] text-left font-bold uppercase text-[8.5px] leading-[1.1] whitespace-nowrap">
              Code
            </th>
            <th className="border border-slate-400 px-1 py-[2px] text-left font-bold uppercase text-[8.5px] leading-[1.1]">
              Name
            </th>
            <th className="border border-slate-400 px-1 py-[2px] text-left font-bold uppercase text-[8.5px] leading-[1.1] whitespace-nowrap">
              Invoice
            </th>
            <th className="border border-slate-400 px-1 py-[2px] text-right font-bold uppercase text-[8.5px] leading-[1.1] whitespace-nowrap">
              Debit (Out)
            </th>
            <th className="border border-slate-400 px-1 py-[2px] text-right font-bold uppercase text-[8.5px] leading-[1.1] whitespace-nowrap">
              Credit (In)
            </th>
            <th className="border border-slate-400 px-1 py-[2px] text-right font-bold uppercase text-[8.5px] leading-[1.1] whitespace-nowrap">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.items.map((item, idx) => (
            <tr key={item.id} className={idx === 0 ? "bg-slate-50 font-bold" : ""}>
              <td className="border border-slate-300 px-1 py-[2px] text-center text-slate-600 whitespace-nowrap leading-[1.1]">
                {idx === 0 ? "—" : idx}
              </td>
              <td className="border border-slate-300 px-1 py-[2px] text-slate-800 whitespace-nowrap leading-[1.1]">
                {item.formatted_date}
              </td>
              <td className="border border-slate-300 px-1 py-[2px] text-slate-900 break-words leading-[1.1]">
                {item.description}
              </td>
              <td className="border border-slate-300 px-1 py-[2px] text-slate-700 whitespace-nowrap leading-[1.1]">
                {item.code}
              </td>
              <td className="border border-slate-300 px-1 py-[2px] text-slate-900 break-words leading-[1.1]">
                {item.name}
              </td>
              <td className="border border-slate-300 px-1 py-[2px] font-semibold text-slate-900 whitespace-nowrap leading-[1.1]">
                {item.invoice}
              </td>
              <td className="border border-slate-300 px-1 py-[2px] text-right tabular-nums whitespace-nowrap text-rose-700 font-semibold debit-cell leading-[1.1]">
                {item.debit > 0 ? formatCurrency(item.debit) : "0"}
              </td>
              <td className="border border-slate-300 px-1 py-[2px] text-right tabular-nums whitespace-nowrap text-emerald-700 font-semibold credit-cell leading-[1.1]">
                {item.credit > 0 ? formatCurrency(item.credit) : "0"}
              </td>
              <td className="border border-slate-300 px-1 py-[2px] text-right tabular-nums whitespace-nowrap font-bold text-slate-950 balance-cell leading-[1.1]">
                {formatCurrency(item.balance)}
              </td>
            </tr>
          ))}
          {summary.items.length === 0 && (
            <tr>
              <td colSpan={9} className="border border-slate-300 p-4 text-center text-slate-500 italic">
                No cash transactions recorded for this period.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot className="bg-slate-100 font-bold text-[8.5px]">
          <tr>
            <td colSpan={6} className="border border-slate-400 px-2 py-1 text-right leading-[1.1]">
              Total Transactions Summary
            </td>
            <td className="border border-slate-400 px-1 py-1 text-right text-rose-800 tabular-nums whitespace-nowrap debit-cell leading-[1.1]">
              {formatCurrency(summary.today_cash_expense)}
            </td>
            <td className="border border-slate-400 px-1 py-1 text-right text-emerald-800 tabular-nums whitespace-nowrap credit-cell leading-[1.1]">
              {formatCurrency(summary.today_cash_received)}
            </td>
            <td className="border border-slate-400 px-1 py-1 text-right text-slate-950 tabular-nums whitespace-nowrap balance-cell font-black leading-[1.1]">
              {formatCurrency(summary.closing_cash_balance)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* 5. Bottom Summary Block */}
      <div className="bottom-summary-box mt-1 p-1 bg-slate-50 border border-slate-300 rounded text-[8px]">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <span className="text-slate-500 block text-[7px] uppercase font-semibold">Previous Balance</span>
            <span className="font-bold text-slate-900 text-[9px] leading-tight block">
              {formatCurrency(summary.previous_balance)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[7px] uppercase font-semibold">Total Cash Received</span>
            <span className="font-bold text-emerald-700 text-[9px] leading-tight block">
              {formatCurrency(summary.total_cash_received)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[7px] uppercase font-semibold">Total Cash Paid</span>
            <span className="font-bold text-rose-700 text-[9px] leading-tight block">
              {formatCurrency(summary.total_cash_paid)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[7px] uppercase font-semibold">Closing Cash in Hand</span>
            <span className="font-black text-slate-950 text-[9.5px] leading-tight block">
              {formatCurrency(summary.closing_cash_balance)}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Running Document Footer */}
      <footer className="print-footer mt-1 pt-1 border-t border-slate-300 flex justify-between items-center text-[7px] text-slate-500">
        <div>Official Cash Statement • {settings.business_name || "Enterprise"} • System Generated</div>
        <div>Printed on {currentPrintTime}</div>
      </footer>
    </div>
  );
});

PrintableCashBookStatement.displayName = "PrintableCashBookStatement";
