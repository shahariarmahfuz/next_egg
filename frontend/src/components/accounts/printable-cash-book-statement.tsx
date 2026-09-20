"use client";

import React from "react";
import {
  CashBookSummary,
  SaleItem,
  CustomerCollectionItem,
  SaleReportSummaryData,
} from "@/types";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/utils/formatters";
import { useSettingsStore } from "@/store/settings";

export interface PrintableCashBookStatementProps {
  summary: CashBookSummary;
  sales?: SaleItem[];
  salesAggregate?: Record<string, number> | SaleReportSummaryData;
  collections?: CustomerCollectionItem[];
}

export const PrintableCashBookStatement = React.forwardRef<
  HTMLDivElement,
  PrintableCashBookStatementProps
>(({ summary, sales = [], collections = [] }, ref) => {
  const { settings } = useSettingsStore();

  // Dynamic Header & Business Metadata
  const businessName =
    settings.business_name || summary.company_name || "BUSINESS ENTERPRISE";
  const contactParts = [
    settings.business_address || summary.company_address,
    (settings.business_phone || summary.company_phone)
      ? `Mobile: ${settings.business_phone || summary.company_phone}`
      : null,
  ].filter(Boolean);
  const businessContact = contactParts.join(" | ");

  const currencySymbol =
    settings.currency?.symbol || summary.currency_symbol || "৳";

  // Dynamic Date Formatting: DD/MM/YYYY
  const formattedDate = summary.date
    ? (() => {
        try {
          const parts = summary.date.split("-");
          if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return formatDate(summary.date);
        } catch {
          return summary.date;
        }
      })()
    : "";

  // -------------------------------------------------------------
  // 1. CASH SALES & COLLECTION ROWS
  // -------------------------------------------------------------
  // Gather cash inflows: cash sales and collections
  interface CashInflowRow {
    id: string;
    customerName: string;
    productName: string;
    unitQty: string;
    rate: string;
    amount: number;
  }

  const cashInflowRows: CashInflowRow[] = [];

  // A. Sales with paid cash amount
  const cashSales = (sales || []).filter((s) => (s.paid_amount || 0) > 0);
  for (const sale of cashSales) {
    const custName = sale.customer?.name || "Cash Customer";
    if (sale.items && sale.items.length > 0) {
      if (sale.items.length === 1) {
        const item = sale.items[0];
        const unit = item.product?.unit || "";
        cashInflowRows.push({
          id: `sale-${sale.id}-${item.id}`,
          customerName: custName,
          productName: item.product?.name || "Product",
          unitQty: `${formatNumber(item.quantity)} ${unit}`.trim(),
          rate: formatNumber(item.unit_price),
          amount: sale.paid_amount,
        });
      } else {
        // Multiple items: list each product line
        for (let idx = 0; idx < sale.items.length; idx++) {
          const item = sale.items[idx];
          const unit = item.product?.unit || "";
          const itemLineTotal =
            item.total_price || item.quantity * item.unit_price;
          cashInflowRows.push({
            id: `sale-${sale.id}-${item.id}`,
            customerName: idx === 0 ? custName : `${custName} (Cont.)`,
            productName: item.product?.name || "Product",
            unitQty: `${formatNumber(item.quantity)} ${unit}`.trim(),
            rate: formatNumber(item.unit_price),
            amount: itemLineTotal,
          });
        }
      }
    } else {
      cashInflowRows.push({
        id: `sale-${sale.id}`,
        customerName: custName,
        productName: "Cash Sale",
        unitQty: "-",
        rate: "-",
        amount: sale.paid_amount,
      });
    }
  }

  // B. Customer Collections
  for (const col of collections || []) {
    cashInflowRows.push({
      id: `col-${col.id}`,
      customerName: col.customer?.name || "Customer",
      productName:
        col.notes || col.reference_no
          ? `Due Collection (${col.notes || col.reference_no})`
          : "Previous Due Collection",
      unitQty: "-",
      rate: "-",
      amount: col.amount,
    });
  }

  // Fallback: If sales and collections were empty but summary.items has cash inflows
  if (cashInflowRows.length === 0) {
    const cashItems = (summary.items || []).filter(
      (it) => it.credit > 0 && it.transaction_type !== "opening_balance"
    );
    for (const it of cashItems) {
      cashInflowRows.push({
        id: it.id,
        customerName: it.name && it.name !== "—" ? it.name : "Customer",
        productName:
          it.transaction_type === "collection"
            ? "Previous Due Collection"
            : it.description || "Cash Sale",
        unitQty: "-",
        rate: "-",
        amount: it.credit,
      });
    }
  }

  const totalCashCollection = summary.today_cash_received;

  // -------------------------------------------------------------
  // 2. DUE SALES (CREDIT) ROWS
  // -------------------------------------------------------------
  interface DueSaleRow {
    id: string;
    customerName: string;
    productName: string;
    unitQty: string;
    rate: string;
    dueAmount: number;
  }

  const dueSaleRows: DueSaleRow[] = [];
  const creditSales = (sales || []).filter((s) => (s.due_amount || 0) > 0);

  for (const sale of creditSales) {
    const custName = sale.customer?.name || "Customer";
    if (sale.items && sale.items.length > 0) {
      if (sale.items.length === 1) {
        const item = sale.items[0];
        const unit = item.product?.unit || "";
        dueSaleRows.push({
          id: `due-${sale.id}-${item.id}`,
          customerName: custName,
          productName: item.product?.name || "Product",
          unitQty: `${formatNumber(item.quantity)} ${unit}`.trim(),
          rate: formatNumber(item.unit_price),
          dueAmount: sale.due_amount,
        });
      } else {
        const productNames = sale.items
          .map((it) => it.product?.name)
          .filter(Boolean)
          .join(", ");
        const totalQty = sale.items.reduce(
          (sum, it) => sum + (it.quantity || 0),
          0
        );
        dueSaleRows.push({
          id: `due-${sale.id}`,
          customerName: custName,
          productName: productNames || "Multiple Products",
          unitQty: `${formatNumber(totalQty)} Pcs`,
          rate: "-",
          dueAmount: sale.due_amount,
        });
      }
    } else {
      dueSaleRows.push({
        id: `due-${sale.id}`,
        customerName: custName,
        productName: "Due Sale",
        unitQty: "-",
        rate: "-",
        dueAmount: sale.due_amount,
      });
    }
  }

  const totalDueSales = dueSaleRows.reduce(
    (sum, r) => sum + (r.dueAmount || 0),
    0
  );

  // -------------------------------------------------------------
  // 3. DAILY EXPENSES ROWS
  // -------------------------------------------------------------
  // STRICT RULE: The "Daily Expenses" section must contain ONLY actual
  // Expense records created from the Expense module.
  // Purchases, Purchase Payments, Supplier Payments, and Refunds
  // must NEVER appear in the Expense section.
  interface ExpenseRow {
    id: string;
    description: string;
    type: string;
    amount: number;
  }

  const expenseRows: ExpenseRow[] = [];
  const actualExpenseItems = (summary.items || []).filter(
    (it) => it.transaction_type === "expense" && it.debit > 0
  );

  for (const it of actualExpenseItems) {
    const expType = it.name && it.name !== "—" ? it.name : "Expense";
    expenseRows.push({
      id: it.id,
      description: it.description || `Expense (${expType})`,
      type: expType,
      amount: it.debit,
    });
  }

  const totalExpense =
    typeof summary.total_expense === "number"
      ? summary.total_expense
      : expenseRows.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div ref={ref} className="cash-book-master-print w-full">
      {/* Complete CSS styles preserved exactly from Master Template */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');

            /* =========================================================
               RESET & MASTER STYLES
            ========================================================= */
            .cash-book-master-print * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            .cash-book-master-print {
                width: 100%;
                font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                background: #f7f9fa;
                color: #111;
                padding: 10px;
                font-size: 8.8px;
                font-weight: 400;
                line-height: 1.25;
                -webkit-font-smoothing: antialiased;
            }

            /* =========================================================
               PRINT BUTTON
            ========================================================= */
            .cash-book-master-print .no-print {
                text-align: center;
                margin-bottom: 12px;
            }

            .cash-book-master-print .print-btn {
                background: #1a73e8;
                color: #fff;
                border: none;
                padding: 7px 18px;
                font-size: 11px;
                font-weight: 500;
                border-radius: 4px;
                cursor: pointer;
            }

            /* =========================================================
               A5 PAGE
            ========================================================= */
            .cash-book-master-print .page {
                width: 148mm;
                max-width: 100%;
                margin: 0 auto;
                background: #fff;
                padding: 7mm;
                box-shadow: 0 0 8px rgba(0, 0, 0, 0.08);
            }

            /* =========================================================
               HEADER
            ========================================================= */
            .cash-book-master-print .header {
                text-align: center;
                position: relative;
                padding-bottom: 4px;
                margin-bottom: 4px;
            }

            .cash-book-master-print .header::after {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                height: 0.5px;
                background: rgba(0, 0, 0, 0.12);
                transform: scaleY(0.5);
                transform-origin: bottom center;
            }

            .cash-book-master-print .header h1 {
                font-size: 15px;
                font-weight: 700;
                color: #000;
                letter-spacing: 0.5px;
                margin-bottom: 1px;
                text-transform: uppercase;
            }

            .cash-book-master-print .header p {
                font-size: 8px;
                color: #444;
                font-weight: 400;
            }

            .cash-book-master-print .header .doc-title {
                display: inline-block;
                position: relative;
                margin-top: 2px;
                padding: 1px 8px;
                font-weight: 600;
                font-size: 8.5px;
                color: #000;
                text-transform: uppercase;
            }

            .cash-book-master-print .header .doc-title::before {
                content: "";
                position: absolute;
                inset: 0;
                border: 0.5px solid rgba(0, 0, 0, 0.12);
                border-radius: 8px;
                transform: scale(0.99);
                pointer-events: none;
            }

            /* =========================================================
               META INFORMATION
            ========================================================= */
            .cash-book-master-print .meta-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
                font-size: 8.5px;
                font-weight: 400;
                background: #fafafa;
                padding: 3px 5px;
                position: relative;
            }

            .cash-book-master-print .meta-info::before {
                content: "";
                position: absolute;
                inset: 0;
                border: 0.5px solid rgba(0, 0, 0, 0.11);
                transform: scale(0.995);
                pointer-events: none;
            }

            /* =========================================================
               SECTION TITLE
            ========================================================= */
            .cash-book-master-print .section-title {
                font-size: 8.5px;
                font-weight: 700;
                text-transform: uppercase;
                margin-top: 4px;
                margin-bottom: 2px;
                color: #111;
            }

            /* =========================================================
               CSS GRID TABLE
            ========================================================= */
            .cash-book-master-print .css-table {
                width: 100%;
                margin-bottom: 4px;
            }

            .cash-book-master-print .css-row {
                display: grid;
                min-height: 16.5px;
                position: relative;
                background: transparent;
                break-inside: avoid;
                page-break-inside: avoid;
            }

            /* ULTRA THIN ROW SEPARATOR */
            .cash-book-master-print .css-row::after {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                height: 0.5px;
                background: rgba(0, 0, 0, 0.11);
                transform: scaleY(0.5);
                transform-origin: bottom center;
                pointer-events: none;
            }

            .cash-book-master-print .css-cell {
                min-width: 0;
                padding: 2.5px 3.5px;
                font-size: 8.5px;
                font-weight: 400;
                overflow: hidden;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }

            /* CASH TABLE COLUMNS */
            .cash-book-master-print .cash-table .css-row {
                grid-template-columns: 5% 29% 27% 13% 11% 15%;
            }

            /* DUE TABLE COLUMNS */
            .cash-book-master-print .due-table .css-row {
                grid-template-columns: 5% 29% 27% 13% 11% 15%;
            }

            /* EXPENSE TABLE COLUMNS */
            .cash-book-master-print .expense-table .css-row {
                grid-template-columns: 5% 66% 14% 15%;
            }

            /* HEADER ROW */
            .cash-book-master-print .css-header {
                min-height: 16px;
                font-weight: 700;
                text-align: center;
                background: #f6f7f9;
                position: relative;
            }

            .cash-book-master-print .css-header::before {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                top: 0;
                height: 0.5px;
                background: rgba(0, 0, 0, 0.11);
                transform: scaleY(0.5);
                transform-origin: top center;
                pointer-events: none;
            }

            .cash-book-master-print .css-header::after {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                height: 0.5px;
                background: rgba(0, 0, 0, 0.13);
                transform: scaleY(0.5);
                transform-origin: bottom center;
                pointer-events: none;
            }

            .cash-book-master-print .css-header .css-cell {
                font-size: 8.5px;
                font-weight: 700;
                text-transform: uppercase;
            }

            /* ALIGNMENT */
            .cash-book-master-print .text-center { text-align: center; }
            .cash-book-master-print .text-left { text-align: left; }
            .cash-book-master-print .text-right { text-align: right; }

            /* TOTAL ROW */
            .cash-book-master-print .total-row {
                min-height: 17px;
                background: #fafafa;
                font-weight: 700;
                position: relative;
            }

            .cash-book-master-print .total-row::before {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                top: 0;
                height: 0.5px;
                background: rgba(0, 0, 0, 0.13);
                transform: scaleY(0.5);
                transform-origin: top center;
                pointer-events: none;
            }

            .cash-book-master-print .total-row::after {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                height: 0.5px;
                background: rgba(0, 0, 0, 0.13);
                transform: scaleY(0.5);
                transform-origin: bottom center;
                pointer-events: none;
            }

            .cash-book-master-print .total-label {
                text-align: right;
                padding-right: 5px;
                font-weight: 700;
            }

            .cash-book-master-print .total-value {
                text-align: right;
                font-weight: 700;
            }

            /* =========================================================
               SUMMARY BOX
            ========================================================= */
            .cash-book-master-print .summary-box {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 5px;
                padding: 4px 6px;
                background: #fafbfc;
                position: relative;
                break-inside: avoid;
                page-break-inside: avoid;
            }

            .cash-book-master-print .summary-box::before {
                content: "";
                position: absolute;
                inset: 0;
                border: 0.5px solid rgba(0, 0, 0, 0.11);
                transform: scale(0.995);
                pointer-events: none;
            }

            .cash-book-master-print .summary-item {
                text-align: center;
                min-width: 0;
            }

            .cash-book-master-print .summary-item .title {
                display: block;
                color: #555;
                font-size: 7.5px;
                font-weight: 600;
                text-transform: uppercase;
                margin-bottom: 1px;
            }

            .cash-book-master-print .summary-item .val {
                font-weight: 700;
                color: #000;
                font-size: 10px;
            }

            .cash-book-master-print .summary-symbol {
                font-weight: 700;
                font-size: 10px;
                padding: 0 2px;
            }

            .cash-book-master-print .summary-divider {
                width: 0.5px;
                height: 18px;
                background: rgba(0, 0, 0, 0.11);
                transform: scaleX(0.5);
                transform-origin: center;
            }

            /* =========================================================
               SIGNATURES
            ========================================================= */
            .cash-book-master-print .signature-area {
                display: flex;
                justify-content: space-between;
                margin-top: 15px;
                padding: 0 6px;
                break-inside: avoid;
                page-break-inside: avoid;
            }

            .cash-book-master-print .sig-block {
                text-align: center;
                width: 75px;
            }

            .cash-book-master-print .sig-line {
                height: 0.5px;
                margin-bottom: 2px;
                background: repeating-linear-gradient(
                    to right,
                    rgba(0, 0, 0, 0.18) 0,
                    rgba(0, 0, 0, 0.18) 2px,
                    transparent 2px,
                    transparent 4px
                );
                transform: scaleY(0.5);
                transform-origin: bottom;
            }

            .cash-book-master-print .sig-text {
                font-size: 7.5px;
                color: #333;
                font-weight: 400;
            }

            /* =========================================================
               PRINT MEDIA STYLES
            ========================================================= */
            @media print {
                @page {
                    size: A5 portrait;
                    margin: 5mm;
                }

                html, body {
                    width: 100% !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff !important;
                }

                #print-root {
                    display: block !important;
                    position: static !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff !important;
                }

                .cash-book-master-print {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff !important;
                    font-size: 8.8px;
                }

                .cash-book-master-print .no-print {
                    display: none !important;
                }

                .cash-book-master-print .page {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff !important;
                    box-shadow: none !important;
                }

                .cash-book-master-print .css-row {
                    background: transparent !important;
                    border: none !important;
                    outline: none !important;
                }

                .cash-book-master-print .css-row::after {
                    content: "" !important;
                    display: block !important;
                    position: absolute !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    height: 0.5px !important;
                    background: rgba(0, 0, 0, 0.11) !important;
                    transform: scaleY(0.5) !important;
                    transform-origin: bottom center !important;
                }

                .cash-book-master-print .css-header {
                    background: #f6f7f9 !important;
                }

                .cash-book-master-print .css-header::before {
                    height: 0.5px !important;
                    background: rgba(0, 0, 0, 0.11) !important;
                    transform: scaleY(0.5) !important;
                }

                .cash-book-master-print .css-header::after {
                    height: 0.5px !important;
                    background: rgba(0, 0, 0, 0.13) !important;
                    transform: scaleY(0.5) !important;
                }

                .cash-book-master-print .total-row {
                    background: #fafafa !important;
                }

                .cash-book-master-print .total-row::before {
                    height: 0.5px !important;
                    background: rgba(0, 0, 0, 0.13) !important;
                    transform: scaleY(0.5) !important;
                }

                .cash-book-master-print .total-row::after {
                    height: 0.5px !important;
                    background: rgba(0, 0, 0, 0.13) !important;
                    transform: scaleY(0.5) !important;
                }

                .cash-book-master-print .header::after {
                    height: 0.5px !important;
                    background: rgba(0, 0, 0, 0.11) !important;
                    transform: scaleY(0.5) !important;
                }

                .cash-book-master-print .meta-info {
                    background: #fafafa !important;
                }

                .cash-book-master-print .meta-info::before {
                    border: 0.5px solid rgba(0, 0, 0, 0.11) !important;
                }

                .cash-book-master-print .header .doc-title::before {
                    border: 0.5px solid rgba(0, 0, 0, 0.12) !important;
                }

                .cash-book-master-print .summary-box {
                    background: #fafbfc !important;
                }

                .cash-book-master-print .summary-box::before {
                    border: 0.5px solid rgba(0, 0, 0, 0.11) !important;
                }

                .cash-book-master-print .summary-divider {
                    width: 0.5px !important;
                    background: rgba(0, 0, 0, 0.11) !important;
                    transform: scaleX(0.5) !important;
                }

                .cash-book-master-print .sig-line {
                    height: 0.5px !important;
                    background: repeating-linear-gradient(
                        to right,
                        rgba(0, 0, 0, 0.18) 0,
                        rgba(0, 0, 0, 0.18) 2px,
                        transparent 2px,
                        transparent 4px
                    ) !important;
                    transform: scaleY(0.5) !important;
                }

                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }
          `,
        }}
      />

      {/* A5 PAGE CONTAINER */}
      <div className="page">
        {/* =====================================================
             HEADER
        ===================================================== */}
        <div className="header">
          <h1>{businessName}</h1>
          {businessContact && <p>{businessContact}</p>}
          <div className="doc-title">Daily Sales & Cash Statement</div>
        </div>

        {/* =====================================================
             META INFORMATION
        ===================================================== */}
        <div className="meta-info">
          <div>
            <strong>Date:</strong> {formattedDate}
          </div>
          <div>
            <strong>B/F (Opening Cash):</strong>{" "}
            {formatCurrency(summary.previous_balance)}
          </div>
          <div>
            <strong>Sheet No:</strong> 01
          </div>
        </div>

        {/* =====================================================
             1. CASH SALES & COLLECTION
        ===================================================== */}
        <div className="section-title">1. Cash Sales & Collection</div>

        <div className="css-table cash-table">
          {/* HEADER */}
          <div className="css-row css-header">
            <div className="css-cell">#</div>
            <div className="css-cell">Customer Name</div>
            <div className="css-cell">Product Name</div>
            <div className="css-cell">Unit/Qty</div>
            <div className="css-cell">Rate ({currencySymbol})</div>
            <div className="css-cell">Amount ({currencySymbol})</div>
          </div>

          {/* ROWS */}
          {cashInflowRows.map((row, idx) => (
            <div key={row.id} className="css-row">
              <div className="css-cell text-center">{idx + 1}</div>
              <div className="css-cell text-left">{row.customerName}</div>
              <div className="css-cell text-left">{row.productName}</div>
              <div className="css-cell text-center">{row.unitQty}</div>
              <div className="css-cell text-right">{row.rate}</div>
              <div className="css-cell text-right">
                {formatNumber(row.amount)}
              </div>
            </div>
          ))}

          {cashInflowRows.length === 0 && (
            <div className="css-row">
              <div
                className="css-cell text-center"
                style={{
                  gridColumn: "1 / 7",
                  fontStyle: "italic",
                  color: "#666",
                  padding: "6px",
                }}
              >
                No cash sales or collections for this date.
              </div>
            </div>
          )}

          {/* TOTAL */}
          <div className="css-row total-row">
            <div className="css-cell total-label" style={{ gridColumn: "1 / 6" }}>
              Total Cash Collection:
            </div>
            <div className="css-cell total-value">
              {formatCurrency(totalCashCollection)}
            </div>
          </div>
        </div>

        {/* =====================================================
             2. DUE SALES (CREDIT)
        ===================================================== */}
        <div className="section-title">2. Due Sales (Credit)</div>

        <div className="css-table due-table">
          {/* HEADER */}
          <div className="css-row css-header">
            <div className="css-cell">#</div>
            <div className="css-cell">Customer Name</div>
            <div className="css-cell">Product Name</div>
            <div className="css-cell">Unit/Qty</div>
            <div className="css-cell">Rate ({currencySymbol})</div>
            <div className="css-cell">Due ({currencySymbol})</div>
          </div>

          {/* ROWS */}
          {dueSaleRows.map((row, idx) => (
            <div key={row.id} className="css-row">
              <div className="css-cell text-center">{idx + 1}</div>
              <div className="css-cell text-left">{row.customerName}</div>
              <div className="css-cell text-left">{row.productName}</div>
              <div className="css-cell text-center">{row.unitQty}</div>
              <div className="css-cell text-right">{row.rate}</div>
              <div className="css-cell text-right">
                {formatNumber(row.dueAmount)}
              </div>
            </div>
          ))}

          {dueSaleRows.length === 0 && (
            <div className="css-row">
              <div
                className="css-cell text-center"
                style={{
                  gridColumn: "1 / 7",
                  fontStyle: "italic",
                  color: "#666",
                  padding: "6px",
                }}
              >
                No due sales for this date.
              </div>
            </div>
          )}

          {/* TOTAL */}
          <div className="css-row total-row">
            <div
              className="css-cell total-label"
              style={{
                gridColumn: "1 / 6",
                color: "#b02a37",
              }}
            >
              Total Due Sales:
            </div>
            <div className="css-cell total-value" style={{ color: "#b02a37" }}>
              {formatCurrency(totalDueSales)}
            </div>
          </div>
        </div>

        {/* =====================================================
             3. DAILY EXPENSES
        ===================================================== */}
        <div className="section-title">3. Daily Expenses</div>

        <div className="css-table expense-table">
          {/* HEADER */}
          <div className="css-row css-header">
            <div className="css-cell">#</div>
            <div className="css-cell">Expense Description</div>
            <div className="css-cell">Type</div>
            <div className="css-cell">Amount ({currencySymbol})</div>
          </div>

          {/* ROWS */}
          {expenseRows.map((row, idx) => (
            <div key={row.id} className="css-row">
              <div className="css-cell text-center">{idx + 1}</div>
              <div className="css-cell text-left">{row.description}</div>
              <div className="css-cell text-center">{row.type}</div>
              <div className="css-cell text-right">
                {formatNumber(row.amount)}
              </div>
            </div>
          ))}

          {expenseRows.length === 0 && (
            <div className="css-row">
              <div
                className="css-cell text-center"
                style={{
                  gridColumn: "1 / 5",
                  fontStyle: "italic",
                  color: "#666",
                  padding: "6px",
                }}
              >
                No expenses recorded for this date.
              </div>
            </div>
          )}

          {/* TOTAL */}
          <div className="css-row total-row">
            <div className="css-cell total-label" style={{ gridColumn: "1 / 4" }}>
              Total Expense:
            </div>
            <div className="css-cell total-value">
              {formatCurrency(totalExpense)}
            </div>
          </div>
        </div>

        {/* =====================================================
             FINAL BALANCE SUMMARY
        ===================================================== */}
        {(() => {
          const totalPaid = summary.total_cash_paid ?? summary.today_cash_expense;
          const hasOtherOutflows =
            (summary.total_supplier_paid ?? 0) > 0 ||
            totalPaid > (totalExpense + 0.001);

          return (
            <div className="summary-box">
              {/* Opening */}
              <div className="summary-item">
                <span className="title">Opening (B/F)</span>
                <span className="val">{formatCurrency(summary.previous_balance || 0)}</span>
              </div>

              <div className="summary-symbol">+</div>

              {/* Cash Collection */}
              <div className="summary-item">
                <span className="title">Cash Collection</span>
                <span className="val">
                  {formatCurrency(summary.today_cash_received || 0)}
                </span>
              </div>

              <div className="summary-symbol">-</div>

              {/* Expense / Total Cash Paid */}
              <div className="summary-item">
                <span className="title">
                  {hasOtherOutflows ? "Total Cash Paid" : "Total Expense"}
                </span>
                <span className="val">
                  {formatCurrency(hasOtherOutflows ? totalPaid : totalExpense)}
                </span>
                {hasOtherOutflows && (
                  <span
                    style={{
                      fontSize: "6.5px",
                      color: "#666",
                      display: "block",
                      marginTop: "1px",
                      fontWeight: 500,
                    }}
                  >
                    (Exp: {formatCurrency(totalExpense)} | Supp: {formatCurrency(summary.total_supplier_paid || 0)})
                  </span>
                )}
              </div>

              <div className="summary-symbol">=</div>

              {/* Net Cash */}
              <div className="summary-item">
                <span className="title" style={{ color: "#0b5ed7" }}>
                  Net Cash in Hand
                </span>
                <span className="val" style={{ color: "#0b5ed7" }}>
                  {formatCurrency(summary.closing_cash_balance)}
                </span>
              </div>

              {/* Divider */}
              <div className="summary-divider"></div>

              {/* Due */}
              <div className="summary-item">
                <span className="title" style={{ color: "#b02a37" }}>
                  Total Due Sale
                </span>
                <span className="val" style={{ color: "#b02a37" }}>
                  {formatCurrency(totalDueSales)}
                </span>
              </div>
            </div>
          );
        })()}

        {/* =====================================================
             SIGNATURES
        ===================================================== */}
        <div className="signature-area">
          <div className="sig-block">
            <div className="sig-line"></div>
            <div className="sig-text">Prepared By</div>
          </div>

          <div className="sig-block">
            <div className="sig-line"></div>
            <div className="sig-text">Verified By</div>
          </div>

          <div className="sig-block">
            <div className="sig-line"></div>
            <div className="sig-text">Proprietor / Manager</div>
          </div>
        </div>
      </div>
    </div>
  );
});

PrintableCashBookStatement.displayName = "PrintableCashBookStatement";
