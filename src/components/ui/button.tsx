import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-btn)] font-body text-sm font-medium transition-[background-color,border-color,color] duration-[var(--dur-instant)] ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Confident flat terracotta. Hover deepens the ink. No gloss, no glow, no movement.
        primary: "bg-accent text-ink shadow-[var(--shadow-soft)] hover:bg-accent-hi",
        secondary:
          "border border-border bg-surface text-ink shadow-[var(--shadow-soft)] hover:border-border-strong hover:bg-surface-subtle",
        ghost: "bg-transparent text-muted hover:bg-control-hover hover:text-ink",
        danger: "bg-transparent text-muted hover:bg-danger-soft hover:text-danger"
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "h-9 w-9 p-0",
        iconSm: "h-7 w-7 p-0"
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "md"
    }
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
