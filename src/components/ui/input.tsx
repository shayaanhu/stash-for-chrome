import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 min-w-0 rounded-[var(--radius-btn)] border border-border bg-surface px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-standard)] placeholder:text-muted-2 focus:border-accent focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...props}
    />
  );
}
