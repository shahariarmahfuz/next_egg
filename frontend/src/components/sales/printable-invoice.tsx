"use client";

import { SaleItem } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";

import { useSettingsStore } from "@/store/settings";

export type PrintTemplateFormat = "a4" | "a5" | "pos_80mm";

interface PrintableInvoiceProps {
  sale: SaleItem;
  template: PrintTemplateFormat;
}

export function PrintableInvoice({
  sale,
  template,
}: PrintableInvoiceProps) {
  const { settings } = useSettingsStore();

  const businessInfo = {
    name: settings.business_name || "Enterprise POS Systems Ltd.",
    logoText: settings.business_short_name || "ENTERPRISE",
    address: settings.business_address || "Level 8, Commerce Tower, Tech Zone, Dhaka 1212",
    phone: settings.business_phone || "+880 1711-000999",
    email: settings.business_email || "billing@enterprisepos.com",
    website: settings.website || "www.enterprisepos.com",
    poweredBy: "Powered by Enterprise POS Hub",
    logoUrl: settings.business_logo || "",
  };

  // 1. THERMAL POS 80MM RECEIPT FORMAT
  if (template === "pos_80mm") {
    return (
      <div className="w-[80mm] min-h-[100mm] bg-white text-black text-[11px] p-2 leading-tight mx-auto border print:border-none print:shadow-none shadow-md">
        {/* POS Header */}
        <div className="text-center space-y-1 pb-2 border-b border-black border-dashed">
          <div className="font-extrabold text-sm tracking-wider uppercase">{businessInfo.name}</div>
          <div className="text-[9px]">{businessInfo.address}</div>
          <div className="text-[9px]">TEL: {businessInfo.phone}</div>
          <div className="font-bold text-[12px] pt-1">SALES RECEIPT</div>
        </div>

        {/* Invoice Info */}
        <div className="py-2 space-y-0.5 border-b border-black border-dashed text-[10px]">
          <div className="flex justify-between">
            <span>INV #:</span>
            <span className="font-bold">{sale.invoice_no}</span>
          </div>
          <div className="flex justify-between">
            <span>DATE:</span>
            <span>{formatDate(sale.sale_date)}</span>
          </div>
          <div className="flex justify-between">
            <span>CUST:</span>
            <span className="font-bold truncate max-w-[120px]">{sale.customer?.name || "Cash Customer"}</span>
          </div>
          {sale.customer?.phone && (
            <div className="flex justify-between">
              <span>TEL:</span>
              <span>{sale.customer.phone}</span>
            </div>
          )}
        </div>

        {/* POS Items Table */}
        <div className="py-2 border-b border-black border-dashed">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-black border-dashed font-bold">
                <th className="text-left py-1">ITEM</th>
                <th className="text-center py-1">QTY</th>
                <th className="text-right py-1">PRICE</th>
                <th className="text-right py-1">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {sale.items.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td className="py-1 pr-1 font-bold">
                    {item.product?.name || "Product"}
                    {item.discount > 0 && (
                      <div className="text-[8px] text-gray-600">Disc: -${item.discount.toFixed(2)}</div>
                    )}
                  </td>
                  <td className="text-center py-1 font-semibold">{item.quantity}</td>
                  <td className="text-right py-1">{item.unit_price.toFixed(2)}</td>
                  <td className="text-right py-1 font-bold">{item.total_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* POS Financial Summary */}
        <div className="py-2 space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>

          {sale.discount_amount > 0 && (
            <div className="flex justify-between">
              <span>ORDER DISC:</span>
              <span>-{formatCurrency(sale.discount_amount)}</span>
            </div>
          )}

          {sale.tax_amount > 0 && (
            <div className="flex justify-between">
              <span>TAX:</span>
              <span>{formatCurrency(sale.tax_amount)}</span>
            </div>
          )}

          <div className="flex justify-between text-[12px] font-extrabold pt-1 border-t border-black">
            <span>TOTAL:</span>
            <span>{formatCurrency(sale.grand_total)}</span>
          </div>

          <div className="flex justify-between font-bold pt-1">
            <span>PAID AMOUNT:</span>
            <span>{formatCurrency(sale.paid_amount)}</span>
          </div>

          <div className="flex justify-between font-bold">
            <span>DUE AMOUNT:</span>
            <span>{formatCurrency(sale.due_amount)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-black border-dashed text-center space-y-1 text-[9px]">
          <div className="font-bold">*** THANK YOU FOR YOUR BUSINESS ***</div>
          {sale.notes && <div className="italic">Note: {sale.notes}</div>}
          <div className="text-[8px] text-gray-600 pt-1">{businessInfo.poweredBy}</div>
        </div>
      </div>
    );
  }

  // 2. A5 PAPER COMPACT FORMAT
  if (template === "a5") {
    return (
      <div className="w-[148mm] min-h-[210mm] bg-white text-black font-sans p-6 mx-auto border print:border-none print:shadow-none shadow-xl rounded-lg space-y-4 text-xs">
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b-2 border-primary">
          <div>
            <div className="font-black text-base text-primary tracking-tight">{businessInfo.name}</div>
            <div className="text-[10px] text-gray-600">{businessInfo.address}</div>
            <div className="text-[10px] text-gray-600">TEL: {businessInfo.phone}</div>
          </div>
          <div className="text-right">
            <div className="font-extrabold text-sm uppercase text-gray-900">SALES INVOICE</div>
            <div className="font-bold text-primary text-xs">{sale.invoice_no}</div>
            <div className="text-[10px] text-gray-500">{formatDate(sale.sale_date)}</div>
          </div>
        </div>

        {/* Customer Box */}
        <div className="p-2.5 bg-gray-50 rounded-lg border flex justify-between text-[11px]">
          <div>
            <span className="text-gray-500 font-semibold block text-[9px] uppercase">BILLED TO:</span>
            <div className="font-bold text-gray-900">{sale.customer?.name || "Walk-in Customer"}</div>
            {sale.customer?.phone && <div className="text-gray-600 text-[10px]">{sale.customer.phone}</div>}
          </div>
          <div className="text-right text-[10px]">
            <span className="text-gray-500 block text-[9px] uppercase">STATUS</span>
            <span className="font-bold uppercase text-primary">{sale.payment_status}</span>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-left text-[11px]">
          <thead className="bg-gray-100 border-y font-bold text-gray-700 uppercase text-[9px]">
            <tr>
              <th className="p-2 w-8">#</th>
              <th className="p-2">Item Description</th>
              <th className="p-2 text-center">Qty</th>
              <th className="p-2 text-right">Price</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sale.items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="p-2 text-gray-500">{idx + 1}</td>
                <td className="p-2 font-medium">
                  {item.product?.name || "Product"}
                  <div className="text-[9px] text-gray-400">{item.product?.product_code}</div>
                </td>
                <td className="p-2 text-center font-bold">{item.quantity}</td>
                <td className="p-2 text-right ">{formatCurrency(item.unit_price)}</td>
                <td className="p-2 text-right font-bold">{formatCurrency(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Financial Summary */}
        <div className="flex justify-end pt-2">
          <div className="w-56 space-y-1 text-[11px]">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="">{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount_amount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Discount:</span>
                <span className="">-{formatCurrency(sale.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-sm border-t pt-1 text-gray-900">
              <span>Grand Total:</span>
              <span className="text-primary">{formatCurrency(sale.grand_total)}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-600">
              <span>Paid:</span>
              <span className="">{formatCurrency(sale.paid_amount)}</span>
            </div>
            <div className="flex justify-between font-bold text-amber-600">
              <span>Due:</span>
              <span className="">{formatCurrency(sale.due_amount)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t text-center space-y-1 text-[10px] text-gray-500">
          <div className="font-semibold text-gray-700">Thank you for your business!</div>
          <div>{businessInfo.poweredBy}</div>
        </div>
      </div>
    );
  }

  // 3. A4 STANDARD PAPER FORMAT (DEFAULT)
  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-gray-900 font-sans p-10 mx-auto border print:border-none print:shadow-none shadow-2xl rounded-xl space-y-8 print:p-8">
      {/* Invoice Header */}
      <div className="flex justify-between items-start pb-6 border-b-2 border-gray-900">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            {businessInfo.logoUrl ? (
              <img src={businessInfo.logoUrl} alt={businessInfo.logoText} className="h-10 w-10 rounded-xl object-contain bg-white shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-gray-900 text-white flex items-center justify-center font-black text-xl shadow-md">
                {businessInfo.logoText?.charAt(0) || "E"}
              </div>
            )}
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-gray-900 uppercase">
                {businessInfo.name}
              </h1>
              <p className="text-xs text-gray-500">{businessInfo.website}</p>
            </div>
          </div>
          <div className="text-xs text-gray-600 space-y-0.5 pl-1">
            <p>{businessInfo.address}</p>
            <p>Phone: {businessInfo.phone} | Email: {businessInfo.email}</p>
          </div>
        </div>

        <div className="text-right space-y-1">
          <div className="inline-block px-3 py-1 bg-gray-900 text-white font-extrabold text-sm uppercase rounded tracking-wider">
            TAX INVOICE
          </div>
          <div className="font-bold text-base text-gray-900 pt-1">#{sale.invoice_no}</div>
          <div className="text-xs text-gray-500">Date: {formatDate(sale.sale_date)}</div>
          <div className="text-xs font-semibold uppercase text-emerald-600">
            Payment Status: {sale.payment_status}
          </div>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            BILLED TO CUSTOMER:
          </span>
          <div className="text-sm font-bold text-gray-900">{sale.customer?.name || "Walk-in Cash Customer"}</div>
          {sale.customer?.phone && <div className="text-gray-600 ">Phone: {sale.customer.phone}</div>}
          {sale.customer?.email && <div className="text-gray-600">Email: {sale.customer.email}</div>}
          {sale.customer?.address && <div className="text-gray-600">Address: {sale.customer.address}</div>}
        </div>

        <div className="text-right space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            INVOICE SUMMARY:
          </span>
          <div className="text-xs">
            <span className="text-gray-500">Total Items: </span>
            <span className="font-bold text-gray-900">{sale.items.length}</span>
          </div>
          <div className="text-xs">
            <span className="text-gray-500">Issued By: </span>
            <span className="font-semibold text-gray-900">Store Staff</span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-900 text-white font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3 text-center w-10">#</th>
              <th className="p-3">Product Name & Description</th>
              <th className="p-3 text-center w-20">Quantity</th>
              <th className="p-3 text-right w-28">Unit Price</th>
              <th className="p-3 text-right w-24">Discount</th>
              <th className="p-3 text-right w-32">Line Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-800">
            {sale.items.map((item, idx) => (
              <tr key={item.id || idx} className="hover:bg-gray-50">
                <td className="p-3 text-center text-gray-500 font-semibold">{idx + 1}</td>
                <td className="p-3">
                  <div className="font-bold text-gray-900">{item.product?.name || "Product"}</div>
                  <div className="text-[10px] text-gray-400">{item.product?.product_code}</div>
                </td>
                <td className="p-3 text-center font-bold text-gray-900">
                  {item.quantity} {item.product?.unit || ""}
                </td>
                <td className="p-3 text-right ">{formatCurrency(item.unit_price)}</td>
                <td className="p-3 text-right text-amber-600">
                  {item.discount > 0 ? `-${formatCurrency(item.discount)}` : "-"}
                </td>
                <td className="p-3 text-right font-bold text-gray-900">
                  {formatCurrency(item.total_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Summary & Signatures */}
      <div className="grid grid-cols-2 gap-8 pt-4">
        <div className="space-y-4">
          {sale.notes && (
            <div className="p-3 rounded-lg bg-gray-50 border text-xs text-gray-600 space-y-1">
              <span className="font-bold text-gray-700 block">Terms & Notes:</span>
              <p>{sale.notes}</p>
            </div>
          )}

          <div className="pt-12 flex justify-between text-xs text-gray-400 font-semibold">
            <div className="border-t border-gray-300 pt-1 w-36 text-center">Customer Signature</div>
            <div className="border-t border-gray-300 pt-1 w-36 text-center">Authorized Stamp</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Item Subtotal:</span>
            <span className="font-semibold text-gray-900">{formatCurrency(sale.subtotal)}</span>
          </div>

          {sale.discount_amount > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Order Discount:</span>
              <span className="font-semibold">-{formatCurrency(sale.discount_amount)}</span>
            </div>
          )}

          {sale.tax_amount > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Tax / VAT:</span>
              <span className="font-semibold">{formatCurrency(sale.tax_amount)}</span>
            </div>
          )}

          <div className="flex justify-between font-black text-sm pt-2 border-t-2 border-gray-900 text-gray-900">
            <span>Grand Total:</span>
            <span className="text-base">{formatCurrency(sale.grand_total)}</span>
          </div>

          <div className="flex justify-between font-bold text-emerald-600 pt-1">
            <span>Paid Amount:</span>
            <span className="">{formatCurrency(sale.paid_amount)}</span>
          </div>

          <div className="flex justify-between font-bold text-amber-600">
            <span>Remaining Due:</span>
            <span className="">{formatCurrency(sale.due_amount)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-8 border-t border-gray-200 text-center space-y-1 text-xs text-gray-500">
        <p className="font-bold text-gray-700">Thank you for your business!</p>
        <p className="text-[10px] text-gray-400">{businessInfo.poweredBy}</p>
      </div>
    </div>
  );
}
