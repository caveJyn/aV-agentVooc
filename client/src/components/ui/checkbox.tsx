import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils"; // Assuming a utility for className concatenation exists

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ id, label, className, ...props }, ref) => {
    return (
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id={id}
          ref={ref}
          className={cn(
            "h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500",
            className
          )}
          {...props}
        />
        {label && (
          <Label htmlFor={id} className="text-sm text-gray-700">
            {label}
          </Label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };