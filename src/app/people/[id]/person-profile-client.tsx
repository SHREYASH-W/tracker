"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Mail, Phone, Linkedin, Globe, MapPin, Calendar, Tag, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { PersonAvatar, CompanyInitials } from "@/components/person-avatar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AddOutreachDialog } from "./add-outreach-dialog";
import { LogInteractionDialog } from "./log-interaction-dialog";
import { StatusChangeDialog } from "./status-change-dialog";
import { toast } from "@/components/ui/use-toast";
import { formatDate, formatDateTime, formatRelative, isOverdue, isDueToday } from "@/lib/utils";
import { deletePerson } from "@/server/actions/people";
import { completeFollowUp } from "@/server/actions/outreach";
import type { Person, Company, OutreachRecord, Interaction } from "@/lib/types";

interface Props {
  data: {
    person: Person;
    company: Company | null;
    outreachRecords: OutreachRecord[];
    interactions: Interaction[];
  };
}

export function PersonProfileClient({ data }: Props) {
  const router = useRouter();
  const { person, company, outreachRecords, interactions } = data;
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [addOutreachOpen, setAddOutreachOpen] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState<number | null>(null);  // outreachId
  const [statusOpen, setStatusOpen] = React.useState<number | null>(null);  // outreachId
  const [completingFollowUp, setCompletingFollowUp] = React.useState<number | null>(null);

  const primaryOutreach = outreachRecords[0];

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deletePerson(person.id);
    setIsDeleting(false);
    if (result.success) {
      toast({ title: "Contact deleted", variant: "success" });
      router.push("/people");
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
      setDeleteOpen(false);
    }
  };

  const handleCompleteFollowUp = async (outreachId: number) => {
    setCompletingFollowUp(outreachId);
    const result = await completeFollowUp(outreachId);
    setCompletingFollowUp(null);
    if (result.success) {
      toast({ title: "Follow-up completed", variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  // Collect interactions grouped by outreach record id
  const interactionsByOutreach = new Map<number, Interaction[]>();
  for (const i of interactions) {
    const arr = interactionsByOutreach.get(i.outreachRecordId) ?? [];
    arr.push(i);
    interactionsByOutreach.set(i.outreachRecordId, arr);
  }

  return (
    <div className="space-y-4">
      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <PersonAvatar name={person.fullName} size="lg" className="h-16 w-16 text-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold">{person.fullName}</h1>
                  {person.jobTitle && <p className="text-muted-foreground">{person.jobTitle}{person.department ? ` · ${person.department}` : ""}</p>}
                  {company && (
                    <Link href={`/companies/${company.id}`} className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
                      <CompanyInitials name={company.name} size="sm" />
                      {company.name}
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/people/${person.id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-1" />Delete
                  </Button>
                </div>
              </div>

              {/* Contact details row */}
              <div className="flex flex-wrap gap-3 mt-3">
                {person.email && <a href={`mailto:${person.email}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Mail className="h-3.5 w-3.5" />{person.email}</a>}
                {person.phone && <a href={`tel:${person.phone}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Phone className="h-3.5 w-3.5" />{person.phone}</a>}
                {person.linkedinUrl && <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Linkedin className="h-3.5 w-3.5" />LinkedIn</a>}
                {person.otherProfileUrl && <a href={person.otherProfileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Globe className="h-3.5 w-3.5" />Profile</a>}
                {person.location && <span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{person.location}</span>}
              </div>

              {/* Current status */}
              {primaryOutreach && (
                <div className="flex items-center gap-3 mt-3">
                  <StatusBadge status={primaryOutreach.status} />
                  <span className="text-xs text-muted-foreground">{primaryOutreach.purpose}</span>
                  {primaryOutreach.nextFollowUpAt && (
                    <span className={`text-xs font-medium ${isOverdue(primaryOutreach.nextFollowUpAt) ? "text-destructive" : isDueToday(primaryOutreach.nextFollowUpAt) ? "text-amber-600" : "text-muted-foreground"}`}>
                      Follow-up: {formatRelative(primaryOutreach.nextFollowUpAt)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {person.notes && (
            <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <strong className="text-foreground block mb-1">Notes</strong>
              {person.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outreach records + interactions */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Outreach Records ({outreachRecords.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAddOutreachOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />New Outreach
          </Button>
        </CardHeader>
        <CardContent>
          {outreachRecords.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No outreach records yet.
              <Button variant="link" className="ml-1 p-0 h-auto" onClick={() => setAddOutreachOpen(true)}>Add one</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {outreachRecords.map((record) => {
                const recordInteractions = interactionsByOutreach.get(record.id) ?? [];
                const overdueFollowUp = isOverdue(record.nextFollowUpAt);
                return (
                  <div key={record.id} className="rounded-md border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={record.status} />
                          <Badge variant="outline" className="text-xs">{record.purpose}</Badge>
                          {record.channel && <Badge variant="outline" className="text-xs">{record.channel}</Badge>}
                        </div>
                        {record.targetRole && <p className="text-sm mt-1">Target: <span className="font-medium">{record.targetRole}</span></p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setStatusOpen(record.id)}>Update Status</Button>
                        <Button size="sm" variant="outline" onClick={() => setLogOpen(record.id)}>
                          <MessageCircle className="h-4 w-4 mr-1" />Log Interaction
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {record.firstContactedAt && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />First contact: {formatDate(record.firstContactedAt)}</span>}
                      {record.lastContactedAt && record.lastContactedAt !== record.firstContactedAt && <span>Last contact: {formatDate(record.lastContactedAt)}</span>}
                      {record.lastResponseAt && <span>Last response: {formatDate(record.lastResponseAt)}</span>}
                      {record.nextFollowUpAt && (
                        <span className={overdueFollowUp ? "text-destructive font-medium" : ""}>
                          Follow-up: {formatRelative(record.nextFollowUpAt)}
                          {!overdueFollowUp && (
                            <button className="ml-2 text-primary underline" onClick={() => handleCompleteFollowUp(record.id)}>
                              {completingFollowUp === record.id ? "..." : "Mark done"}
                            </button>
                          )}
                        </span>
                      )}
                    </div>

                    {record.notes && <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2">{record.notes}</p>}

                    {/* Interaction timeline */}
                    {recordInteractions.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Interaction history</p>
                        <div className="space-y-2">
                          {recordInteractions.map((interaction) => (
                            <div key={interaction.id} className="flex items-start gap-3 text-sm">
                              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                              <div className="flex-1">
                                <div className="flex items-baseline justify-between">
                                  <span className="font-medium">{interaction.interactionType}</span>
                                  <span className="text-xs text-muted-foreground">{formatDate(interaction.occurredAt)}</span>
                                </div>
                                {interaction.summary && <p className="text-muted-foreground text-xs mt-0.5">{interaction.summary}</p>}
                                {interaction.outcome && <p className="text-xs text-muted-foreground mt-0.5">Outcome: {interaction.outcome}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddOutreachDialog open={addOutreachOpen} onOpenChange={setAddOutreachOpen} personId={person.id} />
      {logOpen && <LogInteractionDialog open onOpenChange={() => setLogOpen(null)} outreachRecordId={logOpen} />}
      {statusOpen && <StatusChangeDialog open onOpenChange={() => setStatusOpen(null)} outreachId={statusOpen} currentStatus={outreachRecords.find(o => o.id === statusOpen)?.status ?? "not_contacted"} />}
      <ConfirmDialog
        open={deleteOpen} onOpenChange={setDeleteOpen}
        title="Delete this contact?"
        description="This will permanently delete the contact and all their interaction history. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </div>
  );
}
