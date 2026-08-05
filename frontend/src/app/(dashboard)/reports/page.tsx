"use client";

import { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  ShoppingCart,
  RotateCcw,
  ShoppingBag,
  Truck,
  DollarSign,
  Receipt,
  Loader2,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";

// Lazy-loaded Report Modules to ensure code-splitting and zero logic duplication
const SaleReportPage = dynamic(
  () => import("@/app/(dashboard)/sales/reports/page"),
  {
    loading: () => <ReportLoadingSkeleton title="Sales Report" />,
    ssr: false,
  }
);

const SaleReturnReportPage = dynamic(
  () => import("@/app/(dashboard)/sale-returns/reports/page"),
  {
    loading: () => <ReportLoadingSkeleton title="Sale Return Report" />,
    ssr: false,
  }
);

const PurchaseReportPage = dynamic(
  () => import("@/app/(dashboard)/purchases/reports/page"),
  {
    loading: () => <ReportLoadingSkeleton title="Purchase Order Report" />,
    ssr: false,
  }
);

const ProductReturnReportPage = dynamic(
  () => import("@/app/(dashboard)/product-returns/reports/page"),
  {
    loading: () => <ReportLoadingSkeleton title="Product Return Report" />,
    ssr: false,
  }
);

const CustomerCollectionReportPage = dynamic(
  () => import("@/app/(dashboard)/collections/reports/page"),
  {
    loading: () => <ReportLoadingSkeleton title="Customer Collection Report" />,
    ssr: false,
  }
);

const SupplierPaymentReportPage = dynamic(
  () => import("@/app/(dashboard)/supplier-payments/reports/page"),
  {
    loading: () => <ReportLoadingSkeleton title="Supplier Payment Report" />,
    ssr: false,
  }
);

function ReportLoadingSkeleton({ title }: { title: string }) {
  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="font-bold text-sm text-foreground">Loading {title}...</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </Card>
  );
}

export default function ReportsHubPage() {
  const [activeTab, setActiveTab] = useState<
    "sales" | "sale_return" | "purchase" | "product_return" | "customer_collection" | "supplier_payment"
  >("sales");

  return (
    <HasPermission code={["reports.view", "sales.report.view"]}>
      <div className="space-y-6">
        <PageHeader
          title="Centralized Business Reports & Analytics"
          description="Consolidated reporting portal combining sales, customer collections, purchase orders, supplier payments, and return metrics."
        />

        {/* Navigation Tabs Bar */}
        <Card className="glass-card">
          <CardContent className="p-2 overflow-x-auto">
            <div className="flex items-center gap-1 min-w-max">
              <button
                onClick={() => setActiveTab("sales")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === "sales"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <ShoppingCart className="h-4 w-4" />
                <span>Sales Report</span>
              </button>

              <button
                onClick={() => setActiveTab("sale_return")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === "sale_return"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <RotateCcw className="h-4 w-4 text-amber-400" />
                <span>Sale Return Report</span>
              </button>

              <button
                onClick={() => setActiveTab("purchase")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === "purchase"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <ShoppingBag className="h-4 w-4 text-blue-400" />
                <span>Purchase Report</span>
              </button>

              <button
                onClick={() => setActiveTab("product_return")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === "product_return"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <Truck className="h-4 w-4 text-purple-400" />
                <span>Product Return Report</span>
              </button>

              <button
                onClick={() => setActiveTab("customer_collection")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === "customer_collection"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span>Customer Collection Report</span>
              </button>

              <button
                onClick={() => setActiveTab("supplier_payment")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === "supplier_payment"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <Receipt className="h-4 w-4 text-teal-400" />
                <span>Supplier Payment Report</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Lazy Loaded Report Content */}
        <Suspense fallback={<ReportLoadingSkeleton title="Report Module" />}>
          {activeTab === "sales" && <SaleReportPage />}
          {activeTab === "sale_return" && <SaleReturnReportPage />}
          {activeTab === "purchase" && <PurchaseReportPage />}
          {activeTab === "product_return" && <ProductReturnReportPage />}
          {activeTab === "customer_collection" && <CustomerCollectionReportPage />}
          {activeTab === "supplier_payment" && <SupplierPaymentReportPage />}
        </Suspense>
      </div>
    </HasPermission>
  );
}
