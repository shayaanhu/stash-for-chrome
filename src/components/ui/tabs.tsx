import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface-muted p-1 shadow-[inset_0_1px_3px_var(--inset-groove),inset_0_-1px_0_var(--inset-hl-soft)]",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

type TabsTriggerProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  active?: boolean;
};

const TabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
  ({ className, children, active = false, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "relative flex min-w-[82px] items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 font-body text-[13px] font-semibold leading-none outline-none transition-[color,transform] duration-[var(--dur-fast)] ease-[var(--ease-std)] active:scale-[0.94]",
        active ? "text-ink" : "text-muted hover:text-ink",
        className
      )}
      {...props}
    >
      {active && (
        <motion.span
          layoutId="stash-tab-indicator"
          className="absolute inset-0 rounded-full bg-[image:var(--grad-raised)] shadow-[0_1px_2px_var(--inset-groove),0_3px_8px_-2px_var(--inset-groove),inset_0_1px_0_var(--inset-hl)]"
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </TabsPrimitive.Trigger>
  )
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-0 outline-none", className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
