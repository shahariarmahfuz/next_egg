"use client";

import React, { ReactNode } from "react";
import { useSettingsStore } from "@/store/settings";
import { useAuth } from "@/providers/auth-provider";
import { formatDateTime } from "@/utils/formatters";
import { cn } from "@/lib/utils";

export interface FilterInfo {
  label: string;
  value: ReactNode;
}

export interface ReportPrintLayoutProps {
  title: string;
  subtitle?: string;
  documentNo?: string;
  documentDate?: string | Date;
  filters?: FilterInfo[];
  printedBy?: string;
  totals?: ReactNode;
  showSignatures?: boolean;
  signatureTitles?: [string, string];
  children: ReactNode;
  className?: string;
  paperSize?: "a4" | "a5" | "pos_80mm";
}

export const ReportPrintLayout = React.forwardRef<HTMLDivElement, ReportPrintLayoutProps>(
  (
    {
      title,
      subtitle,
      documentNo,
      filters = [],
      printedBy,
      totals,
      showSignatures = false,
      signatureTitles = ["Prepared By", "Authorized Signature"],
      children,
      className,
      paperSize = "a4",
    },
    ref
  ) => {
    const { settings } = useSettingsStore();
    const { user } = useAuth();

    const currentUser = printedBy || user?.full_name || user?.username || "Authorized User";
    const currentPrintTime = formatDateTime(new Date());

    const contactItems = [
      settings.business_address,
      settings.business_phone ? `Tel: ${settings.business_phone}` : null,
      settings.business_email ? `Email: ${settings.business_email}` : null,
      settings.website ? `Web: ${settings.website}` : null,
    ].filter(Boolean);

    return (
      <div
        ref={ref}
        className={cn(
          "w-full bg-white text-slate-900 font-sans leading-normal text-[11px] p-6 max-w-full",
          paperSize === "a4" && "print:p-0",
          paperSize === "pos_80mm" && "w-[80mm] p-2 text-[10px]",
          className
        )}
      >
        {/* Document Header */}
        <header className="text-center mb-4 pb-3 border-b-2 border-slate-900 print-avoid-break">
          {settings.business_logo && (
            <div className="mb-2 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.business_logo}
                alt={settings.business_name}
                className="h-12 max-h-14 max-w-[220px] object-contain"
              />
            </div>
          )}

          <h1 className="text-xl font-black uppercase tracking-wider text-slate-950 leading-snug">
            {settings.business_name || "BUSINESS ENTERPRISE HUB"}
          </h1>

          {contactItems.length > 0 && (
            <p className="text-[10px] text-slate-600 mt-1 max-w-2xl mx-auto">
              {contactItems.join("  •  ")}
            </p>
          )}

          {/* Report Title Badge */}
          <div className="mt-3 inline-block">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-950 bg-slate-100 border border-slate-400 px-4 py-1 rounded">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10px] font-medium text-slate-600 mt-0.5">{subtitle}</p>
            )}
          </div>
        </header>

        {/* Metadata & Applied Filters Bar */}
        <div className="flex justify-between items-start text-[10.5px] mb-4 pb-2 border-b border-slate-200 print-avoid-break gap-4">
          <div className="space-y-1 text-left flex-1">
            {documentNo && (
              <div>
                <span className="font-bold text-slate-900">Document No: </span>
                <span className="font-semibold text-slate-800">{documentNo}</span>
              </div>
            )}
            {filters.length > 0 ? (
              <div className="space-y-0.5">
                {filters.map((filter, idx) => (
                  <div key={idx}>
                    <span className="font-bold text-slate-900">{filter.label}: </span>
                    <span className="text-slate-800">{filter.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 italic text-[10px]">All records (no filter applied)</div>
            )}
          </div>

          <div className="space-y-0.5 text-right shrink-0">
            <div>
              <span className="font-bold text-slate-900">Print Date: </span>
              <span className="text-slate-800">{currentPrintTime}</span>
            </div>
            <div>
              <span className="font-bold text-slate-900">Printed By: </span>
              <span className="text-slate-800">{currentUser}</span>
            </div>
          </div>
        </div>

        {/* Document Content / Table */}
        <main className="w-full">{children}</main>

        {/* Totals Section */}
        {totals && <div className="mt-4 print-avoid-break">{totals}</div>}

        {/* Signatures */}
        {showSignatures && (
          <div className="mt-12 pt-4 flex justify-between items-end text-[11px] text-slate-800 print-avoid-break">
            <div className="text-center">
              <div className="w-44 border-t border-slate-600 pt-1 font-bold">
                {signatureTitles[0]}
              </div>
            </div>
            <div className="text-center">
              <div className="w-44 border-t border-slate-600 pt-1 font-bold">
                {signatureTitles[1]}
              </div>
            </div>
          </div>
        )}

        {/* Running Document Footer */}
        <footer className="mt-8 pt-2 border-t border-slate-300 flex justify-between items-center text-[9.5px] text-slate-500 print-avoid-break">
          <div>
            Official Report • {settings.business_name} • System Generated
          </div>
          <div className="text-right">
            <span>Printed on {currentPrintTime}</span>
          </div>
        </footer>
      </div>
    );
  }
);

ReportPrintLayout.displayName = "ReportPrintLayout";
