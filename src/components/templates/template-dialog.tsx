"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { saveTemplateAction } from "@/lib/actions";
import { initialFormState } from "@/lib/action-types";
import { TEMPLATE_CATEGORIES, TEMPLATE_VARIABLES } from "@/lib/constants";
import type { MessageTemplate } from "@/lib/types";
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

export function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MessageTemplate;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(saveTemplateAction, initialFormState);

  React.useEffect(() => {
    if (!state.success) return;
    toast({
      title: template ? "Template updated" : "Template created",
      description: state.message,
      variant: "success",
    });
    router.refresh();
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            Use variables like <code className="rounded bg-muted px-1">{"{{name}}"}</code> and{" "}
            <code className="rounded bg-muted px-1">{"{{company}}"}</code>; they are filled in when you use
            the template.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {template && <input type="hidden" name="id" value={template.id} />}
          {!state.success && state.message && <FormErrorSummary message={state.message} />}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Template name" htmlFor="template-name" required error={state.errors?.name?.[0]}>
              <Input id="template-name" name="name" defaultValue={template?.name ?? ""} required />
            </FormField>
            <FormField label="Category" htmlFor="template-category" required error={state.errors?.category?.[0]}>
              <NativeSelect
                id="template-category"
                name="category"
                defaultValue={template?.category ?? TEMPLATE_CATEGORIES[0]}
              >
                {TEMPLATE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Subject"
              htmlFor="template-subject"
              error={state.errors?.subject?.[0]}
              hint="Optional, for email templates"
              className="sm:col-span-2"
            >
              <Input
                id="template-subject"
                name="subject"
                defaultValue={template?.subject ?? ""}
                placeholder="Following up on the {{role}} role"
              />
            </FormField>
            <FormField
              label="Message body"
              htmlFor="template-body"
              required
              error={state.errors?.body?.[0]}
              className="sm:col-span-2"
            >
              <Textarea
                id="template-body"
                name="body"
                rows={10}
                defaultValue={template?.body ?? ""}
                className="font-mono text-[13px] leading-relaxed"
                placeholder={"Hi {{name}},\n\n…"}
                required
              />
            </FormField>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Available variables</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {TEMPLATE_VARIABLES.map((variable) => (
                <li key={variable.token}>
                  <code className="rounded bg-background px-1 py-0.5">{variable.token}</code>{" "}
                  {variable.description}
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Saving…" : template ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
