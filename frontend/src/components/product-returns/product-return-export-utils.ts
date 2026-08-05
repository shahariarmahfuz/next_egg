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

export function printProductReturnVoucher(ret: ProductReturnItem) {
  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) return;

  let itemsHtml = "";
  ret.items.forEach((item) => {
    itemsHtml += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${item.product?.name || "Product"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity} ${item.product?.unit || "pcs"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${item.unit_price.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${item.total_price.toFixed(2)}</td>
      </tr>
    `;
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Product Return Voucher - ${ret.return_no}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
          .company-name { font-size: 24px; font-weight: bold; color: #0f172a; }
          .voucher-title { font-size: 16px; font-weight: 600; text-transform: uppercase; color: #2563eb; margin-top: 5px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold; margin-bottom: 8px; }
          .detail-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
          .detail-label { color: #64748b; }
          .detail-value { font-weight: 600; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
          th { background: #0f172a; color: white; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; }
          .total-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px; margin-bottom: 30px; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 12px; color: #64748b; }
          .sig-line { width: 180px; border-top: 1px solid #94a3b8; text-align: center; padding-top: 5px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">ENTERPRISE MANAGEMENT SYSTEM</div>
          <div class="voucher-title">OFFICIAL SUPPLIER PRODUCT RETURN VOUCHER</div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Supplier Details</div>
            <div class="detail-row"><span class="detail-label">Company / Name:</span><span class="detail-value">${ret.supplier?.name || "N/A"}</span></div>
            <div class="detail-row"><span class="detail-label">Supplier Code:</span><span class="detail-value">${ret.supplier?.supplier_code || "N/A"}</span></div>
            <div class="detail-row"><span class="detail-label">Phone:</span><span class="detail-value">${ret.supplier?.phone || "N/A"}</span></div>
          </div>
          <div class="card">
            <div class="card-title">Return Voucher Details</div>
            <div class="detail-row"><span class="detail-label">Voucher No:</span><span class="detail-value">${ret.return_no}</span></div>
            <div class="detail-row"><span class="detail-label">PO / Invoice No:</span><span class="detail-value">${ret.purchase?.purchase_no || ret.purchase?.invoice_no || "N/A"}</span></div>
            <div class="detail-row"><span class="detail-label">Return Date:</span><span class="detail-value">${formatDateTime(ret.return_date)}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Returned Product</th>
              <th style="text-align: center;">Qty Returned</th>
              <th style="text-align: right;">Return Price</th>
              <th style="text-align: right;">Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="total-box">
          <div class="detail-row"><span class="detail-label">Total Returned Goods Value:</span><span class="detail-value">$${ret.grand_total.toFixed(2)}</span></div>
          <div class="detail-row"><span class="detail-label">Cash Refund Received:</span><span class="detail-value">$${ret.refund_received.toFixed(2)}</span></div>
          <div class="detail-row" style="font-size: 15px; font-weight: bold; border-top: 1px solid #93c5fd; padding-top: 6px;"><span class="detail-label">Net Reduction in Supplier Due Balance:</span><span class="detail-value" style="color: #1d4ed8;">$${(ret.grand_total - ret.refund_received).toFixed(2)}</span></div>
        </div>

        ${ret.reason ? `<div class="card"><div class="card-title font-bold">Return Reason & Notes</div><div style="font-size: 13px;">${ret.reason}</div></div>` : ""}

        <div style="display: flex; justify-content: space-between; margin-top: 50px;">
          <div class="sig-line">Supplier Representative Signature</div>
          <div class="sig-line">Inventory Manager Signature</div>
        </div>

        <div class="footer">
          <div>Generated on: ${new Date().toLocaleString()}</div>
          <div>Page 1 of 1</div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
