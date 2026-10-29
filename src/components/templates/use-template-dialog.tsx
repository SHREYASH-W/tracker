"use client";

import * as React from "react";
import { Copy, Mail } from "lucide-react";
import { TEMPLATE_VARIABLES } from "@/lib/constants";
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
import { FormField } from "../ui/form-field";
import { Input } from "../ui/input";
import { useToast } from "../ui/use-toast";

const PLACEHOLDERS: Record<string, string> = {
  "{{name}}": "[Name]",
  "{{company}}": "[Company]",
  "{{role}}": "[Role]",
  "{{my_background}}": "[Your background]",
};

export function UseTemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: MessageTemplate;
}) {
  const { toast } = useToast();
  const [values, setValues] = React.useState<Record<string, string>>({});

  function setValue(token: string, value: string) {
    setValues((prev) => ({ ...prev, [token]: value }));
  }

  function render(text: string): string {
    return TEMPLATE_VARIABLES.reduce((result, variable) => {
      const value = values[variable.token]?.trim();
      return result.split(variable.token).join(value || PLACEHOLDERS[variable.token] || "");
    }, text);
  }

  const subject = render(template.subject ?? "");
  const body = render(template.body);

  async function copyMessage() {
    const text = subject ? `Subject: ${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Message copied", description: "Paste it into LinkedIn, email, or anywhere else.", variant: "success" });
    } catch {
      toast({ title: "Could not copy", description: "Your browser blocked clipboard access.", variant: "destructive" });
    }
  }

  function openInEmail() {
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Use template</DialogTitle>
          <DialogDescription>{template.name}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATE_VARIABLES.map((variable) => (
            <FormField key={variable.token} label={variable.description} htmlFor={`var-${variable.token}`}>
              <Input
                id={`var-${variable.token}`}
                value={values[variable.token] ?? ""}
                onChange={(event) => setValue(variable.token, event.target.value)}
                placeholder={PLACEHOLDERS[variable.token]?.replace(/[[\]]/g, "")}
              />
            </FormField>
          ))}
        </div>

        <div className="space-y-2">
          {subject && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Subject</p>
              <p className="text-sm">{subject}</p>
            </div>
          )}
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Message</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {subject && (
            <Button type="button" variant="outline" onClick={openInEmail}>
              <Mail className="h-4 w-4" />
              Open in email
            </Button>
          )}
          <Button type="button" onClick={copyMessage}>
            <Copy className="h-4 w-4" />
            Copy message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
