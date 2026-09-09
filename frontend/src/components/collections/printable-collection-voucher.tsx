"use client";

import React from "react";
import { CustomerCollectionItem } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { ReportPrintLayout } from "@/components/print/report-print-layout";

export interface PrintableCollectionVoucherProps {
  collection: CustomerCollectionItem;
}

export const PrintableCollectionVoucher = React.forwardRef<HTMLDivElement, PrintableCollectionVoucherProps>(
  ({ collection }, ref) => {
    const filters = [
      { label: "Customer Name", value: collection.customer?.name || "N/A" },
      { label: "Contact Phone", value: collection.customer?.phone || "N/A" },
      { label: "Payment Date", value: formatDateTime(collection.collection_date) },
      { label: "Payment Method", value: collection.payment_method?.toUpperCase() || "CASH" },
    ];

    const noteText = collection.notes || (collection as unknown as { note?: string }).note;

    return (
      <ReportPrintLayout
        ref={ref}
        title="OFFICIAL PAYMENT COLLECTION VOUCHER"
        subtitle="Money Receipt & Accounts Receivable Voucher"
        documentNo={collection.collection_no}
        filters={filters}
        showSignatures
        signatureTitles={["Customer Signature", "Authorized Collector"]}
      >
        <div className="space-y-4 my-2">
          {/* Collected Amount Highlight Box */}
          <div className="border-2 border-emerald-800 bg-emerald-50 p-4 rounded text-center my-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
              Collected Amount
            </span>
            <span className="text-2xl font-black text-emerald-950 block mt-1">
              {formatCurrency(collection.amount)}
            </span>
          </div>

          {/* Details Table */}
          <table className="w-full border-collapse border border-slate-300 text-[11px] my-3">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Customer Name
                </td>
                <td className="p-2 font-bold text-slate-950">{collection.customer?.name || "N/A"}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Customer Contact / Phone
                </td>
                <td className="p-2 text-slate-800">{collection.customer?.phone || "N/A"}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Customer Address
                </td>
                <td className="p-2 text-slate-800">{collection.customer?.address || "N/A"}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Collection Date & Time
                </td>
                <td className="p-2 text-slate-800">{formatDateTime(collection.collection_date)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Payment Method
                </td>
                <td className="p-2 font-semibold text-slate-900">{collection.payment_method?.toUpperCase()}</td>
              </tr>
            </tbody>
          </table>

          {/* Note / Remarks */}
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

PrintableCollectionVoucher.displayName = "PrintableCollectionVoucher";
