"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePrintStore } from "@/lib/print-service";

interface PrintProviderProps {
  children: ReactNode;
}

export function PrintProvider({ children }: PrintProviderProps) {
  const activeContent = usePrintStore((state) => state.activeContent);

  // Global Ctrl+P / Cmd+P listener to route to dedicated print handler if active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        const handler = usePrintStore.getState().registeredHandler;
        if (handler) {
          e.preventDefault();
          handler();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {children}
      {/* Dedicated isolated print container */}
      <div id="print-root" aria-hidden="true" className="print-mount-root">
        {activeContent || (
          <div className="p-12 text-center text-slate-500 font-sans print-avoid-break">
            <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">
              No Printable Document Selected
            </h2>
            <p className="text-xs text-slate-600 mt-2">
              Please click the official &quot;Print&quot; button on the relevant report, invoice, or voucher to generate a printout.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Declarative component that mounts printable content into the dedicated print root
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  const printRoot = document.getElementById("print-root");
  if (!printRoot) {
    return null;
  }

  return createPortal(children, printRoot);
}
