import { CheckCircle2, Info, XCircle } from "lucide-react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-center"
      theme="light"
      gap={8}
      offset={14}
      icons={{
        success: <CheckCircle2 size={17} className="text-accent" strokeWidth={2.25} />,
        error: <XCircle size={17} className="text-danger" strokeWidth={2.25} />,
        info: <Info size={17} className="text-accent" strokeWidth={2.25} />,
      }}
      toastOptions={{
        duration: 5000,
        classNames: {
          toast:
            "!rounded-full !border !border-border !bg-surface/95 !backdrop-blur-sm !pl-4 !pr-2 !py-2.5 !text-ink !shadow-[var(--shadow-pop)] !font-body !gap-2.5",
          title:
            "!font-body !text-[13.5px] !font-semibold !tracking-[-0.01em] !text-ink",
          description:
            "!font-body !text-[12.5px] !text-muted",
          icon:
            "!mr-0.5 !flex !items-center",
          actionButton:
            "!rounded-full !bg-[image:linear-gradient(180deg,var(--color-accent-hi),var(--color-accent)_55%,var(--color-accent-lo))] !px-3.5 !py-1.5 !font-body !text-[12.5px] !font-semibold !text-[#FFF2BD] !shadow-[var(--shadow-primary)] hover:!brightness-110 active:!scale-95 !transition-[transform,filter]",
          cancelButton:
            "!rounded-full !bg-surface-muted !px-3 !font-body !text-[12.5px] !font-medium !text-muted hover:!text-ink",
          closeButton:
            "!border-border !bg-surface !text-muted hover:!text-ink",
          success:
            "!border-l-[3px] !border-l-accent",
          error:
            "!border-l-[3px] !border-l-danger",
        },
      }}
      {...props}
    />
  );
}
