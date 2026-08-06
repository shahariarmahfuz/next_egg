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

import { useSettingsStore } from "@/store/settings";

export function printVoucherWindow(collection: CustomerCollectionItem) {
  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) return;
  const businessName = useSettingsStore.getState().settings.business_name || "ENTERPRISE MANAGEMENT SYSTEM";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Collection Voucher - ${collection.collection_no}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
          .company-name { font-size: 24px; font-weight: bold; color: #0f172a; letter-spacing: 0.5px; }
          .voucher-title { font-size: 16px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-top: 5px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold; margin-bottom: 8px; }
          .detail-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
          .detail-label { color: #64748b; }
          .detail-value { font-weight: 600; color: #0f172a; }
          .amount-box { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
          .amount-val { font-size: 32px; font-weight: 800; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 12px; color: #64748b; }
          .sig-line { width: 180px; border-top: 1px solid #94a3b8; text-align: center; padding-top: 5px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${businessName}</div>
          <div class="voucher-title">OFFICIAL PAYMENT COLLECTION VOUCHER</div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Customer Information</div>
            <div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">${collection.customer?.name || "N/A"}</span></div>
            <div class="detail-row"><span class="detail-label">Contact Number:</span><span class="detail-value">${collection.customer?.phone || "N/A"}</span></div>
            <div class="detail-row"><span class="detail-label">Address:</span><span class="detail-value">${collection.customer?.address || "N/A"}</span></div>
          </div>
          <div class="card">
            <div class="card-title">Voucher Details</div>
            <div class="detail-row"><span class="detail-label">Voucher No:</span><span class="detail-value">${collection.collection_no}</span></div>
            <div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">${formatDateTime(collection.collection_date)}</span></div>
            <div class="detail-row"><span class="detail-label">Payment Method:</span><span class="detail-value">${collection.payment_method.toUpperCase()}</span></div>
          </div>
        </div>

        <div class="amount-box">
          <div style="font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Collected Amount</div>
          <div class="amount-val">$${collection.amount.toFixed(2)}</div>
        </div>

        ${collection.notes ? `<div class="card"><div class="card-title">Notes / Remarks</div><div style="font-size: 13px;">${collection.notes}</div></div>` : ""}

        <div style="display: flex; justify-content: space-between; margin-top: 50px;">
          <div class="sig-line">Customer Signature</div>
          <div class="sig-line">Authorized Collector</div>
        </div>

        <div class="footer">
          <div>Generated on: ${new Date().toLocaleString()}</div>
          <div>Page 1 of 1</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
