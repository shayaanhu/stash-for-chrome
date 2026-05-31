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
            "!rounded-[var(--radius-card)] !border !border-border !bg-surface !text-ink !shadow-[var(--shadow-pop)] !font-body",
          title:
            "!font-body !text-[14px] !font-semibold !text-ink",
          description:
            "!font-body !text-[13px] !text-muted",
          actionButton:
            "!rounded-[var(--radius-btn)] !bg-accent !px-4 !py-2 !font-body !text-[14px] !font-semibold !text-white hover:!bg-accent-hi",
          cancelButton:
            "!rounded-[var(--radius-btn)] !bg-surface-muted !px-3 !font-body !text-[13px] !font-medium !text-muted",
          closeButton:
            "!border-border !bg-surface !text-muted",
          success:
            "!border-l-4 !border-l-accent",
          error:
            "!border-l-4 !border-l-danger",
        },
      }}
      {...props}
    />
  );
}
