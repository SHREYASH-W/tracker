"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createOutreachAction } from "@/lib/actions";
import { initialFormState } from "@/lib/action-types";
import { CHANNEL_VALUES, PURPOSE_VALUES, STATUS_LIST } from "@/lib/constants";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FormErrorSummary, FormField } from "../ui/form-field";
import { Input } from "../ui/input";
import { NativeSelect } from "../ui/native-select";
import { Textarea } from "../ui/textarea";
import { useToast } from "../ui/use-toast";

export interface OpportunityOption {
  id: number;
  title: string;
}

export function NewOutreachDialog({
  open,
  onOpenChange,
  personId,
  personName,
  opportunities = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: number;
  personName?: string;
  opportunities?: OpportunityOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(createOutreachAction, initialFormState);

  React.useEffect(() => {
    if (!state.success) return;
    toast({ title: "Outreach added", description: state.message, variant: "success" });
    router.refresh();
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add outreach</DialogTitle>
          <DialogDescription>
            {personName ? `Start a new outreach thread with ${personName}.` : "Start a new outreach thread."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="personId" value={personId} />
          {!state.success && state.message && <FormErrorSummary message={state.message} />}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Purpose" htmlFor="new-purpose" required error={state.errors?.purpose?.[0]}>
              <NativeSelect id="new-purpose" name="purpose" defaultValue="">
                <option value="" disabled>
                  Select purpose
                </option>
                {PURPOSE_VALUES.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {purpose}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Target role" htmlFor="new-targetRole" error={state.errors?.targetRole?.[0]}>
              <Input id="new-targetRole" name="targetRole" placeholder="Backend Engineer" />
            </FormField>
            <FormField label="Channel" htmlFor="new-channel" error={state.errors?.channel?.[0]}>
              <NativeSelect id="new-channel" name="channel" defaultValue="">
                <option value="">Not set</option>
                {CHANNEL_VALUES.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Status" htmlFor="new-status" error={state.errors?.status?.[0]}>
              <NativeSelect id="new-status" name="status" defaultValue="not_contacted">
                {STATUS_LIST.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="First contacted"
              htmlFor="new-firstContactedAt"
              error={state.errors?.firstContactedAt?.[0]}
            >
              <Input id="new-firstContactedAt" name="firstContactedAt" type="date" />
            </FormField>
            <FormField
              label="Next follow-up"
              htmlFor="new-nextFollowUpAt"
              error={state.errors?.nextFollowUpAt?.[0]}
            >
              <Input id="new-nextFollowUpAt" name="nextFollowUpAt" type="date" />
            </FormField>
            <FormField label="Last response" htmlFor="new-lastResponseAt" error={state.errors?.lastResponseAt?.[0]}>
              <Input id="new-lastResponseAt" name="lastResponseAt" type="date" />
            </FormField>
            {opportunities.length > 0 && (
              <FormField
                label="Linked opportunity"
                htmlFor="new-opportunityId"
                error={state.errors?.opportunityId?.[0]}
              >
                <NativeSelect id="new-opportunityId" name="opportunityId" defaultValue="">
                  <option value="">None</option>
                  {opportunities.map((opportunity) => (
                    <option key={opportunity.id} value={opportunity.id}>
                      {opportunity.title}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            )}
            <FormField
              label="Notes"
              htmlFor="new-notes"
              error={state.errors?.notes?.[0]}
              className="sm:col-span-2"
            >
              <Textarea id="new-notes" name="notes" rows={3} placeholder="Context for this thread" />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Adding…" : "Add outreach"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
