"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { interactionSchema } from "@/lib/validators";
import { INTERACTION_TYPES, CHANNEL_VALUES } from "@/lib/constants";
import { logInteraction } from "@/server/actions/outreach";
import { toast } from "@/components/ui/use-toast";
import { timestampToDateInput } from "@/lib/utils";
import type { z } from "zod";

type InteractionInput = z.input<typeof interactionSchema>;

export function LogInteractionDialog({ open, onOpenChange, outreachRecordId }: { open: boolean; onOpenChange: (v: boolean) => void; outreachRecordId: number }) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const today = timestampToDateInput(Date.now());
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<InteractionInput>({
    resolver: zodResolver(interactionSchema),
    defaultValues: { outreachRecordId, occurredAt: today, interactionType: "Message Sent" },
  });

  React.useEffect(() => {
    if (open) reset({ outreachRecordId, occurredAt: today, interactionType: "Message Sent" });
  }, [open, outreachRecordId, reset, today]);


  const onSubmit = async (data: Record<string, unknown>) => {
    setIsPending(true);
    const result = await logInteraction(data);
    setIsPending(false);
    if (result.success) {
      toast({ title: "Interaction logged", variant: "success" });
      onOpenChange(false);
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error ?? result.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Log Interaction</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <input type="hidden" {...register("outreachRecordId", { valueAsNumber: true })} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Interaction Type *</Label>
              <Select defaultValue="Message Sent" onValueChange={(v) => setValue("interactionType", v as InteractionInput["interactionType"])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{INTERACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              {errors.interactionType && <p className="text-xs text-destructive mt-1">{errors.interactionType.message}</p>}
            </div>
            <div>
              <Label>Channel</Label>
              <Select onValueChange={(v) => setValue("channel", v as InteractionInput["channel"])}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select channel" /></SelectTrigger>
                <SelectContent>{CHANNEL_VALUES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" defaultValue={today} {...register("occurredAt")} className="mt-1" />
              {errors.occurredAt && <p className="text-xs text-destructive mt-1">{String(errors.occurredAt.message)}</p>}
            </div>
            <div>
              <Label>Next Follow-up</Label>
              <Input type="date" {...register("nextFollowUpAt")} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Summary</Label>
            <Textarea {...register("summary")} className="mt-1 h-24" placeholder="What happened? What was discussed?" />
          </div>
          <div>
            <Label>Outcome</Label>
            <Input {...register("outcome")} className="mt-1" placeholder="e.g. Agreed to follow up next week" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Interaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
