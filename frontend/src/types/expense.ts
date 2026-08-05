export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  expense_count?: number;
}

export interface ExpenseCategoryInput {
  name: string;
  description?: string;
  status?: "active" | "inactive";
}

export interface Expense {
  id: string;
  voucher_no: string;
  category_id: string;
  category_name?: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  reference_no?: string;
  description?: string;
  created_by_id: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseInput {
  category_id: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  reference_no?: string;
  description?: string;
}

export interface ExpenseReportSummary {
  total_expenses: number;
  today_expenses: number;
  this_month_expenses: number;
  this_year_expenses: number;
  total_count: number;
}

export interface ExpenseFilters {
  search?: string;
  category_id?: string;
  payment_method?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}
