import * as React from "react";
import { cn } from "@/lib/utils";
import { normalizeBengaliDigits } from "@/utils/bengali-normalizer";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onFocus, onChange, ...props }, ref) => {
    
    // We switch "number" to "text" internally to prevent browsers from
    // silently blocking/swallowing Bengali characters as "badInput".
    // We add inputMode="decimal" to preserve mobile numeric keyboards.
    const isNumeric = type === "number";
    const internalInputType = isNumeric ? "text" : type;
    const internalInputMode = isNumeric ? "decimal" : props.inputMode;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (isNumeric) {
        // Auto-select entire input content on focus
        setTimeout(() => {
          e.target.select();
        }, 0);
      }
      if (onFocus) {
        onFocus(e);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumeric) {
        const originalValue = e.target.value;
        if (/[০-৯]/.test(originalValue)) {
          const normalized = normalizeBengaliDigits(originalValue);
          e.target.value = normalized;
        }
      }
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <input
        type={internalInputType}
        inputMode={internalInputMode}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        onFocus={handleFocus}
        onChange={handleChange}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
