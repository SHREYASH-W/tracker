"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { rescheduleFollowUpAction } from "@/lib/actions";
import { timestampToDateInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export function RescheduleDialog({
  open,
  onOpenChange,
  followUpId,
  currentDate,
  personName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUpId: number;
  currentDate: number | null;
  personName?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const defaultValue = timestampToDateInput(currentDate) || timestampToDateInput(Date.now());

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const dateValue = String(data.get("nextFollowUpAt") ?? "");
    if (!dateValue) return;

    setPending(true);
    try {
      const result = await rescheduleFollowUpAction(followUpId, dateValue);
      if (result.success) {
        toast({ title: "Follow-up rescheduled", description: result.message, variant: "success" });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({ title: "Could not reschedule", description: result.message, variant: "destructive" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reschedule follow-up</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="New follow-up date"
            htmlFor="nextFollowUpAt"
            required
            hint={personName ? `For ${personName}` : undefined}
          >
            <Input id="nextFollowUpAt" name="nextFollowUpAt" type="date" defaultValue={defaultValue} required />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save date
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
