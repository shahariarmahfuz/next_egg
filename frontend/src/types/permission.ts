export interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const STOCK_REPORT_PERMISSION = "stock_report.view" as const;
export type StockReportPermission = typeof STOCK_REPORT_PERMISSION;

export const CASH_REPORT_PERMISSION = "cash_report.view" as const;
export type CashReportPermission = typeof CASH_REPORT_PERMISSION;

export const CASH_OUT_REPORT_PERMISSION = "cash_out_report.view" as const;
export type CashOutReportPermission = typeof CASH_OUT_REPORT_PERMISSION;

export const CALCULATOR_PERMISSION = "calculator.view" as const;
export type CalculatorPermission = typeof CALCULATOR_PERMISSION;

