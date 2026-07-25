import { toast } from "sonner";

export function confirmAction(
  message: string,
  opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean },
): Promise<boolean> {
  return new Promise((resolve) => {
    const id = toast(message, {
      duration: 10000,
      action: {
        label: opts?.confirmLabel ?? "Confirmar",
        onClick: () => {
          toast.dismiss(id);
          resolve(true);
        },
      },
      cancel: {
        label: opts?.cancelLabel ?? "Cancelar",
        onClick: () => {
          toast.dismiss(id);
          resolve(false);
        },
      },
      onDismiss: () => resolve(false),
      onAutoClose: () => resolve(false),
      className: opts?.danger ? "border-destructive" : undefined,
    });
  });
}
