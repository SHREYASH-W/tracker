"use client";

import * as React from "react";
import { MessageSquarePlus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { deletePersonAction } from "@/lib/actions";
import type { CompanyOption, Person } from "@/lib/types";
import { ConfirmDialog } from "../confirm-dialog";
import { Button } from "../ui/button";
import { EditPersonDialog } from "./edit-person-dialog";
import { EmailLookupDialog } from "./email-lookup-dialog";
import { LogInteractionDialog, type OutreachOption } from "./log-interaction-dialog";
import { NewOutreachDialog, type OpportunityOption } from "./new-outreach-dialog";

export function PersonHeaderActions({
  person,
  companies,
  outreachOptions,
  opportunities,
  companyDomain,
}: {
  person: Person;
  companies: CompanyOption[];
  outreachOptions: OutreachOption[];
  opportunities: OpportunityOption[];
  companyDomain: string | null;
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  const [newOutreachOpen, setNewOutreachOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [lookupOpen, setLookupOpen] = React.useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      {outreachOptions.length > 0 && (
        <Button size="sm" onClick={() => setLogOpen(true)}>
          <MessageSquarePlus className="h-4 w-4" />
          Log interaction
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => setLookupOpen(true)}>
        <Sparkles className="h-4 w-4" />
        Find email
      </Button>
      <Button size="sm" variant="outline" onClick={() => setNewOutreachOpen(true)}>
        <Plus className="h-4 w-4" />
        Add outreach
      </Button>
      <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Delete ${person.fullName}`}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <EditPersonDialog open={editOpen} onOpenChange={setEditOpen} person={person} companies={companies} />
      <EmailLookupDialog
        open={lookupOpen}
        onOpenChange={setLookupOpen}
        person={person}
        initialDomain={companyDomain}
      />
      <LogInteractionDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        personName={person.fullName}
        outreachOptions={outreachOptions}
      />
      <NewOutreachDialog
        open={newOutreachOpen}
        onOpenChange={setNewOutreachOpen}
        personId={person.id}
        personName={person.fullName}
        opportunities={opportunities}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${person.fullName}?`}
        description="This permanently removes the contact, their outreach records, and all logged interactions. This cannot be undone."
        confirmLabel="Delete contact"
        onConfirm={() => deletePersonAction(person.id)}
        redirectTo="/people"
      />
    </div>
  );
}
