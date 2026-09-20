"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { usePrintStore } from "@/lib/print-service";

interface PrintProviderProps {
  children: ReactNode;
}

export function PrintProvider({ children }: PrintProviderProps) {
  const activeContent = usePrintStore((state) => state.activeContent);
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

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
      {/* Dedicated isolated print container - render ONLY when an actual printable document has been selected/requested */}
      {!isAuthPage && activeContent ? (
        <div id="print-root" aria-hidden="true" className="print-mount-root" style={{ display: "none" }}>
          {activeContent}
        </div>
      ) : null}
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

  let printRoot = document.getElementById("print-root");
  if (!printRoot) {
    printRoot = document.createElement("div");
    printRoot.id = "print-root";
    printRoot.setAttribute("aria-hidden", "true");
    printRoot.className = "print-mount-root";
    printRoot.style.display = "none";
    document.body.appendChild(printRoot);
  }

  return createPortal(children, printRoot);
}
