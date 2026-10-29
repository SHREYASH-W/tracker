"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, CalendarClock, Calendar, CheckCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { PersonAvatar } from "@/components/person-avatar";
import { toast } from "@/components/ui/use-toast";
import { formatDate, formatRelative } from "@/lib/utils";
import { completeFollowUp, rescheduleFollowUp } from "@/server/actions/outreach";
import type { FollowUpItem } from "@/lib/types";

interface Props {
  data: { overdue: FollowUpItem[]; today: FollowUpItem[]; soon: FollowUpItem[]; later: FollowUpItem[] };
}

function FollowUpRow({ item, onComplete, onReschedule }: {
  item: FollowUpItem;
  onComplete: (id: number) => void;
  onReschedule: (id: number, date: string) => void;
}) {
  const [rescheduling, setRescheduling] = React.useState(false);
  const [dateVal, setDateVal] = React.useState("");

  return (
    <div className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors">
      <Link href={`/people/${item.personId}`}>
        <PersonAvatar name={item.personName} size="sm" />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <Link href={`/people/${item.personId}`} className="font-medium text-sm hover:text-primary">{item.personName}</Link>
          {item.companyName && <span className="text-xs text-muted-foreground">{item.companyName}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{item.purpose}</span>
          <StatusBadge status={item.status} className="text-[10px] py-0" />
        </div>
        {item.lastContactedAt && <p className="text-xs text-muted-foreground mt-0.5">Last contact: {formatDate(item.lastContactedAt)}</p>}
      </div>
      <div className="text-xs font-medium text-right shrink-0">
        {formatRelative(item.nextFollowUpAt)}
        <p className="text-muted-foreground font-normal">{formatDate(item.nextFollowUpAt)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {rescheduling ? (
          <>
            <Input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} className="h-7 w-36 text-xs" />
            <Button size="sm" className="h-7 text-xs" disabled={!dateVal} onClick={() => { onReschedule(item.outreachId, dateVal); setRescheduling(false); }}>Set</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setRescheduling(false)}>Cancel</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRescheduling(true)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />Reschedule
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onComplete(item.outreachId)}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" />Done
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, items, color, onComplete, onReschedule }: {
  title: string; icon: React.ElementType; items: FollowUpItem[];
  color: string; onComplete: (id: number) => void; onReschedule: (id: number, date: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`flex items-center gap-2 mb-3 ${color}`}>
        <Icon className="h-4 w-4" />
        <h2 className="font-semibold text-sm">{title} ({items.length})</h2>
      </div>
      <div className="space-y-2">
        {items.map(item => <FollowUpRow key={item.outreachId} item={item} onComplete={onComplete} onReschedule={onReschedule} />)}
      </div>
    </div>
  );
}

export function FollowUpsClient({ data }: Props) {
  const router = useRouter();
  const total = data.overdue.length + data.today.length + data.soon.length + data.later.length;

  const handleComplete = async (outreachId: number) => {
    const result = await completeFollowUp(outreachId);
    if (result.success) { toast({ title: "Follow-up completed", variant: "success" }); router.refresh(); }
    else toast({ title: "Error", description: result.message, variant: "destructive" });
  };

  const handleReschedule = async (outreachId: number, dateStr: string) => {
    const ts = new Date(dateStr + "T00:00:00").getTime();
    const result = await rescheduleFollowUp(outreachId, ts);
    if (result.success) { toast({ title: "Follow-up rescheduled", variant: "success" }); router.refresh(); }
    else toast({ title: "Error", description: result.message, variant: "destructive" });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Follow-ups</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{total} follow-up{total !== 1 ? "s" : ""} scheduled</p>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center border rounded-lg">
          <CheckCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">You're all caught up!</p>
          <p className="text-sm text-muted-foreground mt-1">No follow-ups scheduled. Add one from a contact's profile.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Overdue" icon={AlertTriangle} items={data.overdue} color="text-destructive" onComplete={handleComplete} onReschedule={handleReschedule} />
          <Section title="Due Today" icon={Clock} items={data.today} color="text-amber-600" onComplete={handleComplete} onReschedule={handleReschedule} />
          <Section title="Due Soon (next 7 days)" icon={CalendarClock} items={data.soon} color="text-primary" onComplete={handleComplete} onReschedule={handleReschedule} />
          <Section title="Later" icon={Calendar} items={data.later} color="text-muted-foreground" onComplete={handleComplete} onReschedule={handleReschedule} />
        </div>
      )}
    </div>
  );
}
