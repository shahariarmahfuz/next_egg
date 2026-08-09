"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Plus,
  ArrowLeft,
  Calendar,
  DollarSign,
  CreditCard,
  FileText,
  User,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HasPermission, useAuth } from "@/providers/auth-provider";
import { expenseService } from "@/services/api";
import { ExpenseCategory, ExpenseInput } from "@/types";

export default function AddExpensePage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const todayStr = new Date().toISOString().split("T")[0];

  const [categoryId, setCategoryId] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [amount, setAmount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successVoucher, setSuccessVoucher] = useState<string | null>(null);

  // Fetch active categories
  const { data: categoriesData, isLoading: isCatLoading } = useQuery({
    queryKey: ["expense-categories-active"],
    queryFn: () => expenseService.getCategories(true),
  });

  const categories: ExpenseCategory[] = categoriesData?.data || [];

  // Set default category if available
  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Handle amount focus selection UX
  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === "0" || e.target.value === "0.00") {
      e.target.select();
    }
  };

  // Create Expense Mutation
  const createMutation = useMutation({
    mutationFn: (payload: ExpenseInput) => expenseService.createExpense(payload),
    onSuccess: (res) => {
      // Invalidate queries so dashboard and manage expenses update immediately
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      queryClient.invalidateQueries({ queryKey: ["expense-report-summary"] });

      const voucher = res.data.voucher_no;
      setSuccessVoucher(voucher);

      setTimeout(() => {
      }, 1500);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to record expense voucher.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!categoryId) {
      setErrorMsg("Please select an expense category.");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg("Expense amount must be greater than 0.");
      return;
    }

    createMutation.mutate({
      category_id: categoryId,
      amount: numericAmount,
      expense_date: new Date(expenseDate).toISOString(),
      payment_method: paymentMethod,
      reference_no: referenceNo.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <HasPermission code="expense.create">
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Add Business Expense"
          description="Create a new expense entry (immediately updates dashboard metrics & profit)."
          action={
            <Button
              variant="outline"
              onClick={() => router.push("/expenses")}
              className="gap-2 text-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Expenses
            </Button>
          }
        />

        {successVoucher ? (
          <Card className="glass-card border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">Expense Voucher Created!</h3>
              <p className="text-sm font-semibold text-primary">
                Voucher No: <span className="underline">{successVoucher}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Dashboard total expenses and net profit have been updated automatically. Redirecting...
              </p>
            </div>
          </Card>
        ) : (
          <Card className="glass-card">
            <CardHeader className="p-5 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-rose-500" />
                Expense Entry Details
              </CardTitle>
              <CardDescription className="text-xs">
                Fill in the required fields to record an operational expense voucher.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMsg && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <span>Expense Category</span>
                      <span className="text-rose-500">*</span>
                    </Label>
                    {isCatLoading ? (
                      <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
                    ) : (
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full h-10 px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                        required
                      >
                        {categories.length === 0 ? (
                          <option value="">No active categories found</option>
                        ) : (
                          categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))
                        )}
                      </select>
                    )}
                  </div>

                  {/* Expense Date */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Expense Date</span>
                      <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Expense Amount ($)</span>
                      <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onFocus={handleAmountFocus}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="text-sm font-bold text-foreground"
                      required
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Payment Method</span>
                    </Label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full h-10 px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="Mobile Banking">Mobile Banking (bKash / Nagad)</option>
                      <option value="Card">Credit / Debit Card</option>
                    </select>
                  </div>

                  {/* Reference Number */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Reference No / Transaction ID (Optional)</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g. Cheque #49281 or TrxID #8X9A21"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  {/* Created By (System user) */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Recorded By</span>
                    </Label>
                    <Input
                      type="text"
                      value={user?.full_name || user?.username || "Logged in User"}
                      disabled
                      className="text-xs bg-muted/50 cursor-not-allowed font-medium"
                    />
                  </div>
                </div>

                {/* Description / Notes */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Description / Notes (Optional)</Label>
                  <Textarea
                    placeholder="Enter detailed reason or explanation for this expense..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="text-xs min-h-[100px]"
                  />
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/expenses")}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="text-xs font-semibold gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <Plus className="h-4 w-4" />
                    Save & Create Voucher
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </HasPermission>
  );
}
