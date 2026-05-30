import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface text-card-foreground shadow-[0_1px_0_rgba(31,27,22,0.04),0_10px_22px_rgba(31,27,22,0.035)]",
        className
      )}
      {...props}
    />
  );
}
