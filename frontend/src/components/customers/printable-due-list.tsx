import React from "react";
import { CustomerItem } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { useSettingsStore } from "@/store/settings";
import { useAuth } from "@/providers/auth-provider";

interface PrintableDueListProps {
  customers: CustomerItem[];
  searchQuery?: string;
  totalCustomers: number;
  totalAmount: number;
}

export const PrintableDueList = React.forwardRef<HTMLDivElement, PrintableDueListProps>(
  ({ customers, searchQuery, totalCustomers, totalAmount }, ref) => {
    const { settings } = useSettingsStore();
    const { user } = useAuth();
    
    return (
      <div ref={ref} className="hidden print:block w-full bg-white text-black text-[11px]">
        {/* Print Layout Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              background: white !important;
            }
            table { page-break-inside:auto }
            tr    { page-break-inside:avoid; page-break-after:auto }
            thead { display:table-header-group }
            tfoot { display:table-footer-group }
          }
        `}} />

        {/* Header */}
        <div className="text-center mb-6">
          {settings.business_logo && (
            <img src={settings.business_logo} alt={settings.business_name} className="h-16 mx-auto mb-2 object-contain" />
          )}
          <h1 className="text-2xl font-bold uppercase mb-1">{settings.business_name}</h1>
          <h2 className="text-xl font-bold uppercase border-b-2 border-black inline-block pb-1 mt-2 mb-4">
            CUSTOMER DUE LIST
          </h2>
          
          <div className="flex justify-between items-end text-xs">
            <div className="text-left">
              {searchQuery && (
                <div className="mb-1">
                  <strong>Search Filter:</strong> {searchQuery}
                </div>
              )}
            </div>
            <div className="text-right">
              <p><strong>Print Date:</strong> {formatDateTime(new Date())}</p>
              <p><strong>Printed By:</strong> {user?.full_name || user?.username}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <table className="w-full border-collapse border border-black mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-2 text-center w-12">SL</th>
              <th className="border border-black px-2 py-2 text-left">Customer Code</th>
              <th className="border border-black px-2 py-2 text-left">Customer Name</th>
              <th className="border border-black px-2 py-2 text-left">Mobile</th>
              <th className="border border-black px-2 py-2 text-right">Opening Due</th>
              <th className="border border-black px-2 py-2 text-right">Current Due</th>
              <th className="border border-black px-2 py-2 text-right">Total Due</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, index) => (
              <tr key={customer.id}>
                <td className="border border-black px-2 py-1.5 text-center">{index + 1}</td>
                <td className="border border-black px-2 py-1.5">{customer.customer_code}</td>
                <td className="border border-black px-2 py-1.5 font-bold">{customer.name}</td>
                <td className="border border-black px-2 py-1.5">{customer.phone || "-"}</td>
                <td className="border border-black px-2 py-1.5 text-right">{formatCurrency(customer.opening_balance)}</td>
                <td className="border border-black px-2 py-1.5 text-right">{formatCurrency(customer.current_balance - customer.opening_balance)}</td>
                <td className="border border-black px-2 py-1.5 text-right font-bold">{formatCurrency(customer.current_balance)}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="border border-black p-4 text-center">
                  No due records found.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} className="border-none pt-4 text-xs text-center text-gray-500">
                Printed from {settings.business_name}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Totals Section */}
        <div className="flex justify-end mb-8">
          <div className="w-64 border border-black p-3 bg-gray-50">
            <div className="flex justify-between mb-2">
              <span className="font-bold">Total Due Customers:</span>
              <span>{totalCustomers}</span>
            </div>
            <div className="flex justify-between border-t border-black pt-2 text-sm">
              <span className="font-bold">Total Outstanding Due:</span>
              <span className="font-bold">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PrintableDueList.displayName = "PrintableDueList";
