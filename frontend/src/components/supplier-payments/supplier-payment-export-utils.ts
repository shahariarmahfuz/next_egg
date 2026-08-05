import { SupplierPaymentItem } from "@/types";

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

export function printSupplierPaymentVoucher(pay: SupplierPaymentItem) {
  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Supplier Payment Voucher - ${pay.payment_no}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
          .company-name { font-size: 24px; font-weight: bold; color: #0f172a; }
          .voucher-title { font-size: 16px; font-weight: 600; text-transform: uppercase; color: #059669; margin-top: 5px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold; margin-bottom: 8px; }
          .detail-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
          .detail-label { color: #64748b; }
          .detail-value { font-weight: 600; color: #0f172a; }
          .amount-box { background: #ecfdf5; border: 2px solid #10b981; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
          .amount-label { font-size: 12px; text-transform: uppercase; color: #047857; font-weight: bold; letter-spacing: 1px; }
          .amount-val { font-size: 32px; font-weight: 900; color: #047857;  margin-top: 4px; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 12px; color: #64748b; }
          .sig-line { width: 180px; border-top: 1px solid #94a3b8; text-align: center; padding-top: 5px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">ENTERPRISE MANAGEMENT SYSTEM</div>
          <div class="voucher-title">OFFICIAL SUPPLIER PAYMENT VOUCHER</div>
        </div>

        <div class="amount-box">
          <div class="amount-label">Payment Amount Paid</div>
          <div class="amount-val">$${pay.amount.toFixed(2)}</div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Supplier Details</div>
            <div class="detail-row"><span class="detail-label">Name / Company:</span><span class="detail-value">${pay.supplier?.name || "N/A"}</span></div>
            <div class="detail-row"><span class="detail-label">Supplier Code:</span><span class="detail-value">${pay.supplier?.supplier_code || "N/A"}</span></div>
            <div class="detail-row"><span class="detail-label">Phone:</span><span class="detail-value">${pay.supplier?.phone || "N/A"}</span></div>
          </div>
          <div class="card">
            <div class="card-title">Payment Info</div>
            <div class="detail-row"><span class="detail-label">Voucher No:</span><span class="detail-value">${pay.payment_no}</span></div>
            <div class="detail-row"><span class="detail-label">Payment Date:</span><span class="detail-value">${formatDateTime(pay.payment_date)}</span></div>
            <div class="detail-row"><span class="detail-label">Payment Method:</span><span class="detail-value">${pay.payment_method.toUpperCase()}</span></div>
            ${pay.reference_no ? `<div class="detail-row"><span class="detail-label">Reference No:</span><span class="detail-value">${pay.reference_no}</span></div>` : ""}
          </div>
        </div>

        ${pay.notes ? `<div class="card"><div class="card-title">Notes / Description</div><div style="font-size: 13px;">${pay.notes}</div></div>` : ""}

        <div style="display: flex; justify-content: space-between; margin-top: 50px;">
          <div class="sig-line">Prepared By</div>
          <div class="sig-line">Supplier Received Signature</div>
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
