"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_VALUES } from "@/lib/constants";
import { updateOutreachStatus } from "@/server/actions/outreach";
import { toast } from "@/components/ui/use-toast";

export function StatusChangeDialog({ open, onOpenChange, outreachId, currentStatus }: {
  open: boolean; onOpenChange: (v: boolean) => void; outreachId: number; currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState(currentStatus);
  const [note, setNote] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);

  React.useEffect(() => { if (open) { setStatus(currentStatus); setNote(""); } }, [open, currentStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    const result = await updateOutreachStatus({ outreachId, status, note });
    setIsPending(false);
    if (result.success) {
      toast({ title: "Status updated", variant: "success" });
      onOpenChange(false);
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error ?? result.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Update Status</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>New Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_VALUES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-20" placeholder="Add a note about this status change..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
