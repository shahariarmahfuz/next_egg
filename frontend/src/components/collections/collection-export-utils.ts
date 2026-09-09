import { CustomerCollectionItem, CollectionReportSummaryData } from "@/types";

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

export function exportCollectionsCSV(collections: CustomerCollectionItem[], filename = "customer_collections.csv") {
  if (!collections || collections.length === 0) return;

  const headers = [
    "Collection No",
    "Collection Date",
    "Customer Name",
    "Customer Phone",
    "Customer Address",
    "Amount",
    "Payment Method",
    "Notes",
  ];

  const rows = collections.map((col) => [
    `"${col.collection_no}"`,
    `"${formatDate(col.collection_date)}"`,
    `"${col.customer?.name || "N/A"}"`,
    `"${col.customer?.phone || ""}"`,
    `"${(col.customer?.address || "").replace(/"/g, '""')}"`,
    col.amount.toFixed(2),
    `"${col.payment_method.toUpperCase()}"`,
    `"${(col.notes || "").replace(/"/g, '""')}"`,
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

export function exportCollectionsExcel(collections: CustomerCollectionItem[], filename = "customer_collections.xls") {
  if (!collections || collections.length === 0) return;

  let tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Collections</x:Name>
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
      <h2>Customer Collection Dues Report</h2>
      <p>Export Date: ${new Date().toLocaleDateString()}</p>
      <table>
        <thead>
          <tr>
            <th>Voucher No</th>
            <th>Collection Date</th>
            <th>Customer Name</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Amount ($)</th>
            <th>Payment Method</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
  `;

  collections.forEach((col) => {
    tableHtml += `
      <tr>
        <td>${col.collection_no}</td>
        <td>${formatDate(col.collection_date)}</td>
        <td>${col.customer?.name || "N/A"}</td>
        <td>${col.customer?.phone || ""}</td>
        <td>${col.customer?.address || ""}</td>
        <td class="num">${col.amount.toFixed(2)}</td>
        <td>${col.payment_method.toUpperCase()}</td>
        <td>${col.notes || ""}</td>
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
import { PrintableCollectionVoucher } from "./printable-collection-voucher";

export function printVoucherWindow(collection: CustomerCollectionItem) {
  printService.printDocument(React.createElement(PrintableCollectionVoucher, { collection }));
}
