"use client";

import { PageHeader } from "@/components/common/page-header";
import { EggCalculator } from "@/components/calculators/egg-calculator";
import { HasPermission } from "@/providers/auth-provider";

export default function EggCalculatorPage() {
  return (
    <HasPermission
      code="calculator.view"
      fallback={
        <div className="p-8 text-center text-destructive font-medium">
          Access Denied: You do not have permission to access the Calculator module.
        </div>
      }
    >
      <div className="space-y-4">
        <PageHeader title="Egg Calculator" className="pb-3 mb-4" />
        <EggCalculator />
      </div>
    </HasPermission>
  );
}
