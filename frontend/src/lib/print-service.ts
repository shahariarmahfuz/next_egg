import type { ReactNode } from "react";
import { create } from "zustand";

export interface PrintOptions {
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
  delayMs?: number;
}

interface PendingPrint {
  resolve: () => void;
  options?: PrintOptions;
}

interface PrintStoreState {
  activeContent: ReactNode | null;
  isPrinting: boolean;
  registeredHandler: (() => void | Promise<void>) | null;
  setActiveContent: (content: ReactNode | null) => void;
  setIsPrinting: (isPrinting: boolean) => void;
  registerPrintHandler: (handler: (() => void | Promise<void>) | null) => () => void;
  printDocument: (content: ReactNode, options?: PrintOptions) => Promise<void>;
  clearPrint: () => void;
}

let pendingPrint: PendingPrint | null = null;

export const usePrintStore = create<PrintStoreState>((set, get) => ({
  activeContent: null,
  isPrinting: false,
  registeredHandler: null,

  setActiveContent: (content) => set({ activeContent: content }),
  setIsPrinting: (isPrinting) => set({ isPrinting }),
  registerPrintHandler: (handler) => {
    set({ registeredHandler: handler });
    return () => {
      if (get().registeredHandler === handler) {
        set({ registeredHandler: null });
      }
    };
  },

  clearPrint: () => {
    if (typeof document !== "undefined") {
      document.body.classList.remove("print-document-active");
    }
    set({ activeContent: null, isPrinting: false });
    if (pendingPrint) {
      pendingPrint.resolve();
      pendingPrint = null;
    }
  },

  printDocument: async (content: ReactNode, options?: PrintOptions): Promise<void> => {
    if (typeof window === "undefined") return;

    return new Promise<void>((resolve) => {
      pendingPrint = { resolve, options };

      document.body.classList.add("print-document-active");
      set({ activeContent: content, isPrinting: true });

      // Run asynchronously after React commits DOM
      setTimeout(async () => {
        try {
          // 1. Wait two animation frames for layout & styling paint
          await new Promise<void>((r) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => r());
            });
          });

          // 2. Wait for all images inside #print-root to load/decode
          const printRoot = document.getElementById("print-root");
          if (printRoot) {
            const images = Array.from(printRoot.querySelectorAll("img"));
            await Promise.all(
              images.map((img) => {
                if (img.complete) return Promise.resolve();
                return new Promise<void>((res) => {
                  img.onload = () => res();
                  img.onerror = () => res();
                });
              })
            );
          }

          // 3. Optional caller hook and small settling delay
          options?.onBeforePrint?.();
          await new Promise<void>((r) => setTimeout(r, options?.delayMs ?? 100));

          // 4. Setup afterprint cleanup
          let cleanedUp = false;
          const cleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            window.removeEventListener("afterprint", handleAfterPrint);
            document.body.classList.remove("print-document-active");
            options?.onAfterPrint?.();
            set({ isPrinting: false });

            // Small delay before unmounting print content to prevent preview closing flicker
            setTimeout(() => {
              set({ activeContent: null });
              if (pendingPrint) {
                pendingPrint.resolve();
                pendingPrint = null;
              }
            }, 300);
          };

          const handleAfterPrint = () => {
            cleanup();
          };

          window.addEventListener("afterprint", handleAfterPrint);

          // Fallback safety timeout in case afterprint doesn't fire
          setTimeout(() => {
            if (!cleanedUp) {
              cleanup();
            }
          }, 30000);

          // 5. Invoke browser print preview
          window.print();
        } catch (err) {
          console.error("Print execution failed:", err);
          document.body.classList.remove("print-document-active");
          set({ activeContent: null, isPrinting: false });
          if (pendingPrint) {
            pendingPrint.resolve();
            pendingPrint = null;
          }
        }
      }, 50);
    });
  },
}));

/**
 * Convenience hook for React components to invoke print actions
 */
export function usePrint() {
  const isPrinting = usePrintStore((state) => state.isPrinting);
  const printDocument = usePrintStore((state) => state.printDocument);
  const clearPrint = usePrintStore((state) => state.clearPrint);
  const registerPrintHandler = usePrintStore((state) => state.registerPrintHandler);

  return { isPrinting, printDocument, clearPrint, registerPrintHandler };
}

/**
 * Direct imperative print trigger for non-component utilities (e.g. export functions)
 */
export const printService = {
  printDocument: (content: ReactNode, options?: PrintOptions) => {
    return usePrintStore.getState().printDocument(content, options);
  },
  clearPrint: () => {
    usePrintStore.getState().clearPrint();
  },
};
