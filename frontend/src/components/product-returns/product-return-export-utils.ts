import { ProductReturnItem } from "@/types";

export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

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

export function exportProductReturnsCSV(returns: ProductReturnItem[], filename = "product_returns.csv") {
  if (!returns || returns.length === 0) return;

  const headers = [
    "Return Voucher No",
    "Return Date",
    "PO Number / Invoice",
    "Supplier Code",
    "Supplier Name",
    "Supplier Phone",
    "Items Count",
    "Return Grand Total",
    "Refund Received",
    "Return Reason",
    "Processed By",
  ];

  const rows = returns.map((ret) => [
    `"${ret.return_no}"`,
    `"${formatDate(ret.return_date)}"`,
    `"${ret.purchase?.purchase_no || ret.purchase?.invoice_no || ""}"`,
    `"${ret.supplier?.supplier_code || ""}"`,
    `"${ret.supplier?.name || "N/A"}"`,
    `"${ret.supplier?.phone || ""}"`,
    ret.items?.length || 0,
    ret.grand_total.toFixed(2),
    ret.refund_received.toFixed(2),
    `"${(ret.reason || "").replace(/"/g, '""')}"`,
    `"${ret.user?.full_name || ret.user?.username || ""}"`,
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

export function exportProductReturnsExcel(returns: ProductReturnItem[], filename = "product_returns.xls") {
  if (!returns || returns.length === 0) return;

  let tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Product Returns</x:Name>
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
      <h2>Supplier Product Returns Audit Report</h2>
      <p>Export Date: ${new Date().toLocaleDateString()}</p>
      <table>
        <thead>
          <tr>
            <th>Voucher No</th>
            <th>Return Date</th>
            <th>PO Number</th>
            <th>Supplier Code</th>
            <th>Supplier Name</th>
            <th>Phone</th>
            <th>Returned Items</th>
            <th>Grand Total ($)</th>
            <th>Refund Received ($)</th>
            <th>Reason</th>
            <th>Processed By</th>
          </tr>
        </thead>
        <tbody>
  `;

  returns.forEach((ret) => {
    tableHtml += `
      <tr>
        <td>${ret.return_no}</td>
        <td>${formatDate(ret.return_date)}</td>
        <td>${ret.purchase?.purchase_no || ret.purchase?.invoice_no || ""}</td>
        <td>${ret.supplier?.supplier_code || ""}</td>
        <td>${ret.supplier?.name || "N/A"}</td>
        <td>${ret.supplier?.phone || ""}</td>
        <td>${ret.items?.length || 0}</td>
        <td class="num">${ret.grand_total.toFixed(2)}</td>
        <td class="num">${ret.refund_received.toFixed(2)}</td>
        <td>${ret.reason || ""}</td>
        <td>${ret.user?.full_name || ret.user?.username || ""}</td>
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
import { PrintableProductReturnVoucher } from "./printable-product-return-voucher";

export function printProductReturnVoucher(ret: ProductReturnItem) {
  printService.printDocument(React.createElement(PrintableProductReturnVoucher, { productReturn: ret }));
}
