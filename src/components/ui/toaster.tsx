import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-center"
      theme="light"
      gap={8}
      toastOptions={{
        duration: 5000,
        classNames: {
          toast:
            "!rounded-[var(--radius-card)] !border !border-border !bg-ink !text-white !shadow-[0_12px_28px_rgba(31,27,22,0.22)]",
          title: "!font-body !text-sm !font-semibold",
          actionButton:
            "!rounded-[var(--radius-btn)] !bg-surface !px-2.5 !font-body !text-xs !font-bold !text-ink"
        }
      }}
      {...props}
    />
  );
}
