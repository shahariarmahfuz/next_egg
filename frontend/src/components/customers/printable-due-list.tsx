"use client";

import React from "react";
import { CustomerItem } from "@/types";
import { formatCurrency, formatNumber, formatDate } from "@/utils/formatters";
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

    // Dynamic Business Information
    const businessName = settings.business_name || "BUSINESS ENTERPRISE";
    const contactParts = [
      settings.business_address,
      settings.business_phone ? `Mobile: ${settings.business_phone}` : null,
      settings.business_email ? `Email: ${settings.business_email}` : null,
    ].filter(Boolean);
    const businessDetails = contactParts.join(" | ");

    const currencySymbol = settings.currency?.symbol || "৳";

    // Dynamic As of Date based on business timezone and formatting
    const asOfDate = formatDate(new Date()) || new Date().toLocaleDateString("en-GB");

    // Dynamic Statement Text reflecting active filters
    const statementText = searchQuery && searchQuery.trim()
      ? `Filtered: "${searchQuery.trim()}"`
      : "All Outstanding Accounts";

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
                  padding: 6mm 7mm;
                  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                  box-sizing: border-box;
              }

              /* Header Area */
              .customer-due-master-print .header {
                  text-align: center;
                  border-bottom: 0.5px solid #bbb;
                  padding-bottom: 3px;
                  margin-bottom: 5px;
              }

              .customer-due-master-print .header h1 {
                  font-size: 16px;
                  font-weight: 700;
                  color: #000;
                  letter-spacing: 0.5px;
                  margin-bottom: 1px;
                  text-transform: uppercase;
              }

              .customer-due-master-print .header p {
                  font-size: 8px;
                  color: #444;
                  font-weight: 400;
              }

              .customer-due-master-print .header .doc-title {
                  display: inline-block;
                  margin-top: 2px;
                  border: 0.5px solid #bbb;
                  padding: 1px 10px;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 8.5px;
                  color: #b02a37;
                  text-transform: uppercase;
              }

              /* Meta Information */
              .customer-due-master-print .meta-info {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 5px;
                  font-size: 8.5px;
                  font-weight: 500;
                  background: #f8f9fa;
                  padding: 3px 6px;
                  border: 0.5px solid #ccc;
              }

              /* Section Title */
              .customer-due-master-print .section-title {
                  font-size: 8.5px;
                  font-weight: 700;
                  text-transform: uppercase;
                  margin-top: 5px;
                  margin-bottom: 2px;
                  color: #000;
              }

              /* ================= TABLE DESIGN ================= */
              .customer-due-master-print table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 8px;
                  table-layout: fixed;
              }

              .customer-due-master-print table,
              .customer-due-master-print th,
              .customer-due-master-print td {
                  border: 0.5px solid #ccc;
              }

              .customer-due-master-print th,
              .customer-due-master-print td {
                  padding: 3px 4px;
                  font-size: 8.5px;
                  overflow: hidden;
                  word-wrap: break-word;
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

              /* Signature Area */
              .customer-due-master-print .signature-area {
                  display: flex;
                  justify-content: space-between;
                  margin-top: 25px;
                  padding: 0 8px;
              }

              .customer-due-master-print .sig-block {
                  text-align: center;
                  width: 80px;
              }

              .customer-due-master-print .sig-line {
                  border-top: 0.5px dashed #888;
                  margin-bottom: 2px;
              }

              .customer-due-master-print .sig-text {
                  font-size: 7.5px;
                  color: #222;
                  font-weight: 400;
              }

              /* ================= PRINT RULES (NATURAL A5 PAGINATION) ================= */
              @media print {
                  @page {
                      size: A5 portrait;
                      margin: 5mm 6mm 5mm 6mm;
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
                      padding: 0 !important;
                      margin: 0 !important;
                      box-shadow: none !important;
                      border: none !important;
                      height: auto !important;
                      min-height: 0 !important;
                      max-height: none !important;
                      overflow: visible !important;
                      break-inside: auto !important;
                      page-break-inside: auto !important;
                  }

                  .customer-due-master-print .no-print {
                      display: none !important;
                  }

                  .customer-due-master-print table,
                  .customer-due-master-print th,
                  .customer-due-master-print td {
                      border: 0.25pt solid #d5d5d5 !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                  }

                  .customer-due-master-print .meta-info {
                      border: 0.25pt solid #d5d5d5 !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                  }

                  .customer-due-master-print .header {
                      border-bottom: 0.35pt solid #bbb !important;
                  }

                  .customer-due-master-print .sig-line {
                      border-top: 0.25pt dashed #bbb !important;
                  }

                  /* Natural continuous table pagination */
                  .customer-due-master-print thead {
                      display: table-header-group !important;
                  }

                  .customer-due-master-print tbody tr {
                      break-inside: avoid !important;
                      page-break-inside: avoid !important;
                  }

                  .customer-due-master-print .signature-area {
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
          {/* Header */}
          <div className="header">
            {settings.business_logo && (
              <div style={{ marginBottom: "2px", display: "flex", justifyContent: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={settings.business_logo}
                  alt={businessName}
                  style={{ maxHeight: "36px", maxWidth: "160px", objectFit: "contain" }}
                />
              </div>
            )}
            <h1>{businessName}</h1>
            {businessDetails && <p>{businessDetails}</p>}
            <div className="doc-title">Customer Due List / Statement</div>
          </div>

          {/* Meta Info */}
          <div className="meta-info">
            <div><strong>As of Date:</strong> {asOfDate}</div>
            <div><strong>Statement:</strong> {statementText}</div>
            <div><strong>Total Accounts:</strong> {totalAccountsCount}</div>
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
                  style={{ paddingRight: "6px", color: "#b02a37" }}
                >
                  Total Due Amount:
                </td>
                <td className="text-right" style={{ color: "#b02a37" }}>
                  {formatCurrency(calculatedTotalDue)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signatures at the end of the complete dataset */}
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
  }
);

PrintableDueList.displayName = "PrintableDueList";
