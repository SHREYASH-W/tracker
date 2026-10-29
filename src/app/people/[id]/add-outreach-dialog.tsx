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
import { outreachSchema, type OutreachFormData } from "@/lib/validators";
import { PURPOSE_VALUES, CHANNEL_VALUES, STATUS_VALUES } from "@/lib/constants";
import { createOutreachRecord } from "@/server/actions/outreach";
import { toast } from "@/components/ui/use-toast";

export function AddOutreachDialog({ open, onOpenChange, personId }: { open: boolean; onOpenChange: (v: boolean) => void; personId: number }) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<OutreachFormData>({
    resolver: zodResolver(outreachSchema),
    defaultValues: { personId, status: "not_contacted", purpose: "Networking" },
  });

  React.useEffect(() => { if (open) reset({ personId, status: "not_contacted", purpose: "Networking" }); }, [open, personId, reset]);

  const onSubmit = async (data: OutreachFormData) => {
    setIsPending(true);
    const result = await createOutreachRecord(data);
    setIsPending(false);
    if (result.success) {
      toast({ title: "Outreach record created", variant: "success" });
      onOpenChange(false);
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error ?? result.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Outreach Record</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <input type="hidden" {...register("personId", { valueAsNumber: true })} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Purpose *</Label>
              <Select defaultValue="Networking" onValueChange={(v) => setValue("purpose", v as OutreachFormData["purpose"])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PURPOSE_VALUES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Channel</Label>
              <Select onValueChange={(v) => setValue("channel", v as OutreachFormData["channel"])}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select channel" /></SelectTrigger>
                <SelectContent>{CHANNEL_VALUES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select defaultValue="not_contacted" onValueChange={(v) => setValue("status", v as OutreachFormData["status"])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_VALUES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target Role</Label>
              <Input {...register("targetRole")} className="mt-1" placeholder="Software Engineer" />
            </div>
            <div>
              <Label>First Contact Date</Label>
              <Input type="date" {...register("firstContactedAt")} className="mt-1" />
            </div>
            <div>
              <Label>Next Follow-up</Label>
              <Input type="date" {...register("nextFollowUpAt")} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea {...register("notes")} className="mt-1 h-20" placeholder="Notes about this outreach..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
