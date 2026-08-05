"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  Download,
  ArrowLeft,
  FileText,
  Smartphone,
  Receipt,
  Layout,
} from "lucide-react";
import { saleService } from "@/services/api";
import { SaleItem } from "@/types";
import { PrintableInvoice, PrintTemplateFormat } from "@/components/sales/printable-invoice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HasPermission } from "@/providers/auth-provider";

export default function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<PrintTemplateFormat>("a4");

  const { data: saleData, isLoading } = useQuery({
    queryKey: ["sale-print", id],
    queryFn: () => saleService.getSaleById(id),
  });

  const sale: SaleItem | undefined = saleData?.data;

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Sale invoice not found or has been deleted.
      </div>
    );
  }

  return (
    <HasPermission code="sales.print">
      <div className="space-y-6 max-w-6xl mx-auto pb-12 print:p-0 print:m-0 print:max-w-none">
        {/* Top Control Bar (Hidden when printing) */}
        <Card className="glass-card print:hidden">
          <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon" onClick={() => router.push("/sales")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Printer className="h-4 w-4 text-primary" />
                  Print Sale Invoice #{sale.invoice_no}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Select your paper layout format and trigger high-speed printing.
                </p>
              </div>
            </div>

            {/* Template Selector & Print Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Format Picker */}
              <div className="flex items-center bg-muted/60 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setTemplate("a4")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                    template === "a4" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  A4 Paper
                </button>
                <button
                  onClick={() => setTemplate("a5")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                    template === "a5" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layout className="h-3.5 w-3.5 text-primary" />
                  A5 Compact
                </button>
                <button
                  onClick={() => setTemplate("pos_80mm")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                    template === "pos_80mm" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Receipt className="h-3.5 w-3.5 text-primary" />
                  80mm POS
                </button>
              </div>

              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Download className="mr-1.5 h-4 w-4 text-primary" />
                Download PDF
              </Button>

              <Button variant="default" size="sm" onClick={handlePrint}>
                <Printer className="mr-1.5 h-4 w-4" />
                Print Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Print Preview Canvas */}
        <div className="py-4 bg-muted/20 rounded-2xl p-6 border flex justify-center overflow-x-auto print:bg-white print:p-0 print:border-none">
          <PrintableInvoice sale={sale} template={template} />
        </div>
      </div>
    </HasPermission>
  );
}
