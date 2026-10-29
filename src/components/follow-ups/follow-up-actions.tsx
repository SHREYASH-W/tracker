"use client";

import * as React from "react";
import { BellOff, CalendarClock, MessageSquarePlus } from "lucide-react";
import { clearFollowUpAction } from "@/lib/actions";
import { ConfirmDialog } from "../confirm-dialog";
import { RescheduleDialog } from "../follow-ups/reschedule-dialog";
import { Button } from "../ui/button";
import { LogInteractionDialog } from "../people/log-interaction-dialog";

export function FollowUpActions({
  followUpId,
  personName,
  purpose,
  nextFollowUpAt,
}: {
  followUpId: number;
  personName: string;
  purpose: string;
  nextFollowUpAt: number;
}) {
  const [logOpen, setLogOpen] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [doneOpen, setDoneOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" onClick={() => setLogOpen(true)}>
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Log
      </Button>
      <Button size="icon" variant="ghost" aria-label="Reschedule follow-up" onClick={() => setRescheduleOpen(true)}>
        <CalendarClock className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" aria-label="Mark follow-up done" onClick={() => setDoneOpen(true)}>
        <BellOff className="h-4 w-4" />
      </Button>

      <LogInteractionDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        personName={personName}
        outreachOptions={[{ id: followUpId, label: purpose }]}
        defaultOutreachId={followUpId}
      />
      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        followUpId={followUpId}
        currentDate={nextFollowUpAt}
        personName={personName}
      />
      <ConfirmDialog
        open={doneOpen}
        onOpenChange={setDoneOpen}
        title="Mark follow-up done?"
        description="This removes the follow-up date. The outreach record and its interaction history stay intact."
        confirmLabel="Mark done"
        pendingLabel="Saving…"
        destructive={false}
        onConfirm={() => clearFollowUpAction(followUpId)}
      />
    </div>
  );
}
