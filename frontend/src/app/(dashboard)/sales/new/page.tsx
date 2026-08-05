"use client";

import { HasPermission } from "@/providers/auth-provider";
import { SaleForm } from "@/components/sales/sale-form";

export default function NewSalePage() {
  return (
    <HasPermission code="sales.create">
      <div className="py-4">
        <SaleForm />
      </div>
    </HasPermission>
  );
}
