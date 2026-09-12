import * as React from "react";
import { Input, InputProps, sanitizeNumericInput } from "./input";

export interface NumericInputProps extends Omit<InputProps, "type"> {
  type?: "number";
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (props, ref) => <Input ref={ref} type="number" step="any" {...props} />
);
NumericInput.displayName = "NumericInput";

export { sanitizeNumericInput };
