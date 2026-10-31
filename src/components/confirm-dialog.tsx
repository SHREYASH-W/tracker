"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  variant?: "destructive" | "default";
  /** Shorthand: `destructive={true}` sets variant to "destructive". */
  destructive?: boolean;
  onConfirm: () => void | Promise<unknown>;
  isPending?: boolean;
  /** If provided, navigate to this path after a successful confirm. */
  redirectTo?: string;
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  pendingLabel,
  variant, destructive, onConfirm, isPending: externalPending,
  redirectTo,
}: ConfirmDialogProps) {
  const router = useRouter();
  const [internalPending, setInternalPending] = React.useState(false);
  const isPending = externalPending || internalPending;

  const resolvedVariant = variant ?? (destructive === false ? "default" : "destructive");
  const buttonLabel = isPending ? (pendingLabel ?? "Processing...") : confirmLabel;

  const handleConfirm = async () => {
    setInternalPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
      if (redirectTo) {
        router.push(redirectTo);
      }
    } catch {
      // Errors are handled by the caller via toast, etc.
    } finally {
      setInternalPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button variant={resolvedVariant} onClick={handleConfirm} disabled={isPending}>
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

