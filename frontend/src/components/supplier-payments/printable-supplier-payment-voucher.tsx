"use client";

import React from "react";
import { SupplierPaymentItem } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { ReportPrintLayout } from "@/components/print/report-print-layout";

export interface PrintableSupplierPaymentVoucherProps {
  payment: SupplierPaymentItem;
}

export const PrintableSupplierPaymentVoucher = React.forwardRef<HTMLDivElement, PrintableSupplierPaymentVoucherProps>(
  ({ payment }, ref) => {
    const filters = [
      { label: "Supplier Name", value: payment.supplier?.name || "N/A" },
      { label: "Supplier Code", value: payment.supplier?.supplier_code || "N/A" },
      { label: "Contact Phone", value: payment.supplier?.phone || "N/A" },
      { label: "Payment Date", value: formatDateTime(payment.payment_date) },
      { label: "Payment Method", value: payment.payment_method?.toUpperCase() || "CASH" },
    ];

    const noteText = payment.notes || (payment as unknown as { note?: string }).note;

    return (
      <ReportPrintLayout
        ref={ref}
        title="OFFICIAL SUPPLIER PAYMENT VOUCHER"
        subtitle="Accounts Payable & Supplier Disbursement Voucher"
        documentNo={payment.payment_no}
        filters={filters}
        showSignatures
        signatureTitles={["Prepared By", "Supplier Received Signature"]}
      >
        <div className="space-y-4 my-2">
          {/* Amount Paid Highlight Box */}
          <div className="border-2 border-blue-900 bg-blue-50 p-4 rounded text-center my-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 block">
              Payment Amount Paid
            </span>
            <span className="text-2xl font-black text-blue-950 block mt-1">
              {formatCurrency(payment.amount)}
            </span>
          </div>

          {/* Details Table */}
          <table className="w-full border-collapse border border-slate-300 text-[11px] my-3">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Supplier / Company Name
                </td>
                <td className="p-2 font-bold text-slate-950">{payment.supplier?.name || "N/A"}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Supplier Code
                </td>
                <td className="p-2 text-slate-800">{payment.supplier?.supplier_code || "N/A"}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Contact Phone
                </td>
                <td className="p-2 text-slate-800">{payment.supplier?.phone || "N/A"}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Payment Date & Time
                </td>
                <td className="p-2 text-slate-800">{formatDateTime(payment.payment_date)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                  Payment Method
                </td>
                <td className="p-2 font-semibold text-slate-900">{payment.payment_method?.toUpperCase()}</td>
              </tr>
              {payment.reference_no && (
                <tr className="border-b border-slate-300">
                  <td className="w-1/3 bg-slate-100 p-2 font-bold text-slate-900 border-r border-slate-300">
                    Reference / Cheque No
                  </td>
                  <td className="p-2 text-slate-800">{payment.reference_no}</td>
                </tr>
              )}
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

PrintableSupplierPaymentVoucher.displayName = "PrintableSupplierPaymentVoucher";
