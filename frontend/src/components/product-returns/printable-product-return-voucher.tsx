"use client";

import React from "react";
import { ProductReturnItem } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { ReportPrintLayout } from "@/components/print/report-print-layout";

export interface PrintableProductReturnVoucherProps {
  productReturn: ProductReturnItem;
}

export const PrintableProductReturnVoucher = React.forwardRef<HTMLDivElement, PrintableProductReturnVoucherProps>(
  ({ productReturn: ret }, ref) => {
    const filters = [
      { label: "Supplier / Vendor", value: ret.supplier?.name || "N/A" },
      { label: "Supplier Code", value: ret.supplier?.supplier_code || "N/A" },
      { label: "Return Date", value: formatDateTime(ret.return_date) },
      { label: "Ref Purchase / PO", value: ret.purchase?.purchase_no || ret.purchase?.invoice_no || "N/A" },
    ];

    const noteText = ret.notes || (ret as unknown as { note?: string }).note || ret.reason;

    const totalsBlock = (
      <div className="flex justify-end mt-4 mb-2 print-avoid-break">
        <div className="w-80 border border-slate-400 bg-slate-50 text-[11px] rounded overflow-hidden">
          <div className="bg-slate-200 px-3 py-1 font-bold text-slate-900 border-b border-slate-400 uppercase text-[10px]">
            Return Financial Summary
          </div>
          <div className="p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Gross Goods Value:</span>
              <span className="font-bold text-slate-900">{formatCurrency(ret.grand_total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Refund Received:</span>
              <span className="text-slate-800">{formatCurrency(ret.refund_received)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-400 pt-1.5 text-xs">
              <span className="font-extrabold text-blue-900">Net Due Reduction:</span>
              <span className="font-extrabold text-blue-950">
                {formatCurrency(ret.grand_total - ret.refund_received)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <ReportPrintLayout
        ref={ref}
        title="OFFICIAL SUPPLIER PRODUCT RETURN VOUCHER"
        subtitle="Debit Note & Goods Return Voucher"
        documentNo={ret.return_no}
        filters={filters}
        totals={totalsBlock}
        showSignatures
        signatureTitles={["Supplier Representative Signature", "Inventory Manager Signature"]}
      >
        {/* Returned Items Table */}
        <table className="w-full border-collapse border border-slate-400 text-[10.5px] my-3">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-400 px-2 py-1.5 text-center w-10 font-bold uppercase text-[10px]">
                SL
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-left font-bold uppercase text-[10px]">
                Returned Product
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-center w-28 font-bold uppercase text-[10px]">
                Qty Returned
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-right w-28 font-bold uppercase text-[10px]">
                Return Price
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-right w-32 font-bold uppercase text-[10px]">
                Total Value
              </th>
            </tr>
          </thead>
          <tbody>
            {ret.items.map((item, idx) => (
              <tr key={item.id || idx} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">
                  {idx + 1}
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 font-bold text-slate-900 break-words">
                  {item.product?.name || "Product"}
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-center text-slate-800 whitespace-nowrap">
                  {item.quantity} {item.product?.unit || "pcs"}
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap text-slate-800">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap font-bold text-slate-950">
                  {formatCurrency(item.total_price)}
                </td>
              </tr>
            ))}
            {ret.items.length === 0 && (
              <tr>
                <td colSpan={5} className="border border-slate-300 p-6 text-center text-slate-500 italic">
                  No line items found in this return voucher.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Reason / Notes */}
        {Boolean(noteText) && (
          <div className="border border-slate-300 p-3 rounded bg-slate-50 text-[11px] my-3 print-avoid-break">
            <span className="font-bold text-slate-900 block mb-1">Return Reason & Operational Notes:</span>
            <p className="text-slate-700 whitespace-pre-wrap">{noteText}</p>
          </div>
        )}
      </ReportPrintLayout>
    );
  }
);

PrintableProductReturnVoucher.displayName = "PrintableProductReturnVoucher";
