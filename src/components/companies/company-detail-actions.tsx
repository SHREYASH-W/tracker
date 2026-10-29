"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Trash2, UserSearch } from "lucide-react";
import { deleteCompanyAction } from "@/lib/actions";
import { normalizeEmailDomain } from "@/lib/email-lookup";
import type { Company } from "@/lib/types";
import { ConfirmDialog } from "../confirm-dialog";
import { Button } from "../ui/button";
import { CompanyDialog } from "./company-dialog";

export function CompanyDetailActions({ company }: { company: Company }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const domain = normalizeEmailDomain(company.website);

  return (
    <div className="flex flex-wrap gap-2">
      {domain && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/find-hr?domain=${encodeURIComponent(domain)}`}>
            <UserSearch className="h-4 w-4" />
            Find HR contacts
          </Link>
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
      <Button size="icon" variant="ghost" aria-label={`Delete ${company.name}`} onClick={() => setDeleteOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>

      <CompanyDialog open={editOpen} onOpenChange={setEditOpen} company={company} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${company.name}?`}
        description="The company and its opportunities will be removed. Contacts will be kept without a company. This cannot be undone."
        confirmLabel="Delete company"
        onConfirm={() => deleteCompanyAction(company.id)}
        redirectTo="/companies"
      />
    </div>
  );
}
