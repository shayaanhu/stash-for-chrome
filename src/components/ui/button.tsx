import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-btn)] text-sm font-semibold tracking-[-0.01em] transition-[background,border-color,color,box-shadow,transform] duration-[var(--dur-instant)] ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-55 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "border border-accent-lo bg-[linear-gradient(180deg,var(--color-accent-hi),var(--color-accent))] text-white shadow-[var(--shadow-primary)] hover:bg-[linear-gradient(180deg,var(--color-accent),var(--color-accent-lo))] hover:shadow-[var(--shadow-primary-hover)]",
        secondary:
          "border border-border bg-[linear-gradient(180deg,#ffffff,#fbf9f4)] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.75),var(--shadow-soft)] hover:-translate-y-px hover:border-border-strong hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.75),var(--shadow-lift)] active:translate-y-0 active:shadow-[var(--shadow-soft)]",
        ghost:
          "border border-transparent bg-transparent text-muted hover:bg-control-hover hover:text-ink",
        danger:
          "border border-transparent bg-transparent text-muted hover:border-danger-border-strong hover:bg-danger-soft hover:text-danger"
      },
      size: {
        sm: "h-8 px-2.5",
        md: "h-9 px-3.5",
        lg: "h-10 px-4 text-[13.5px]",
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
