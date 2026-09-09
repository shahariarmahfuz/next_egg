import { SupplierPaymentItem } from "@/types";
import { formatCurrency } from "@/utils/formatters";
import { useSettingsStore } from "@/store/settings";

export { formatCurrency };

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function exportSupplierPaymentsCSV(payments: SupplierPaymentItem[], filename = "supplier_payments.csv") {
  if (!payments || payments.length === 0) return;

  const headers = [
    "Voucher No",
    "Payment Date",
    "Supplier Code",
    "Supplier Name",
    "Phone",
    "Amount Paid",
    "Payment Method",
    "Reference No",
    "Notes",
    "Processed By",
  ];

  const rows = payments.map((pay) => [
    `"${pay.payment_no}"`,
    `"${formatDate(pay.payment_date)}"`,
    `"${pay.supplier?.supplier_code || ""}"`,
    `"${pay.supplier?.name || "N/A"}"`,
    `"${pay.supplier?.phone || ""}"`,
    pay.amount.toFixed(2),
    `"${pay.payment_method.toUpperCase()}"`,
    `"${pay.reference_no || ""}"`,
    `"${(pay.notes || "").replace(/"/g, '""')}"`,
    `"${pay.user?.full_name || pay.user?.username || ""}"`,
  ]);

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportSupplierPaymentsExcel(payments: SupplierPaymentItem[], filename = "supplier_payments.xls") {
  if (!payments || payments.length === 0) return;

  let tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Supplier Payments</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
        th { background-color: #0f172a; color: #ffffff; border: 1px solid #334155; padding: 8px; text-align: left; }
        td { border: 1px solid #cbd5e1; padding: 6px; }
        .num { text-align: right; }
      </style>
    </head>
    <body>
      <h2>Supplier Payment Audit Log</h2>
      <p>Export Date: ${new Date().toLocaleDateString()}</p>
      <table>
        <thead>
          <tr>
            <th>Voucher No</th>
            <th>Payment Date</th>
            <th>Supplier Code</th>
            <th>Supplier Name</th>
            <th>Phone</th>
            <th>Amount Paid ($)</th>
            <th>Payment Channel</th>
            <th>Reference No</th>
            <th>Notes</th>
            <th>Processed By</th>
          </tr>
        </thead>
        <tbody>
  `;

  payments.forEach((pay) => {
    tableHtml += `
      <tr>
        <td>${pay.payment_no}</td>
        <td>${formatDate(pay.payment_date)}</td>
        <td>${pay.supplier?.supplier_code || ""}</td>
        <td>${pay.supplier?.name || "N/A"}</td>
        <td>${pay.supplier?.phone || ""}</td>
        <td class="num">${pay.amount.toFixed(2)}</td>
        <td>${pay.payment_method.toUpperCase()}</td>
        <td>${pay.reference_no || ""}</td>
        <td>${pay.notes || ""}</td>
        <td>${pay.user?.full_name || pay.user?.username || ""}</td>
      </tr>
    `;
  });

  tableHtml += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

import React from "react";
import { printService } from "@/lib/print-service";
import { PrintableSupplierPaymentVoucher } from "./printable-supplier-payment-voucher";

export function printSupplierPaymentVoucher(pay: SupplierPaymentItem) {
  printService.printDocument(React.createElement(PrintableSupplierPaymentVoucher, { payment: pay }));
}
