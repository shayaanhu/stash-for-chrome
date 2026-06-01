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
      "inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface-muted p-1 shadow-[inset_0_1px_3px_rgba(20,35,80,0.14),inset_0_-1px_0_rgba(255,255,255,0.4)]",
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
        "relative flex items-center gap-2 rounded-full px-3.5 py-1.5 font-body text-[13px] font-semibold outline-none transition-[color,transform] duration-[var(--dur-fast)] ease-[var(--ease-std)] active:scale-[0.94]",
        active ? "text-ink" : "text-muted hover:text-ink",
        className
      )}
      {...props}
    >
      {active && (
        <motion.span
          layoutId="stash-tab-indicator"
          className="absolute inset-0 rounded-full bg-[image:linear-gradient(180deg,#FFFFFF_0%,var(--color-surface-subtle)_100%)] shadow-[0_1px_2px_rgba(20,35,80,0.13),0_3px_8px_-2px_rgba(20,35,80,0.17),inset_0_1px_0_rgba(255,255,255,0.9)]"
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
