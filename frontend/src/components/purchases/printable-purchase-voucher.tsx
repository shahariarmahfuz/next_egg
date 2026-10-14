"use client";

import React from "react";
import { PurchaseItem } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { ReportPrintLayout } from "@/components/print/report-print-layout";

export interface PrintablePurchaseVoucherProps {
  purchase: PurchaseItem;
}

export const PrintablePurchaseVoucher = React.forwardRef<HTMLDivElement, PrintablePurchaseVoucherProps>(
  ({ purchase }, ref) => {
    const filters = [
      { label: "Supplier / Vendor", value: purchase.supplier?.name || "N/A" },
      { label: "Supplier Code", value: purchase.supplier?.supplier_code || "N/A" },
      { label: "Contact Phone", value: purchase.supplier?.phone || "N/A" },
      { label: "Purchase Date", value: formatDateTime(purchase.purchase_date) },
      { label: "Supplier Invoice", value: purchase.invoice_no || "N/A" },
      { label: "Payment Status", value: (purchase.payment_status || "UNPAID").toUpperCase() },
    ];

    const noteText = purchase.notes || purchase.note;

    const totalsBlock = (
      <div className="flex justify-end mt-4 mb-2 print-avoid-break">
        <div className="w-80 border border-slate-400 bg-slate-50 text-[11px] rounded overflow-hidden">
          <div className="bg-slate-200 px-3 py-1 font-bold text-slate-900 border-b border-slate-400 uppercase text-[10px]">
            Financial Summary
          </div>
          <div className="p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Subtotal:</span>
              <span className="font-bold text-slate-900">{formatCurrency(purchase.subtotal)}</span>
            </div>
            {purchase.discount_amount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span className="font-semibold">Discount:</span>
                <span>-{formatCurrency(purchase.discount_amount)}</span>
              </div>
            )}
            {purchase.tax_amount > 0 && (
              <div className="flex justify-between text-slate-700">
                <span className="font-semibold">Tax:</span>
                <span>+{formatCurrency(purchase.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-400 pt-1.5 text-xs font-black text-slate-950">
              <span>Grand Total:</span>
              <span>{formatCurrency(purchase.grand_total)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Paid Amount:</span>
              <span>{formatCurrency(purchase.paid_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1 text-amber-800 font-bold">
              <span>Remaining Due:</span>
              <span>{formatCurrency(purchase.due_amount)}</span>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <ReportPrintLayout
        ref={ref}
        title="OFFICIAL PURCHASE ORDER VOUCHER"
        subtitle="Accounts Payable & Goods Received Note (GRN)"
        documentNo={purchase.purchase_no}
        filters={filters}
        totals={totalsBlock}
        showSignatures
        signatureTitles={["Prepared By", "Supplier / Receiver Signature"]}
      >
        {/* Purchased Items Table */}
        <table className="w-full border-collapse border border-slate-400 text-[10.5px] my-3">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-400 px-2 py-1.5 text-center w-10 font-bold uppercase text-[10px]">
                SL
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-left font-bold uppercase text-[10px]">
                Product Name
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-left font-bold uppercase text-[10px] w-28">
                Code
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-right w-24 font-bold uppercase text-[10px]">
                Quantity
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-right w-28 font-bold uppercase text-[10px]">
                Unit Price
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-right w-32 font-bold uppercase text-[10px]">
                Total Price
              </th>
            </tr>
          </thead>
          <tbody>
            {(purchase.items || []).map((item, index) => (
              <tr key={item.id || index} className="border-b border-slate-300">
                <td className="border border-slate-300 px-2 py-1.5 text-center">{index + 1}</td>
                <td className="border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-900">
                  {item.product?.name || "Product"}
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-slate-600">
                  {item.product?.product_code || "—"}
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-right font-bold text-slate-900">
                  {item.quantity} {item.product?.unit || "pcs"}
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-right text-slate-700">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="border border-slate-300 px-2.5 py-1.5 text-right font-black text-slate-950">
                  {formatCurrency(item.total_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Note block if exists */}
        {Boolean(noteText) && (
          <div className="border border-slate-300 rounded p-2.5 my-2 bg-slate-50 text-[11px]">
            <span className="font-bold text-slate-800 block mb-1">Notes / Remarks:</span>
            <p className="text-slate-600 whitespace-pre-wrap">{noteText}</p>
          </div>
        )}
      </ReportPrintLayout>
    );
  }
);

PrintablePurchaseVoucher.displayName = "PrintablePurchaseVoucher";
