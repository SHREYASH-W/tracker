"use client";

import * as React from "react";
import { BellOff, CalendarClock, MessageSquarePlus } from "lucide-react";
import { clearFollowUpAction } from "@/lib/actions";
import type { OutreachRecord } from "@/lib/types";
import { ConfirmDialog } from "../confirm-dialog";
import { RescheduleDialog } from "../follow-ups/reschedule-dialog";
import { Button } from "../ui/button";
import { LogInteractionDialog } from "./log-interaction-dialog";

export function OutreachActions({
  outreach,
  personName,
}: {
  outreach: OutreachRecord;
  personName: string;
}) {
  const [logOpen, setLogOpen] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);

  const label = `${outreach.purpose}${outreach.targetRole ? ` · ${outreach.targetRole}` : ""}`;

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="outline" onClick={() => setLogOpen(true)}>
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Log interaction
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setRescheduleOpen(true)}>
        <CalendarClock className="h-3.5 w-3.5" />
        {outreach.nextFollowUpAt ? "Reschedule" : "Schedule follow-up"}
      </Button>
      {outreach.nextFollowUpAt && (
        <Button size="sm" variant="ghost" onClick={() => setClearOpen(true)}>
          <BellOff className="h-3.5 w-3.5" />
          Clear follow-up
        </Button>
      )}

      <LogInteractionDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        personName={personName}
        outreachOptions={[{ id: outreach.id, label }]}
        defaultOutreachId={outreach.id}
      />
      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        followUpId={outreach.id}
        currentDate={outreach.nextFollowUpAt}
        personName={personName}
      />
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear follow-up?"
        description="This removes the scheduled follow-up date but keeps the outreach record and its history."
        confirmLabel="Clear follow-up"
        pendingLabel="Clearing…"
        destructive={false}
        onConfirm={() => clearFollowUpAction(outreach.id)}
      />
    </div>
  );
}
