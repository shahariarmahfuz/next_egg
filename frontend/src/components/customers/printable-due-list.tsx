"use client";

import React from "react";
import { CustomerItem } from "@/types";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { useSettingsStore } from "@/store/settings";

export interface PrintableDueListProps {
  customers: CustomerItem[];
  searchQuery?: string;
  totalCustomers?: number;
  totalAmount?: number;
}

export const PrintableDueList = React.forwardRef<HTMLDivElement, PrintableDueListProps>(
  ({ customers, searchQuery, totalCustomers, totalAmount }, ref) => {
    const { settings } = useSettingsStore();

    // Dynamic Business & Website Information
    const websiteName = settings.website?.trim() || settings.business_name?.trim() || "";

    const currencySymbol = settings.currency?.symbol || "৳";

    // Compact DD/MM/YYYY date format for print
    const formatPrintDate = (d: Date = new Date()) => {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };
    const asOfDate = formatPrintDate(new Date());

    // Total accounts count
    const totalAccountsCount =
      totalCustomers !== undefined && totalCustomers > 0
        ? totalCustomers
        : customers.length;

    // Complete filtered dataset total due amount
    const calculatedTotalDue =
      totalAmount !== undefined && totalAmount > 0
        ? totalAmount
        : customers.reduce((sum, c) => sum + (Number(c.current_balance) || 0), 0);

    // Diagnostics: log active layout in browser console for verification
    if (typeof window !== "undefined") {
      console.log(
        `[PrintableDueList] Option A Active: Single continuous table, 1 page container, ${customers.length} customer rows rendered.`
      );
    }

    return (
      <div
        ref={ref}
        className="customer-due-master-print"
        data-option="Option-A-Continuous"
        data-customer-count={customers.length}
        data-page-containers="1"
        data-tables-count="1"
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');

              .customer-due-master-print * {
                  box-sizing: border-box;
                  margin: 0;
                  padding: 0;
              }

              .customer-due-master-print {
                  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                  background-color: #f0f2f5;
                  color: #000;
                  padding: 10px;
                  font-size: 8.8px;
                  line-height: 1.25;
                  -webkit-font-smoothing: antialiased;
              }

              /* Screen Print Button */
              .customer-due-master-print .no-print {
                  text-align: center;
                  margin-bottom: 15px;
              }

              .customer-due-master-print .print-btn {
                  background-color: #1a73e8;
                  color: #ffffff;
                  border: none;
                  padding: 8px 20px;
                  font-size: 12px;
                  font-weight: 500;
                  border-radius: 4px;
                  cursor: pointer;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
              }

              /* A5 Page Container */
              .customer-due-master-print .page {
                  width: 148mm;
                  margin: 0 auto;
                  background: #ffffff;
                  padding: 5mm 6mm;
                  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                  box-sizing: border-box;
                  position: relative;
              }

              /* Watermark Layer */
              .customer-due-master-print .watermark-layer {
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  pointer-events: none;
                  user-select: none;
                  z-index: 0;
                  overflow: hidden;
              }

              .customer-due-master-print .watermark-image {
                  max-width: 250px;
                  max-height: 250px;
                  object-fit: contain;
                  opacity: 0.045;
                  filter: grayscale(100%);
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
              }

              .customer-due-master-print .watermark-text {
                  transform: rotate(-30deg);
                  font-size: 26px;
                  font-weight: 700;
                  color: rgba(0, 0, 0, 0.04) !important;
                  text-transform: uppercase;
                  letter-spacing: 3px;
                  white-space: nowrap;
                  line-height: 1;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
              }

              /* Top Information Line */
              .customer-due-master-print .meta-info {
                  position: relative;
                  z-index: 1;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 6px;
                  font-size: 8.5px;
                  font-weight: 500;
                  background: #f8f9fa;
                  padding: 3.5px 6px;
                  border: 0.5px solid #888;
                  box-sizing: border-box;
                  width: 100%;
              }

              .customer-due-master-print .meta-info .meta-left {
                  text-align: left;
                  flex: 1;
                  white-space: nowrap;
              }

              .customer-due-master-print .meta-info .meta-center {
                  text-align: center;
                  flex: 1.5;
                  font-weight: 700;
                  font-size: 10px;
                  color: #000;
                  letter-spacing: 0.4px;
                  text-transform: uppercase;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  padding: 0 4px;
              }

              .customer-due-master-print .meta-info .meta-right {
                  text-align: right;
                  flex: 1;
                  white-space: nowrap;
              }

              /* Section Title */
              .customer-due-master-print .section-title {
                  position: relative;
                  z-index: 1;
                  font-size: 8.5px;
                  font-weight: 700;
                  text-transform: uppercase;
                  margin-top: 5px;
                  margin-bottom: 3px;
                  color: #000;
              }

              /* ================= TABLE DESIGN ================= */
              .customer-due-master-print table {
                  position: relative;
                  z-index: 1;
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 8px;
                  table-layout: fixed;
                  box-sizing: border-box;
                  border: 0.5px solid #888;
              }

              .customer-due-master-print table,
              .customer-due-master-print th,
              .customer-due-master-print td {
                  border: 0.5px solid #888;
                  box-sizing: border-box;
              }

              .customer-due-master-print th,
              .customer-due-master-print td {
                  padding: 2.5px 3.5px;
                  font-size: 8.5px;
                  line-height: 1.25;
                  overflow: hidden;
                  word-wrap: break-word;
                  box-sizing: border-box;
              }

              .customer-due-master-print th {
                  background-color: #f1f2f4;
                  font-weight: 700;
                  text-align: center;
                  color: #000;
                  height: 17px;
                  text-transform: uppercase;
              }

              .customer-due-master-print td {
                  height: 17px;
              }

              .customer-due-master-print .text-center { text-align: center; }
              .customer-due-master-print .text-left   { text-align: left; }
              .customer-due-master-print .text-right  { text-align: right; }

              .customer-due-master-print .total-row td {
                  font-weight: 700;
                  background-color: #fbfbfb;
                  color: #000;
                  font-size: 9px;
              }

              /* ================= PRINT RULES (NATURAL A5 PAGINATION) ================= */
              @media print {
                  @page {
                      size: A5 portrait;
                      margin: 5mm 5mm 5mm 5mm;
                      @bottom-right {
                          content: "Page " counter(page) " of " counter(pages);
                          font-size: 7.5px;
                          font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                          color: #555;
                      }
                  }

                  html, body {
                      width: 100% !important;
                      background: none !important;
                      padding: 0 !important;
                      margin: 0 !important;
                  }

                  .customer-due-master-print {
                      background: none !important;
                      padding: 0 !important;
                      margin: 0 !important;
                      width: 100% !important;
                  }

                  .customer-due-master-print .page {
                      width: 100% !important;
                      max-width: 100% !important;
                      padding: 0 1.5mm !important;
                      margin: 0 !important;
                      box-shadow: none !important;
                      border: none !important;
                      height: auto !important;
                      min-height: 0 !important;
                      max-height: none !important;
                      overflow: visible !important;
                      box-sizing: border-box !important;
                      break-inside: auto !important;
                      page-break-inside: auto !important;
                  }

                  .customer-due-master-print .watermark-layer {
                      position: fixed !important;
                      top: 0 !important;
                      left: 0 !important;
                      width: 100% !important;
                      height: 100% !important;
                      display: flex !important;
                      align-items: center !important;
                      justify-content: center !important;
                      pointer-events: none !important;
                      user-select: none !important;
                      z-index: 0 !important;
                      overflow: hidden !important;
                  }

                  .customer-due-master-print .watermark-image {
                      max-width: 250px !important;
                      max-height: 250px !important;
                      opacity: 0.045 !important;
                      filter: grayscale(100%) !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                  }

                  .customer-due-master-print .watermark-text {
                      color: rgba(0, 0, 0, 0.04) !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                  }

                  .customer-due-master-print .no-print {
                      display: none !important;
                  }

                  .customer-due-master-print table {
                      width: 100% !important;
                      border-collapse: collapse !important;
                      border: 0.35pt solid #666 !important;
                      box-sizing: border-box !important;
                      margin-bottom: 6px !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                  }

                  .customer-due-master-print th,
                  .customer-due-master-print td {
                      border: 0.35pt solid #666 !important;
                      box-sizing: border-box !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                  }

                  .customer-due-master-print .meta-info {
                      width: 100% !important;
                      border: 0.35pt solid #666 !important;
                      box-sizing: border-box !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                  }

                  /* Natural continuous table pagination */
                  .customer-due-master-print thead {
                      display: table-header-group !important;
                  }

                  .customer-due-master-print tbody tr {
                      break-inside: avoid !important;
                      page-break-inside: avoid !important;
                  }
              }
            `,
          }}
        />

        {/* Screen Print Button */}
        <div className="no-print">
          <button className="print-btn" type="button" onClick={() => window.print()}>
            Print Due List (A5)
          </button>
        </div>

        {/* Continuous Single A5 Page Container */}
        <div className="page" data-print-container="continuous-single-page">
          {/* Subtle Branded Watermark Layer */}
          <div className="watermark-layer" aria-hidden="true">
            {settings.business_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.business_logo}
                alt=""
                className="watermark-image"
              />
            ) : (
              <span className="watermark-text">
                {websiteName || settings.business_name || "BUSINESS ENTERPRISE"}
              </span>
            )}
          </div>

          {/* Top Information Line */}
          <div className="meta-info">
            <div className="meta-left">
              <strong>As of Date:</strong> {asOfDate}
            </div>
            <div className="meta-center">
              {websiteName}
            </div>
            <div className="meta-right">
              <strong>Total Accounts:</strong> {totalAccountsCount}
            </div>
          </div>

          {/* Due Customers Table */}
          <div className="section-title">Customer Due Accounts</div>
          <table>
            <thead>
              <tr>
                <th style={{ width: "6%" }}>#</th>
                <th style={{ width: "34%" }}>Customer Name</th>
                <th style={{ width: "20%" }}>Contact</th>
                <th style={{ width: "22%" }}>Address</th>
                <th style={{ width: "18%" }}>Due Amount ({currencySymbol})</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer, idx) => (
                <tr key={customer.id || idx}>
                  <td className="text-center">{idx + 1}</td>
                  <td className="text-left">{customer.name}</td>
                  <td className="text-center">{customer.phone || "-"}</td>
                  <td className="text-left">{customer.address || "-"}</td>
                  <td className="text-right">{formatNumber(customer.current_balance)}</td>
                </tr>
              ))}

              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center" style={{ padding: "10px", color: "#666" }}>
                    No due records found matching the criteria.
                  </td>
                </tr>
              )}

              {/* Total Due Row at the end of the complete dataset */}
              <tr className="total-row">
                <td
                  colSpan={4}
                  className="text-right"
                  style={{ paddingRight: "6px", color: "#000", fontWeight: 700 }}
                >
                  Total Due Amount:
                </td>
                <td className="text-right" style={{ color: "#000", fontWeight: 700 }}>
                  {formatCurrency(calculatedTotalDue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

PrintableDueList.displayName = "PrintableDueList";
