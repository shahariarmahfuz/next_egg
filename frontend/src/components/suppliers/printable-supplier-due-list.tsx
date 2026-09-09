"use client";

import React from "react";
import { SupplierItem } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { ReportPrintLayout } from "@/components/print/report-print-layout";

export interface PrintableSupplierDueListProps {
  suppliers: SupplierItem[];
  searchQuery?: string;
  totalSuppliers: number;
  totalAmount?: number;
}

export const PrintableSupplierDueList = React.forwardRef<HTMLDivElement, PrintableSupplierDueListProps>(
  ({ suppliers, searchQuery, totalSuppliers, totalAmount }, ref) => {
    const totalOpeningDue = suppliers.reduce((sum, s) => sum + (s.opening_balance || 0), 0);
    const totalCurrentDue = suppliers.reduce(
      (sum, s) => sum + ((s.current_balance || 0) - (s.opening_balance || 0)),
      0
    );
    const calculatedTotalDue =
      totalAmount !== undefined
        ? totalAmount
        : suppliers.reduce((sum, s) => sum + (s.current_balance || 0), 0);

    const filters = searchQuery
      ? [{ label: "Search Filter", value: `"${searchQuery}"` }]
      : [];

    const totalsBlock = (
      <div className="flex justify-end mt-4 mb-2 print-avoid-break">
        <div className="w-80 border border-slate-400 bg-slate-50 text-[11px] rounded overflow-hidden">
          <div className="bg-slate-200 px-3 py-1 font-bold text-slate-900 border-b border-slate-400 uppercase text-[10px]">
            Due Summary
          </div>
          <div className="p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Total Due Suppliers:</span>
              <span className="font-bold text-slate-900">{totalSuppliers}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Total Opening Due:</span>
              <span className="text-slate-800">{formatCurrency(totalOpeningDue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-700">Total Current Due:</span>
              <span className="text-slate-800">{formatCurrency(totalCurrentDue)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-400 pt-1.5 text-xs">
              <span className="font-extrabold text-slate-950">Total Outstanding Due:</span>
              <span className="font-extrabold text-slate-950">{formatCurrency(calculatedTotalDue)}</span>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <ReportPrintLayout
        ref={ref}
        title="SUPPLIER OUTSTANDING DUE LIST"
        subtitle="Accounts Payable & Outstanding Supplier Due Report"
        filters={filters}
        totals={totalsBlock}
        showSignatures
        signatureTitles={["Accounts Officer", "Authorized Signature"]}
      >
        <table className="w-full border-collapse border border-slate-400 text-[10.5px]">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-400 px-2 py-1.5 text-center w-10 font-bold uppercase text-[10px]">
                SL
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-left w-28 font-bold uppercase text-[10px]">
                Supplier Code
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-left font-bold uppercase text-[10px]">
                Supplier Name
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-left w-32 font-bold uppercase text-[10px]">
                Company
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-left w-28 font-bold uppercase text-[10px]">
                Mobile
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-right w-28 font-bold uppercase text-[10px]">
                Opening Due
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-right w-28 font-bold uppercase text-[10px]">
                Current Due
              </th>
              <th className="border border-slate-400 px-2.5 py-1.5 text-right w-28 font-bold uppercase text-[10px]">
                Total Due
              </th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier, index) => {
              const currentDue = (supplier.current_balance || 0) - (supplier.opening_balance || 0);
              return (
                <tr key={supplier.id} className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">
                    {index + 1}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 font-medium text-slate-800">
                    {supplier.supplier_code}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 font-bold text-slate-900 break-words">
                    {supplier.name}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-slate-700 break-words">
                    {supplier.company_name || "-"}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-slate-700 whitespace-nowrap">
                    {supplier.phone || "-"}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap text-slate-800">
                    {formatCurrency(supplier.opening_balance)}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap text-slate-800">
                    {formatCurrency(currentDue)}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap font-bold text-slate-950">
                    {formatCurrency(supplier.current_balance)}
                  </td>
                </tr>
              );
            })}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={8} className="border border-slate-300 p-6 text-center text-slate-500 italic">
                  No due records found matching the criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ReportPrintLayout>
    );
  }
);

PrintableSupplierDueList.displayName = "PrintableSupplierDueList";
