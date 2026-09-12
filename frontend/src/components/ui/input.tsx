import * as React from "react";
import { cn } from "@/lib/utils";
import { sanitizeNumericInput } from "@/utils/numeric-sanitizer";

export { sanitizeNumericInput };

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, step, onFocus, onBlur, onChange, value: propValue, defaultValue, ...props }, ref) => {
    // We switch "number" to "text" internally to prevent browsers from
    // silently blocking/swallowing Bengali characters as "badInput".
    // We add inputMode="decimal" to preserve mobile numeric keyboards.
    const isNumeric = type === "number";
    const internalInputType = isNumeric ? "text" : type;
    const internalInputMode = isNumeric ? (props.inputMode || "decimal") : props.inputMode;
    const internalStep = isNumeric ? (step || "any") : step;
    const allowNegative = props.min === undefined || Number(props.min) < 0;

    const isControlled = propValue !== undefined;
    const [isFocused, setIsFocused] = React.useState(false);

    // Internal display string for numeric inputs when controlled
    const [localValue, setLocalValue] = React.useState<string>(() => {
      if (!isControlled || propValue === null) return "";
      return String(propValue);
    });

    const [prevPropValue, setPrevPropValue] = React.useState(propValue);

    // Adjust state during render when propValue changes (React recommended pattern)
    if (isNumeric && isControlled && propValue !== prevPropValue) {
      setPrevPropValue(propValue);
      if (!isFocused) {
        setLocalValue(propValue !== null ? String(propValue) : "");
      } else {
        // When focused, determine if the external value represents an external update
        // rather than an echo of what the user is typing.
        const propNum = propValue !== null && propValue !== "" ? Number(propValue) : null;
        const localNum =
          localValue !== "" && localValue !== "." && localValue !== "-." && localValue !== "-"
            ? Number(localValue)
            : null;

        const isLocalZeroOrEmpty = localValue === "" || localValue === "0" || localValue === "0.";
        const isPropZero = propNum === 0;

        const numbersMatch = propNum !== null && localNum !== null && propNum === localNum;
        const zeroMatch = isPropZero && isLocalZeroOrEmpty;

        // If the incoming value differs numerically from what the user is typing,
        // it means an external source changed the value (e.g. Total Price recalculation or form reset).
        if (!numbersMatch && !zeroMatch) {
          setLocalValue(propValue !== null ? String(propValue) : "");
        }
      }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (isNumeric) {
        setIsFocused(true);
        // Auto-select entire input content on focus
        setTimeout(() => {
          e.target.select();
        }, 0);
      }
      if (onFocus) {
        onFocus(e);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (isNumeric) {
        setIsFocused(false);
        if (isControlled) {
          if (localValue.endsWith(".")) {
            const cleaned = localValue.slice(0, -1);
            setLocalValue(cleaned);
            if (e.target.value !== cleaned) {
              e.target.value = cleaned;
              if (onChange) {
                onChange(e);
              }
            }
          } else if (localValue === "" && propValue !== undefined) {
            setLocalValue(String(propValue));
          }
        }
      }
      if (onBlur) {
        onBlur(e);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumeric) {
        const originalValue = e.target.value;
        const sanitized = sanitizeNumericInput(originalValue, allowNegative);

        if (isControlled) {
          setLocalValue(sanitized);
        }
        e.target.value = sanitized;
      }
      if (onChange) {
        onChange(e);
      }
    };

    const displayValue = isNumeric && isControlled ? localValue : propValue;

    return (
      <input
        type={internalInputType}
        inputMode={internalInputMode}
        step={internalStep}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        value={displayValue}
        defaultValue={defaultValue}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export interface NumericInputProps extends Omit<InputProps, "type"> {
  type?: "number";
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (props, ref) => <Input ref={ref} type="number" step="any" {...props} />
);
NumericInput.displayName = "NumericInput";

export { Input };
