"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsService } from "@/services/api";
import {
  CashBookSummary,
  SaleItem,
  CustomerCollectionItem,
  SaleReportSummaryData,
} from "@/types";
import { formatNumber } from "@/utils/formatters";
import { useSettingsStore } from "@/store/settings";

export interface PrintableCashBookStatementProps {
  summary: CashBookSummary;
  sales?: SaleItem[];
  salesAggregate?: Record<string, number> | SaleReportSummaryData;
  collections?: CustomerCollectionItem[];
  defaultMergeMode?: "normal" | "selected" | "all";
  defaultSelectedCustomerIds?: string[];
}

export const PrintableCashBookStatement = React.forwardRef<
  HTMLDivElement,
  PrintableCashBookStatementProps
>(
  (
    {
      summary,
      sales = [],
      collections = [],
      defaultMergeMode,
      defaultSelectedCustomerIds,
    },
    ref
  ) => {
    const { settings } = useSettingsStore();

    // Query print merge settings
    const { data: printMergeConfig } = useQuery({
      queryKey: ["print-merge-config"],
      queryFn: () => settingsService.getPrintMergeConfig(),
      staleTime: 60000,
    });

    const [activeMergeMode, setActiveMergeMode] = useState<"normal" | "selected" | "all">(
      defaultMergeMode || "normal"
    );

    useEffect(() => {
      if (defaultMergeMode) {
        setActiveMergeMode(defaultMergeMode);
      } else if (printMergeConfig?.data?.merge_mode) {
        setActiveMergeMode(printMergeConfig.data.merge_mode);
      }
    }, [defaultMergeMode, printMergeConfig]);

    const activeSelectedCustomerIds = useMemo(() => {
      if (defaultSelectedCustomerIds && defaultSelectedCustomerIds.length > 0) {
        return defaultSelectedCustomerIds;
      }
      return printMergeConfig?.data?.selected_customer_ids || [];
    }, [defaultSelectedCustomerIds, printMergeConfig]);

  const businessName =
    (settings.business_name || summary.company_name || "AKOTA POULTRY").toUpperCase();

  const websiteName =
    settings.website || settings.business_name || summary.company_name || "";

  const currencySymbol =
    settings.currency?.symbol || summary.currency_symbol || "৳";

  // Format date helper (DD/MM/YYYY)
  const formatDisplayDate = (dStr?: string) => {
    if (!dStr) return "";
    try {
      const clean = dStr.split("T")[0];
      const parts = clean.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  // 1. CASH SALES & COLLECTION ROWS
  interface RawInflowItem {
    id: string;
    customerId: string | null;
    customerName: string;
    productName: string;
    quantity: number;
    unit: string;
    rate: number | null;
    amount: number;
    isCollection: boolean;
  }

  const rawInflowItems: RawInflowItem[] = [];

  const cashSales = (sales || []).filter((s) => (s.paid_amount || 0) > 0);
  for (const sale of cashSales) {
    const custId = sale.customer_id || sale.customer?.id || null;
    const custName = sale.customer?.name || "নগদ বিক্রি";
    if (sale.items && sale.items.length > 0) {
      if (sale.items.length === 1) {
        const item = sale.items[0];
        const unit = item.product?.unit || "pcs";
        rawInflowItems.push({
          id: `sale-${sale.id}-${item.id}`,
          customerId: custId,
          customerName: custName,
          productName: item.product?.name || "ডিম",
          quantity: Number(item.quantity) || 0,
          unit,
          rate: Number(item.unit_price) || null,
          amount: sale.paid_amount,
          isCollection: false,
        });
      } else {
        const productNames = Array.from(
          new Set(
            sale.items
              .map((it) => it.product?.name?.trim())
              .filter((n): n is string => Boolean(n))
          )
        ).join(", ");
        const totalQty = sale.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
        rawInflowItems.push({
          id: `sale-${sale.id}`,
          customerId: custId,
          customerName: custName,
          productName: productNames || "ডিম",
          quantity: totalQty,
          unit: "pcs",
          rate: null,
          amount: sale.paid_amount,
          isCollection: false,
        });
      }
    } else {
      rawInflowItems.push({
        id: `sale-${sale.id}`,
        customerId: custId,
        customerName: custName,
        productName: "নগদ বিক্রি",
        quantity: 0,
        unit: "pcs",
        rate: null,
        amount: sale.paid_amount,
        isCollection: false,
      });
    }
  }

  for (const col of collections || []) {
    const custId = col.customer_id || col.customer?.id || null;
    const custName = col.customer?.name || "Customer";
    rawInflowItems.push({
      id: `col-${col.id}`,
      customerId: custId,
      customerName: custName,
      productName: col.notes || col.reference_no
        ? `Previous Due Collection (${col.notes || col.reference_no})`
        : "Previous Due Collection",
      quantity: 0,
      unit: "pcs",
      rate: null,
      amount: col.amount,
      isCollection: true,
    });
  }

  if (rawInflowItems.length === 0) {
    const cashItems = (summary.items || []).filter(
      (it) => it.credit > 0 && it.transaction_type !== "opening_balance"
    );
    for (const it of cashItems) {
      rawInflowItems.push({
        id: it.id,
        customerId: null,
        customerName: it.name && it.name !== "—" ? it.name : "নগদ বিক্রি",
        productName:
          it.transaction_type === "collection"
            ? "Previous Due Collection"
            : it.description || "Cash Sale",
        quantity: 0,
        unit: "pcs",
        rate: null,
        amount: it.credit,
        isCollection: it.transaction_type === "collection",
      });
    }
  }

  interface CashInflowRow {
    id: string;
    customerName: string;
    productName: string;
    unitQty: string;
    rate: string;
    amount: number;
  }

  const cashInflowRows: CashInflowRow[] = [];

  if (activeMergeMode === "normal") {
    for (const it of rawInflowItems) {
      cashInflowRows.push({
        id: it.id,
        customerName: it.customerName,
        productName: it.productName,
        unitQty: it.quantity > 0 ? `${formatNumber(it.quantity)} ${it.unit}`.trim() : "-",
        rate: it.rate != null ? formatNumber(it.rate) : "-",
        amount: it.amount,
      });
    }
  } else {
    const shouldMergeInflow = (it: RawInflowItem) => {
      if (activeMergeMode === "all") {
        return Boolean(it.customerId || (it.customerName && it.customerName !== "নগদ বিক্রি"));
      }
      if (activeMergeMode === "selected") {
        if (it.customerId && activeSelectedCustomerIds.includes(it.customerId)) {
          return true;
        }
        return false;
      }
      return false;
    };

    const inflowGroupMap = new Map<string, RawInflowItem[]>();
    const unmergedInflowList: RawInflowItem[] = [];

    for (const it of rawInflowItems) {
      if (shouldMergeInflow(it)) {
        const key = it.customerId || it.customerName;
        if (!inflowGroupMap.has(key)) {
          inflowGroupMap.set(key, []);
        }
        inflowGroupMap.get(key)!.push(it);
      } else {
        unmergedInflowList.push(it);
      }
    }

    for (const [key, items] of inflowGroupMap.entries()) {
      if (items.length === 1) {
        const it = items[0];
        cashInflowRows.push({
          id: it.id,
          customerName: it.customerName,
          productName: it.productName,
          unitQty: it.quantity > 0 ? `${formatNumber(it.quantity)} ${it.unit}`.trim() : "-",
          rate: it.rate != null ? formatNumber(it.rate) : "-",
          amount: it.amount,
        });
      } else {
        const customerName = items[0].customerName;
        const totalAmount = items.reduce((sum, it) => sum + (it.amount || 0), 0);
        const totalQty = items.reduce((sum, it) => sum + (it.quantity || 0), 0);

        const distinctProducts = Array.from(
          new Set(
            items
              .filter((it) => !it.isCollection && it.productName && it.productName !== "নগদ বিক্রি")
              .flatMap((it) => it.productName.split(","))
              .map((p) => p.trim())
              .filter(Boolean)
          )
        );
        const hasCollections = items.some((it) => it.isCollection);

        let combinedDesc = "";
        if (distinctProducts.length > 0) {
          combinedDesc = distinctProducts.join(", ");
          if (hasCollections) {
            combinedDesc += " + পূর্বের কালেকশন";
          }
        } else if (hasCollections) {
          combinedDesc = "Previous Due Collection";
        } else {
          combinedDesc = "নগদ বিক্রি";
        }

        const validRates = items.map((it) => it.rate).filter((r): r is number => r != null);
        const allSameRate = validRates.length > 0 && validRates.every((r) => r === validRates[0]);
        const rateStr = allSameRate ? formatNumber(validRates[0]) : "-";

        cashInflowRows.push({
          id: `merged-inflow-${key}`,
          customerName: `${customerName} (মোট)`,
          productName: combinedDesc,
          unitQty: totalQty > 0 ? `${formatNumber(totalQty)} pcs` : "-",
          rate: rateStr,
          amount: totalAmount,
        });
      }
    }

    for (const it of unmergedInflowList) {
      cashInflowRows.push({
        id: it.id,
        customerName: it.customerName,
        productName: it.productName,
        unitQty: it.quantity > 0 ? `${formatNumber(it.quantity)} ${it.unit}`.trim() : "-",
        rate: it.rate != null ? formatNumber(it.rate) : "-",
        amount: it.amount,
      });
    }
  }

  const totalCashCollection = summary.today_cash_received;

  // 2. DUE SALES (CREDIT) ROWS
  interface RawDueItem {
    id: string;
    customerId: string | null;
    customerName: string;
    productName: string;
    quantity: number;
    unit: string;
    rate: number | null;
    dueAmount: number;
  }

  const rawDueItems: RawDueItem[] = [];
  const creditSales = (sales || []).filter((s) => (s.due_amount || 0) > 0);

  for (const sale of creditSales) {
    const custId = sale.customer_id || sale.customer?.id || null;
    const custName = sale.customer?.name || "Customer";
    if (sale.items && sale.items.length > 0) {
      if (sale.items.length === 1) {
        const item = sale.items[0];
        const unit = item.product?.unit || "pcs";
        rawDueItems.push({
          id: `due-${sale.id}-${item.id}`,
          customerId: custId,
          customerName: custName,
          productName: item.product?.name || "Product",
          quantity: Number(item.quantity) || 0,
          unit,
          rate: Number(item.unit_price) || null,
          dueAmount: sale.due_amount,
        });
      } else {
        const productNames = Array.from(
          new Set(
            sale.items
              .map((it) => it.product?.name?.trim())
              .filter((n): n is string => Boolean(n))
          )
        ).join(", ");
        const totalQty = sale.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
        rawDueItems.push({
          id: `due-${sale.id}`,
          customerId: custId,
          customerName: custName,
          productName: productNames || "Multiple Products",
          quantity: totalQty,
          unit: "pcs",
          rate: null,
          dueAmount: sale.due_amount,
        });
      }
    } else {
      rawDueItems.push({
        id: `due-${sale.id}`,
        customerId: custId,
        customerName: custName,
        productName: "Due Sale",
        quantity: 0,
        unit: "pcs",
        rate: null,
        dueAmount: sale.due_amount,
      });
    }
  }

  interface DueSaleRow {
    id: string;
    customerName: string;
    productName: string;
    unitQty: string;
    rate: string;
    dueAmount: number;
  }

  const dueSaleRows: DueSaleRow[] = [];

  if (activeMergeMode === "normal") {
    for (const it of rawDueItems) {
      dueSaleRows.push({
        id: it.id,
        customerName: it.customerName,
        productName: it.productName,
        unitQty: it.quantity > 0 ? `${formatNumber(it.quantity)} ${it.unit}`.trim() : "-",
        rate: it.rate != null ? formatNumber(it.rate) : "-",
        dueAmount: it.dueAmount,
      });
    }
  } else {
    const shouldMergeDue = (it: RawDueItem) => {
      if (activeMergeMode === "all") {
        return Boolean(it.customerId || it.customerName);
      }
      if (activeMergeMode === "selected") {
        if (it.customerId && activeSelectedCustomerIds.includes(it.customerId)) {
          return true;
        }
        return false;
      }
      return false;
    };

    const dueGroupMap = new Map<string, RawDueItem[]>();
    const unmergedDueList: RawDueItem[] = [];

    for (const it of rawDueItems) {
      if (shouldMergeDue(it)) {
        const key = it.customerId || it.customerName;
        if (!dueGroupMap.has(key)) {
          dueGroupMap.set(key, []);
        }
        dueGroupMap.get(key)!.push(it);
      } else {
        unmergedDueList.push(it);
      }
    }

    for (const [key, items] of dueGroupMap.entries()) {
      if (items.length === 1) {
        const it = items[0];
        dueSaleRows.push({
          id: it.id,
          customerName: it.customerName,
          productName: it.productName,
          unitQty: it.quantity > 0 ? `${formatNumber(it.quantity)} ${it.unit}`.trim() : "-",
          rate: it.rate != null ? formatNumber(it.rate) : "-",
          dueAmount: it.dueAmount,
        });
      } else {
        const customerName = items[0].customerName;
        const totalDue = items.reduce((sum, it) => sum + (it.dueAmount || 0), 0);
        const totalQty = items.reduce((sum, it) => sum + (it.quantity || 0), 0);

        const distinctProducts = Array.from(
          new Set(
            items
              .map((it) => it.productName)
              .filter(Boolean)
              .flatMap((p) => p.split(","))
              .map((p) => p.trim())
              .filter(Boolean)
          )
        );

        const validRates = items.map((it) => it.rate).filter((r): r is number => r != null);
        const allSameRate = validRates.length > 0 && validRates.every((r) => r === validRates[0]);
        const rateStr = allSameRate ? formatNumber(validRates[0]) : "-";

        dueSaleRows.push({
          id: `merged-due-${key}`,
          customerName: `${customerName} (মোট)`,
          productName: distinctProducts.join(", ") || "Due Sale",
          unitQty: totalQty > 0 ? `${formatNumber(totalQty)} pcs` : "-",
          rate: rateStr,
          dueAmount: totalDue,
        });
      }
    }

    for (const it of unmergedDueList) {
      dueSaleRows.push({
        id: it.id,
        customerName: it.customerName,
        productName: it.productName,
        unitQty: it.quantity > 0 ? `${formatNumber(it.quantity)} ${it.unit}`.trim() : "-",
        rate: it.rate != null ? formatNumber(it.rate) : "-",
        dueAmount: it.dueAmount,
      });
    }
  }

  const totalDueSales = dueSaleRows.reduce(
    (sum, r) => sum + (r.dueAmount || 0),
    0
  );

  // 3. DAILY EXPENSES ROWS
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
    const rawDesc = (it.description || "").trim();
    const isAutoDesc =
      !rawDesc ||
      rawDesc === `Expense - ${expType}` ||
      rawDesc === `Expense (${expType})` ||
      rawDesc === "Expense";
    expenseRows.push({
      id: it.id,
      description: isAutoDesc ? expType : rawDesc,
      type: expType,
      amount: it.debit,
    });
  }

  const stockItems = summary.stock_summary || [];
  const hasTrackedCustomer = Boolean(summary.tracked_customer_name && summary.tracked_customer_name.trim());
  const trackedCustomerName = summary.tracked_customer_name?.trim() || "";

  const totalExpense =
    typeof summary.total_expense === "number"
      ? summary.total_expense
      : expenseRows.reduce((sum, r) => sum + (r.amount || 0), 0);

  // 4 & 5. CASH OUT ROWS
  interface CashOutRow {
    id: string;
    reason: string;
    voucherNo: string;
    amount: number;
  }

  const cashOutRows: CashOutRow[] = [];
  const actualCashOutItems = (summary.items || []).filter(
    (it) => it.transaction_type === "cash_out" && it.debit > 0
  );

  for (const it of actualCashOutItems) {
    cashOutRows.push({
      id: it.id,
      reason: it.name && it.name !== "—" ? it.name : it.description || "Cash Out",
      voucherNo: it.invoice && it.invoice !== "—" ? it.invoice : it.code || "—",
      amount: it.debit,
    });
  }

  const totalCashOut =
    typeof summary.total_cash_out === "number"
      ? summary.total_cash_out
      : typeof summary.today_cash_out === "number"
      ? summary.today_cash_out
      : cashOutRows.reduce((sum, r) => sum + (r.amount || 0), 0);

  // Supplier daily accounts (multi-day or single-day)
  const supplierSummary = summary.supplier_summary;
  const dailyAccounts = supplierSummary?.daily_accounts && supplierSummary.daily_accounts.length > 0
    ? supplierSummary.daily_accounts
    : [
        {
          date: summary.date,
          previous_due: supplierSummary?.previous_due || 0,
          purchase_amount: supplierSummary?.purchase_amount || 0,
          return_amount: supplierSummary?.return_amount || 0,
          payment_amount: supplierSummary?.payment_amount || 0,
          closing_due: supplierSummary?.closing_due || 0,
        },
      ];

  return (
    <div ref={ref} className="w-full text-gray-900 antialiased font-sans text-[8.5px] leading-tight">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: A5 portrait;
              margin: 4mm 5mm;
            }

            @media print {
              html, body {
                background: #fff !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .no-print {
                display: none !important;
              }
              .sheet {
                width: 100% !important;
                max-width: none !important;
                height: 100% !important;
                min-height: 200mm !important;
                margin: 0 !important;
                padding: 4mm !important;
                border: none !important;
                box-shadow: none !important;
                page-break-after: always;
                break-after: page;
              }
              .sheet:last-child {
                page-break-after: auto;
                break-after: auto;
              }
              thead {
                display: table-header-group;
              }
              tr {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .watermark-text {
                color: rgba(0, 0, 0, 0.03) !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }

            * { box-sizing: border-box; }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-feature-settings: "tnum" 1;
            }

            .hairline { border-color: rgba(0, 0, 0, 0.15); }
            .hairline-light { border-color: rgba(0, 0, 0, 0.08); }
            .tabular { font-variant-numeric: tabular-nums; }
            .no-break { break-inside: avoid; page-break-inside: avoid; }
            .bg-gray-150 { background-color: #ededed; }

            .watermark-container {
              position: relative;
            }
            .watermark-overlay {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              margin: 0 !important;
              padding: 0 !important;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: none;
              user-select: none;
              z-index: 0;
              overflow: hidden;
            }
            .watermark-text {
              transform: rotate(-30deg);
              font-size: 16px;
              font-weight: 700;
              color: rgba(0, 0, 0, 0.03) !important;
              text-transform: uppercase;
              letter-spacing: 2px;
              white-space: nowrap;
              margin: 0 !important;
              padding: 0 !important;
              line-height: 1;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          `,
        }}
      />

      {/* SCREEN CONTROLS */}
      <div className="no-print max-w-[148mm] mx-auto mb-2 bg-white border hairline rounded px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div>
          <span className="text-xs font-bold text-gray-800 block">Print Preview Layout</span>
          <span className="text-[10px] text-gray-500">Balanced Readable Text Size - A5 Format</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick Mode Switcher */}
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded border hairline text-[10px]">
            <span className="text-gray-500 px-1 font-medium">মোড:</span>
            <button
              type="button"
              onClick={() => setActiveMergeMode("normal")}
              className={`px-1.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                activeMergeMode === "normal"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Normal: কোনো মার্জ হবে না"
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setActiveMergeMode("selected")}
              className={`px-1.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                activeMergeMode === "selected"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Selected Merge: শুধু নির্বাচিত কাস্টমার মার্জ হবে"
            >
              Selected
            </button>
            <button
              type="button"
              onClick={() => setActiveMergeMode("all")}
              className={`px-1.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                activeMergeMode === "all"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="All Merge: সব কাস্টমার মার্জ হবে"
            >
              All
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold px-3 py-1 rounded transition cursor-pointer"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {dailyAccounts.map((dayAccount, dayIndex) => {
        const sheetNum = String(dayIndex + 1).padStart(2, "0");
        const sheetDate = formatDisplayDate(dayAccount.date || summary.date);
        const supplierName = supplierSummary?.supplier_name || "ABC Poultry";

        return (
          <main
            key={`sheet-${dayIndex}-${dayAccount.date}`}
            className="sheet watermark-container max-w-[148mm] min-h-[200mm] mx-auto bg-white p-[4mm] shadow border hairline flex flex-col justify-between mb-4 last:mb-0"
          >
            {/* ZERO MARGIN WATERMARK LAYER */}
            <div className="watermark-overlay">
              <span className="watermark-text">Developed and managed by Mahfuz Ahmed</span>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="relative z-10 w-full">
              {/* HEADER */}
              <header className="text-center pb-1 mb-1 border-b hairline">
                <h1 className="text-[13px] font-extrabold uppercase tracking-widest text-gray-900">
                  {businessName}
                </h1>
                <p className="text-[7.5px] uppercase tracking-wider text-gray-500 font-semibold mt-0.5">
                  DAILY SALES & CASH STATEMENT
                </p>
              </header>

              {/* METADATA BAR */}
              <div className="grid grid-cols-3 bg-gray-50 border hairline px-2 py-1 mb-1.5 text-[8px]">
                <div>
                  <span className="text-gray-500">Date:</span> <strong>{sheetDate}</strong>
                </div>
                <div className="text-center truncate">
                  <strong>{websiteName}</strong>
                </div>
                <div className="text-right">
                  <span className="text-gray-500">Sheet:</span> <strong>{sheetNum}</strong>
                </div>
              </div>

              {/* =======================================================
                   1. CASH SALES & COLLECTION
                   ======================================================= */}
              <section className="mb-1.5">
                <div className="font-bold uppercase text-[7.8px] text-gray-800 mb-0.5">
                  1. CASH SALES & COLLECTION
                </div>
                <table className="w-full text-left text-[7.8px] border border-collapse hairline bg-white">
                  <thead>
                    <tr className="bg-gray-100 border-b hairline text-[7.2px] text-gray-700 font-bold">
                      <th className="px-1 py-[2.5px] text-center w-3">#</th>
                      <th className="px-1.5 py-[2.5px]">CUSTOMER NAME</th>
                      <th className="px-1.5 py-[2.5px]">PRODUCT NAME</th>
                      <th className="px-1 py-[2.5px] text-center">UNIT/QTY</th>
                      <th className="px-1 py-[2.5px] text-right">RATE</th>
                      <th className="px-1.5 py-[2.5px] text-right">AMOUNT ({currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y hairline-light">
                    {cashInflowRows.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="px-1 py-[2px] text-center text-gray-500 font-medium">{idx + 1}</td>
                        <td className="px-1.5 py-[2px] font-medium text-gray-900">{row.customerName}</td>
                        <td className="px-1.5 py-[2px] text-gray-700">{row.productName}</td>
                        <td className="px-1 py-[2px] text-center tabular font-medium text-gray-900">{row.unitQty}</td>
                        <td className="px-1 py-[2px] text-right tabular text-gray-700">{row.rate}</td>
                        <td className="px-1.5 py-[2px] text-right tabular font-bold text-gray-900">
                          {formatNumber(row.amount)}
                        </td>
                      </tr>
                    ))}
                    {cashInflowRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-2 text-center text-gray-500 italic">
                          No cash sales or collections for this date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t hairline font-bold text-[7.8px]">
                      <td colSpan={5} className="px-1.5 py-[2.5px] text-right text-gray-800">Total Cash Collection:</td>
                      <td className="px-1.5 py-[2.5px] text-right tabular font-bold text-gray-900">
                        {currencySymbol} {formatNumber(totalCashCollection)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </section>

              {/* =======================================================
                   2. DUE SALES (CREDIT)
                   ======================================================= */}
              <section className="mb-1.5">
                <div className="font-bold uppercase text-[7.8px] text-gray-800 mb-0.5">
                  2. DUE SALES (CREDIT)
                </div>
                <table className="w-full text-left text-[7.8px] border border-collapse hairline bg-white">
                  <thead>
                    <tr className="bg-gray-100 border-b hairline text-[7.2px] text-gray-700 font-bold">
                      <th className="px-1 py-[2.5px] text-center w-3">#</th>
                      <th className="px-1.5 py-[2.5px]">CUSTOMER NAME</th>
                      <th className="px-1.5 py-[2.5px]">PRODUCT</th>
                      <th className="px-1 py-[2.5px] text-center">QTY</th>
                      <th className="px-1 py-[2.5px] text-right">RATE</th>
                      <th className="px-1.5 py-[2.5px] text-right">DUE ({currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y hairline-light">
                    {dueSaleRows.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="px-1 py-[2px] text-center text-gray-500 font-medium">{idx + 1}</td>
                        <td className="px-1.5 py-[2px] font-medium text-gray-900">{row.customerName}</td>
                        <td className="px-1.5 py-[2px] text-gray-700">{row.productName}</td>
                        <td className="px-1 py-[2px] text-center tabular text-gray-900">{row.unitQty}</td>
                        <td className="px-1 py-[2px] text-right tabular text-gray-700">{row.rate}</td>
                        <td className="px-1.5 py-[2px] text-right tabular font-semibold text-gray-900">
                          {formatNumber(row.dueAmount)}
                        </td>
                      </tr>
                    ))}
                    {dueSaleRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-2 text-center text-gray-500 italic">
                          No due sales for this date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t hairline font-bold text-[7.8px]">
                      <td colSpan={5} className="px-1.5 py-[2.5px] text-right text-gray-800">Total Due Sales:</td>
                      <td className="px-1.5 py-[2.5px] text-right tabular font-bold text-gray-900">
                        {currencySymbol} {formatNumber(totalDueSales)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </section>

              {/* =======================================================
                   3. SIDE BY SIDE: STOCK REPORT & DAILY EXPENSES
                   ======================================================= */}
              <div className="flex gap-1.5 items-stretch mb-1.5 no-break">
                {/* LEFT: STOCK REPORT (Products as columns, Metrics as rows) */}
                <section className="w-[55%] shrink-0 border hairline bg-white flex flex-col justify-between">
                  <div>
                    <div className="bg-gray-100 border-b hairline px-1.5 py-[2px] font-bold uppercase text-[7.2px] text-gray-700">
                      3. STOCK REPORT
                    </div>
                    {stockItems.length > 0 ? (
                      <table className="w-full text-[7.5px] border-collapse bg-white">
                        <thead>
                          <tr className="bg-gray-50 border-b hairline text-[7px] text-gray-700 font-bold">
                            <th className="px-1.5 py-[2px] text-left border-r hairline-light">Product</th>
                            {stockItems.map((st) => (
                              <th
                                key={st.product_id}
                                className="px-1 py-[2px] text-right border-r last:border-r-0 hairline-light truncate max-w-[22mm]"
                                title={st.product_name}
                              >
                                {st.product_name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y hairline-light">
                          <tr>
                            <td className="px-1.5 py-[2px] font-medium text-gray-700 border-r hairline-light whitespace-nowrap">
                              আগের স্টক
                            </td>
                            {stockItems.map((st) => (
                              <td
                                key={`prev-${st.product_id}`}
                                className="px-1 py-[2px] text-right tabular font-medium text-gray-900 border-r last:border-r-0 hairline-light"
                              >
                                {formatNumber(st.previous_stock)}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-1.5 py-[2px] font-medium text-gray-700 border-r hairline-light whitespace-nowrap">
                              ক্রয়
                            </td>
                            {stockItems.map((st) => (
                              <td
                                key={`purch-${st.product_id}`}
                                className="px-1 py-[2px] text-right tabular font-medium text-gray-900 border-r last:border-r-0 hairline-light"
                              >
                                {formatNumber(st.purchases)}
                              </td>
                            ))}
                          </tr>
                          {hasTrackedCustomer ? (
                            <>
                              <tr>
                                <td className="px-1.5 py-[2px] font-medium text-gray-700 border-r hairline-light whitespace-nowrap">
                                  বিক্রি
                                </td>
                                {stockItems.map((st) => (
                                  <td
                                    key={`reg-sales-${st.product_id}`}
                                    className="px-1 py-[2px] text-right tabular font-medium text-gray-900 border-r last:border-r-0 hairline-light"
                                  >
                                    {formatNumber(st.regular_sales ?? st.sales)}
                                  </td>
                                ))}
                              </tr>
                              <tr>
                                <td
                                  className="px-1.5 py-[2px] font-semibold text-cyan-900 border-r hairline-light truncate max-w-[22mm]"
                                  title={trackedCustomerName}
                                >
                                  {trackedCustomerName}
                                </td>
                                {stockItems.map((st) => (
                                  <td
                                    key={`cust-sales-${st.product_id}`}
                                    className="px-1 py-[2px] text-right tabular font-medium text-cyan-950 border-r last:border-r-0 hairline-light"
                                  >
                                    {formatNumber(st.tracked_customer_sales ?? 0)}
                                  </td>
                                ))}
                              </tr>
                            </>
                          ) : (
                            <tr>
                              <td className="px-1.5 py-[2px] font-medium text-gray-700 border-r hairline-light whitespace-nowrap">
                                বিক্রি
                              </td>
                              {stockItems.map((st) => (
                                <td
                                  key={`sales-${st.product_id}`}
                                  className="px-1 py-[2px] text-right tabular font-medium text-gray-900 border-r last:border-r-0 hairline-light"
                                >
                                  {formatNumber(st.sales)}
                                </td>
                              ))}
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 border-t hairline font-bold text-[7.8px]">
                            <td className="px-1.5 py-[2.5px] text-gray-800 border-r hairline-light whitespace-nowrap">
                              অবশিষ্ট থাকবে
                            </td>
                            {stockItems.map((st) => (
                              <td
                                key={`close-${st.product_id}`}
                                className="px-1 py-[2.5px] text-right tabular font-bold text-gray-950 border-r last:border-r-0 hairline-light"
                              >
                                {formatNumber(st.closing_stock)}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-white border-t hairline font-bold text-[7.8px]">
                            <td className="px-1.5 py-[3.5px] text-gray-800 border-r hairline-light whitespace-nowrap">
                              অবশিষ্ট আছে
                            </td>
                            {stockItems.map((st) => (
                              <td
                                key={`actual-${st.product_id}`}
                                className="px-1 py-[3.5px] text-right border-r last:border-r-0 hairline-light h-[16px]"
                              >
                                &nbsp;
                              </td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <div className="px-2 py-3 text-center text-gray-500 italic text-[7px]">
                        No active stock items for this date.
                      </div>
                    )}
                  </div>
                </section>

                {/* RIGHT: DAILY EXPENSES (Compact without Category column) */}
                <section className="flex-1 min-w-0 border hairline bg-white flex flex-col justify-between">
                  <div>
                    <div className="bg-gray-100 border-b hairline px-1.5 py-[2px] font-bold uppercase text-[7.2px] text-gray-700">
                      DAILY EXPENSES
                    </div>
                    <table className="w-full text-left text-[7.8px] border-collapse bg-white">
                      <thead>
                        <tr className="bg-gray-50 border-b hairline text-[7px] text-gray-600 font-bold">
                          <th className="px-1 py-[2px] text-center w-4">#</th>
                          <th className="px-1.5 py-[2px]">EXPENSE</th>
                          <th className="px-1.5 py-[2px] text-right w-16 shrink-0">AMOUNT ({currencySymbol})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y hairline-light">
                        {expenseRows.map((row, idx) => (
                          <tr key={row.id}>
                            <td className="px-1 py-[2px] text-center text-gray-500 font-medium">{idx + 1}</td>
                            <td className="px-1.5 py-[2px] font-medium text-gray-900 break-words">{row.description}</td>
                            <td className="px-1.5 py-[2px] text-right tabular font-semibold text-gray-900 whitespace-nowrap">
                              {formatNumber(row.amount)}
                            </td>
                          </tr>
                        ))}
                        {expenseRows.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-1.5 py-[3px] text-center text-gray-500 italic text-[7px]">
                              No expenses recorded
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-1.5 py-[2.5px] bg-gray-50 border-t hairline flex justify-between items-center font-bold text-[7.8px]">
                    <span className="text-gray-800">Total Expense</span>
                    <strong className="tabular text-gray-900 font-bold">
                      {currencySymbol} {formatNumber(totalExpense)}
                    </strong>
                  </div>
                </section>
              </div>

              {/* =======================================================
                   4 & 5: SIDE BY SIDE SUMMARY (SUPPLIER & CASH OUT)
                   ======================================================= */}
              <div className="flex gap-1.5 items-stretch mb-1.5 no-break">
                {/* 4. SUPPLIER SUMMARY */}
                <section className="w-[38%] shrink-0 border hairline bg-white flex flex-col justify-between">
                  <div>
                    <div className="border-b hairline bg-gray-100 px-1.5 py-[2px] flex justify-between items-center">
                      <span className="text-[7.2px] font-bold uppercase text-gray-700 truncate">
                        4. SUPPLIER: {supplierSummary ? supplierName : "—"}
                      </span>
                    </div>
                    <div className="p-1.5 space-y-0.5 text-[7.8px]">
                      <div className="flex justify-between items-center py-[1px] border-b hairline-light">
                        <span className="text-gray-700 font-medium">Prev. Due</span>
                        <strong className="tabular text-gray-900">
                          {currencySymbol} {formatNumber(dayAccount.previous_due)}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-[1px] border-b hairline-light">
                        <span className="text-gray-700 font-medium">(+) Purchase</span>
                        <strong className="tabular text-gray-900">
                          {dayAccount.purchase_amount > 0 ? (
                            `${currencySymbol} ${formatNumber(dayAccount.purchase_amount)}`
                          ) : (
                            <span className="text-gray-400 font-normal">-</span>
                          )}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-[1px] border-b hairline-light">
                        <span className="text-gray-700 font-medium">(-) Return</span>
                        <strong className={`tabular ${dayAccount.return_amount > 0 ? "text-gray-900 font-semibold" : "text-gray-400 font-normal"}`}>
                          {dayAccount.return_amount > 0 ? `- ${currencySymbol} ${formatNumber(dayAccount.return_amount)}` : "-"}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center py-[1px]">
                        <span className="text-gray-700 font-medium">(-) Payment</span>
                        <strong className={`tabular ${dayAccount.payment_amount > 0 ? "text-gray-900 font-semibold" : "text-gray-400 font-normal"}`}>
                          {dayAccount.payment_amount > 0 ? `- ${currencySymbol} ${formatNumber(dayAccount.payment_amount)}` : "-"}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="px-1.5 py-[2.5px] bg-gray-50 border-t hairline flex justify-between items-center font-bold text-[7.8px]">
                    <span className="text-gray-800">Closing Due</span>
                    <strong className="tabular text-gray-950 font-bold">
                      {currencySymbol} {formatNumber(dayAccount.closing_due)}
                    </strong>
                  </div>
                </section>

                {/* 5. CASH OUT TABLE */}
                <section className="flex-1 min-w-0 border hairline bg-white flex flex-col justify-between">
                  <div>
                    <div className="bg-gray-100 border-b hairline px-1.5 py-[2px] font-bold uppercase text-[7.2px] text-gray-700">
                      5. CASH OUT / WITHDRAWALS
                    </div>
                    <table className="w-full text-left text-[7.8px] border-collapse bg-white">
                      <thead>
                        <tr className="bg-gray-50 border-b hairline text-[7px] text-gray-600 font-bold">
                          <th className="px-1.5 py-[2px]">REASON</th>
                          <th className="px-1 py-[2px] text-center w-14 shrink-0">VOUCHER</th>
                          <th className="px-1.5 py-[2px] text-right w-20 shrink-0">AMOUNT ({currencySymbol})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y hairline-light">
                        {cashOutRows.map((row) => (
                          <tr key={row.id}>
                            <td className="px-1.5 py-[2px] font-medium text-gray-900 break-words">{row.reason}</td>
                            <td className="px-1 py-[2px] text-center tabular text-gray-700 font-medium text-[7.2px] whitespace-nowrap">{row.voucherNo}</td>
                            <td className="px-1.5 py-[2px] text-right tabular font-semibold text-gray-900 whitespace-nowrap">
                              {formatNumber(row.amount)}
                            </td>
                          </tr>
                        ))}
                        {cashOutRows.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-1.5 py-[3px] text-center text-gray-500 italic text-[7px]">
                              No cash out withdrawals
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-1.5 py-[2.5px] bg-gray-50 border-t hairline flex justify-between items-center font-bold text-[7.8px]">
                    <span className="text-gray-800">Total Cash Out</span>
                    <strong className="tabular text-gray-900 font-bold">
                      {currencySymbol} {formatNumber(totalCashOut)}
                    </strong>
                  </div>
                </section>
              </div>

              {/* =======================================================
                   6. DAILY CASH STATEMENT SUMMARY TABLE
                   ======================================================= */}
              <section className="no-break mb-1">
                <div className="font-bold uppercase text-[7.5px] text-gray-700 mb-0.5">
                  6. DAILY CASH STATEMENT SUMMARY
                </div>
                <table className="w-full text-center text-[7.5px] border border-collapse hairline leading-tight bg-white">
                  <thead>
                    <tr className="bg-gray-100 border-b hairline text-[6.8px] text-gray-700 font-semibold">
                      <th className="px-1 py-[2.5px]">OPENING (B/F)</th>
                      <th className="px-0 py-[2.5px] w-2 text-gray-400 font-normal"></th>
                      <th className="px-1 py-[2.5px]">CASH COLLECTION</th>
                      <th className="px-0 py-[2.5px] w-2 text-gray-400 font-normal"></th>
                      <th className="px-1 py-[2.5px]">TOTAL EXPENSE</th>
                      <th className="px-0 py-[2.5px] w-2 text-gray-400 font-normal"></th>
                      <th className="px-1 py-[2.5px]">CASH OUT</th>
                      <th className="px-0 py-[2.5px] w-2 text-gray-400 font-normal"></th>
                      <th className="px-1 py-[2.5px] bg-gray-150 font-bold text-gray-900">NET CASH IN HAND</th>
                      <th className="px-1 py-[2.5px] text-gray-700 font-semibold">TOTAL DUE SALE</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium tabular text-[7.8px]">
                    <tr>
                      <td className="px-1 py-[3px] text-gray-900">
                        {currencySymbol} {formatNumber(summary.previous_balance || 0)}
                      </td>
                      <td className="px-0 py-[3px] text-gray-700 font-bold text-[7.5px]">+</td>
                      <td className="px-1 py-[3px] text-gray-900 font-semibold">
                        {currencySymbol} {formatNumber(totalCashCollection)}
                      </td>
                      <td className="px-0 py-[3px] text-gray-700 font-bold text-[7.5px]">-</td>
                      <td className="px-1 py-[3px] text-gray-900 font-semibold">
                        {currencySymbol} {formatNumber(totalExpense)}
                      </td>
                      <td className="px-0 py-[3px] text-gray-700 font-bold text-[7.5px]">-</td>
                      <td className="px-1 py-[3px] text-gray-900 font-semibold">
                        {currencySymbol} {formatNumber(totalCashOut)}
                      </td>
                      <td className="px-0 py-[3px] text-gray-700 font-bold text-[7.5px]">=</td>
                      <td className="px-1 py-[3px] bg-gray-100 font-bold text-gray-950 text-[8.5px]">
                        {currencySymbol} {formatNumber(summary.closing_cash_balance)}
                      </td>
                      <td className="px-1 py-[3px] text-gray-900 font-semibold">
                        {currencySymbol} {formatNumber(totalDueSales)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>

            {/* FIXED BOTTOM FOOTER */}
            <footer className="relative z-10 w-full text-center text-[6.5px] text-gray-400 tracking-wider m-0 p-0 leading-none">
              Developed and managed by Mahfuz Ahmed
            </footer>
          </main>
        );
      })}
    </div>
  );
});

PrintableCashBookStatement.displayName = "PrintableCashBookStatement";
