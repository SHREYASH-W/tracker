"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, MessageSquarePlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deletePersonAction } from "@/lib/actions";
import type { CompanyOption, PersonWithRelations } from "@/lib/types";
import { ConfirmDialog } from "../confirm-dialog";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { EditPersonDialog } from "./edit-person-dialog";
import { LogInteractionDialog } from "./log-interaction-dialog";

export function PersonRowActions({
  entry,
  companies,
}: {
  entry: PersonWithRelations;
  companies: CompanyOption[];
}) {
  const { person, primaryOutreach } = entry;
  const [editOpen, setEditOpen] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const outreachOptions = primaryOutreach
    ? [
        {
          id: primaryOutreach.id,
          label: `${primaryOutreach.purpose}${primaryOutreach.targetRole ? ` · ${primaryOutreach.targetRole}` : ""}`,
        },
      ]
    : [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${person.fullName}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>{person.fullName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/people/${person.id}`}>
              <Eye className="h-4 w-4" />
              View profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!primaryOutreach}
            onSelect={() => setLogOpen(true)}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Log interaction
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit contact
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPersonDialog open={editOpen} onOpenChange={setEditOpen} person={person} companies={companies} />
      <LogInteractionDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        personName={person.fullName}
        outreachOptions={outreachOptions}
        defaultOutreachId={primaryOutreach?.id}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${person.fullName}?`}
        description="This permanently removes the contact, their outreach records, and all logged interactions. This cannot be undone."
        confirmLabel="Delete contact"
        onConfirm={() => deletePersonAction(person.id)}
      />
    </>
  );
}
