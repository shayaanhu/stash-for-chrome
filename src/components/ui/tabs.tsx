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
      "grid rounded-[var(--radius-card)] border border-border bg-surface-muted p-[3px] text-muted",
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
        "relative z-0 flex h-9 items-center justify-center gap-2 rounded-[var(--radius-btn)] px-3 text-sm font-semibold tracking-[-0.01em] text-muted outline-none transition-colors duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg data-[state=active]:text-ink",
        className
      )}
      {...props}
    >
      {active ? (
        <motion.span
          layoutId="stash-active-tab"
          className="absolute inset-0 -z-10 rounded-[var(--radius-btn)] border border-border bg-surface shadow-[var(--shadow-soft)]"
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        />
      ) : null}
      {children}
    </TabsPrimitive.Trigger>
  )
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-3 outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
