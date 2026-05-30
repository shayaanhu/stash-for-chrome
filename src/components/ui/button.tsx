import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-btn)] text-sm font-semibold tracking-normal transition-[background,border-color,color,box-shadow,transform] duration-[var(--dur-instant)] ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "border border-accent-ink bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-accent-ink",
        secondary: "border border-border bg-surface text-ink hover:bg-surface-subtle",
        ghost: "border border-transparent bg-transparent text-muted hover:bg-control-hover hover:text-ink",
        danger:
          "border border-transparent bg-transparent text-muted hover:border-danger-border-strong hover:bg-danger-soft hover:text-danger"
      },
      size: {
        sm: "h-8 px-2.5",
        md: "h-9 px-3",
        icon: "h-8 w-8 p-0",
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
