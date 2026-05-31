import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-btn)] font-body text-[13px] font-semibold tracking-[-0.01em] transition-[background-color,color,opacity,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-std)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white shadow-[var(--shadow-xs)] hover:bg-accent-hi active:bg-accent-lo active:shadow-none",
        secondary:
          "border border-border bg-surface text-ink shadow-[var(--shadow-xs)] hover:border-border-strong hover:bg-surface-subtle",
        ghost:
          "bg-transparent text-muted hover:bg-surface-muted hover:text-ink",
        danger:
          "bg-transparent text-muted hover:bg-danger-soft hover:text-danger",
      },
      size: {
        sm:     "h-8 px-3.5 text-[12.5px]",
        md:     "h-10 px-5 text-[13.5px]",
        lg:     "h-11 px-6 text-[14px]",
        icon:   "h-9 w-9 p-0",
        iconSm: "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
