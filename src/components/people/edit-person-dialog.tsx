"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updatePersonAction } from "@/lib/actions";
import { initialFormState } from "@/lib/action-types";
import type { CompanyOption, Person } from "@/lib/types";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FormErrorSummary, FormField } from "../ui/form-field";
import { Input } from "../ui/input";
import { NativeSelect } from "../ui/native-select";
import { Textarea } from "../ui/textarea";
import { useToast } from "../ui/use-toast";

export function EditPersonDialog({
  open,
  onOpenChange,
  person,
  companies,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Person;
  companies: CompanyOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(updatePersonAction, initialFormState);

  React.useEffect(() => {
    if (!state.success) return;
    toast({ title: "Contact updated", description: state.message, variant: "success" });
    router.refresh();
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
          <DialogDescription>Update {person.fullName}&apos;s details.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={person.id} />
          {!state.success && state.message && <FormErrorSummary message={state.message} />}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Full name"
              htmlFor="edit-fullName"
              required
              error={state.errors?.fullName?.[0]}
              className="sm:col-span-2"
            >
              <Input id="edit-fullName" name="fullName" defaultValue={person.fullName} required />
            </FormField>
            <FormField label="Job title" htmlFor="edit-jobTitle" error={state.errors?.jobTitle?.[0]}>
              <Input id="edit-jobTitle" name="jobTitle" defaultValue={person.jobTitle ?? ""} />
            </FormField>
            <FormField label="Company" htmlFor="edit-companyId" error={state.errors?.companyId?.[0]}>
              <NativeSelect id="edit-companyId" name="companyId" defaultValue={person.companyId ?? ""}>
                <option value="">No company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Email" htmlFor="edit-email" error={state.errors?.email?.[0]}>
              <Input id="edit-email" name="email" type="email" defaultValue={person.email ?? ""} />
            </FormField>
            <FormField label="Phone" htmlFor="edit-phone" error={state.errors?.phone?.[0]}>
              <Input id="edit-phone" name="phone" defaultValue={person.phone ?? ""} />
            </FormField>
            <FormField label="LinkedIn URL" htmlFor="edit-linkedinUrl" error={state.errors?.linkedinUrl?.[0]}>
              <Input id="edit-linkedinUrl" name="linkedinUrl" defaultValue={person.linkedinUrl ?? ""} />
            </FormField>
            <FormField label="Location" htmlFor="edit-location" error={state.errors?.location?.[0]}>
              <Input id="edit-location" name="location" defaultValue={person.location ?? ""} />
            </FormField>
            <FormField label="Department" htmlFor="edit-department" error={state.errors?.department?.[0]}>
              <Input id="edit-department" name="department" defaultValue={person.department ?? ""} />
            </FormField>
            <FormField label="Seniority" htmlFor="edit-seniority" error={state.errors?.seniority?.[0]}>
              <Input id="edit-seniority" name="seniority" defaultValue={person.seniority ?? ""} />
            </FormField>
            <FormField
              label="Other profile URL"
              htmlFor="edit-otherProfileUrl"
              error={state.errors?.otherProfileUrl?.[0]}
              className="sm:col-span-2"
            >
              <Input
                id="edit-otherProfileUrl"
                name="otherProfileUrl"
                defaultValue={person.otherProfileUrl ?? ""}
              />
            </FormField>
            <FormField label="Notes" htmlFor="edit-notes" className="sm:col-span-2" error={state.errors?.notes?.[0]}>
              <Textarea id="edit-notes" name="notes" rows={3} defaultValue={person.notes ?? ""} />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
