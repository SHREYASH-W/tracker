"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { saveCompanyAction } from "@/lib/actions";
import { initialFormState } from "@/lib/action-types";
import type { Company } from "@/lib/types";
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
import { Textarea } from "../ui/textarea";
import { useToast } from "../ui/use-toast";

export function CompanyDialog({
  open,
  onOpenChange,
  company,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(saveCompanyAction, initialFormState);

  React.useEffect(() => {
    if (!state.success) return;
    toast({
      title: company ? "Company updated" : "Company added",
      description: state.message,
      variant: "success",
    });
    router.refresh();
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{company ? "Edit company" : "Add company"}</DialogTitle>
          <DialogDescription>
            {company ? `Update details for ${company.name}.` : "Create a company to group contacts and opportunities."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {company && <input type="hidden" name="id" value={company.id} />}
          {!state.success && state.message && <FormErrorSummary message={state.message} />}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Company name"
              htmlFor="company-name"
              required
              error={state.errors?.name?.[0]}
              className="sm:col-span-2"
            >
              <Input id="company-name" name="name" defaultValue={company?.name ?? ""} required />
            </FormField>
            <FormField label="Website" htmlFor="company-website" error={state.errors?.website?.[0]}>
              <Input id="company-website" name="website" defaultValue={company?.website ?? ""} placeholder="acme.com" />
            </FormField>
            <FormField label="Industry" htmlFor="company-industry" error={state.errors?.industry?.[0]}>
              <Input id="company-industry" name="industry" defaultValue={company?.industry ?? ""} />
            </FormField>
            <FormField label="Location" htmlFor="company-location" error={state.errors?.location?.[0]}>
              <Input id="company-location" name="location" defaultValue={company?.location ?? ""} />
            </FormField>
            <FormField label="Size" htmlFor="company-size" error={state.errors?.size?.[0]}>
              <Input id="company-size" name="size" defaultValue={company?.size ?? ""} placeholder="50–200" />
            </FormField>
            <FormField
              label="LinkedIn URL"
              htmlFor="company-linkedinUrl"
              error={state.errors?.linkedinUrl?.[0]}
              className="sm:col-span-2"
            >
              <Input
                id="company-linkedinUrl"
                name="linkedinUrl"
                defaultValue={company?.linkedinUrl ?? ""}
                placeholder="linkedin.com/company/acme"
              />
            </FormField>
            <FormField
              label="Notes"
              htmlFor="company-notes"
              error={state.errors?.notes?.[0]}
              className="sm:col-span-2"
            >
              <Textarea id="company-notes" name="notes" rows={3} defaultValue={company?.notes ?? ""} />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Saving…" : company ? "Save changes" : "Add company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
