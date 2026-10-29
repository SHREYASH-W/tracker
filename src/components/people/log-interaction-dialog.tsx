"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { logInteractionAction } from "@/lib/actions";
import { initialFormState } from "@/lib/action-types";
import { CHANNEL_VALUES, INTERACTION_TYPES } from "@/lib/constants";
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

export interface OutreachOption {
  id: number;
  label: string;
}

function todayInput(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function LogInteractionDialog({
  open,
  onOpenChange,
  outreachOptions,
  defaultOutreachId,
  personName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outreachOptions: OutreachOption[];
  defaultOutreachId?: number;
  personName?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(logInteractionAction, initialFormState);

  React.useEffect(() => {
    if (!state.success) return;
    toast({ title: "Interaction logged", description: state.message, variant: "success" });
    router.refresh();
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const selectedId = defaultOutreachId ?? outreachOptions[0]?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log interaction</DialogTitle>
          <DialogDescription>
            {personName ? `Record what happened with ${personName}.` : "Record what happened."} The
            outreach status updates automatically.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {!state.success && state.message && <FormErrorSummary message={state.message} />}

          {outreachOptions.length > 1 && (
            <FormField
              label="Outreach"
              htmlFor="outreachRecordId"
              required
              error={state.errors?.outreachRecordId?.[0]}
            >
              <NativeSelect
                id="outreachRecordId"
                name="outreachRecordId"
                defaultValue={String(selectedId ?? "")}
              >
                {outreachOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}

          {outreachOptions.length <= 1 && (
            <input type="hidden" name="outreachRecordId" value={selectedId ?? ""} />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Type"
              htmlFor="interactionType"
              required
              error={state.errors?.interactionType?.[0]}
            >
              <NativeSelect id="interactionType" name="interactionType" defaultValue="Message Sent">
                {INTERACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Date" htmlFor="occurredAt" required error={state.errors?.occurredAt?.[0]}>
              <Input id="occurredAt" name="occurredAt" type="date" defaultValue={todayInput()} required />
            </FormField>
            <FormField label="Channel" htmlFor="channel" error={state.errors?.channel?.[0]}>
              <NativeSelect id="channel" name="channel" defaultValue="">
                <option value="">Not set</option>
                {CHANNEL_VALUES.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Next follow-up"
              htmlFor="nextFollowUpAt"
              error={state.errors?.nextFollowUpAt?.[0]}
              hint="Optional"
            >
              <Input id="nextFollowUpAt" name="nextFollowUpAt" type="date" />
            </FormField>
          </div>

          <FormField label="Summary" htmlFor="summary" error={state.errors?.summary?.[0]}>
            <Textarea
              id="summary"
              name="summary"
              rows={3}
              placeholder="What was said, what you sent, or what you learned"
            />
          </FormField>

          <FormField label="Outcome" htmlFor="outcome" error={state.errors?.outcome?.[0]} hint="Optional">
            <Input id="outcome" name="outcome" placeholder="e.g. They will review my resume" />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !selectedId}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Saving…" : "Log interaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
