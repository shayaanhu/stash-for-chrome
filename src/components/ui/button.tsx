import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-btn)] font-body text-[13px] font-semibold tracking-[-0.01em] transition-[transform,box-shadow,filter,background-color,color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-std)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-[image:linear-gradient(180deg,var(--color-accent-hi)_0%,var(--color-accent)_52%,var(--color-accent-lo)_100%)] text-[#FFF2BD] shadow-[var(--shadow-primary)] hover:-translate-y-px hover:brightness-[1.06] hover:shadow-[var(--shadow-primary-hover)] active:translate-y-0 active:brightness-95 active:shadow-[var(--shadow-press)]",
        secondary:
          "border border-border bg-[image:linear-gradient(180deg,#FFFFFF_0%,var(--color-surface-subtle)_100%)] text-ink shadow-[var(--shadow-raised)] hover:-translate-y-px hover:border-border-strong hover:shadow-[var(--shadow-raised-hover)] active:translate-y-0 active:shadow-[var(--shadow-press)]",
        ghost:
          "bg-transparent text-muted hover:bg-surface-muted hover:text-ink active:scale-[0.97]",
        danger:
          "bg-transparent text-muted hover:bg-danger-soft hover:text-danger active:scale-[0.97]",
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
