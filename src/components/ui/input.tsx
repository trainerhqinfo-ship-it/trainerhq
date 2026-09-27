import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-[#E8EBE4]">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            "h-9 w-full px-3 text-sm rounded-lg border border-[#2E3129] bg-[#222520]",
            "placeholder:text-[#6B6E67] text-[#E8EBE4]",
            "focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50 focus:border-[#B9E84A]",
            "disabled:bg-[#1A1C18] disabled:text-[#6B6E67] disabled:cursor-not-allowed",
            "transition-colors duration-150",
            error && "border-red-400 focus:ring-red-200",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-[#6B6E67]">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-[#E8EBE4]">{label}</label>
        )}
        <select
          ref={ref}
          className={cn(
            "h-9 w-full px-3 text-sm rounded-lg border border-[#2E3129] bg-[#222520]",
            "text-[#E8EBE4] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50 focus:border-[#B9E84A]",
            "disabled:bg-[#1A1C18] disabled:cursor-not-allowed",
            "transition-colors duration-150",
            error && "border-red-400",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-[#E8EBE4]">{label}</label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-lg border border-[#2E3129] bg-[#222520] min-h-[80px]",
            "placeholder:text-[#6B6E67] text-[#E8EBE4] resize-none",
            "focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50 focus:border-[#B9E84A]",
            "transition-colors duration-150",
            error && "border-red-400",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";