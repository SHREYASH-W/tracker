"use client";

import * as React from "react";
import { Copy, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { deleteTemplateAction } from "@/lib/actions";
import type { MessageTemplate } from "@/lib/types";
import { ConfirmDialog } from "../confirm-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useToast } from "../ui/use-toast";
import { TemplateDialog } from "./template-dialog";
import { UseTemplateDialog } from "./use-template-dialog";

export function TemplateCard({ template }: { template: MessageTemplate }) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = React.useState(false);
  const [useOpen, setUseOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  async function copyRaw() {
    try {
      await navigator.clipboard.writeText(template.body);
      toast({ title: "Template copied", description: "Variables were left as placeholders.", variant: "success" });
    } catch {
      toast({ title: "Could not copy", description: "Your browser blocked clipboard access.", variant: "destructive" });
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{template.name}</p>
          <Badge variant="secondary" className="mt-1 text-[10px]">
            {template.category}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${template.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setUseOpen(true)}>
              <Play className="h-4 w-4" />
              Use template
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
      </div>

      {template.subject && (
        <p className="text-xs font-medium text-muted-foreground">Subject: {template.subject}</p>
      )}
      <p className="line-clamp-5 whitespace-pre-wrap text-sm text-muted-foreground">{template.body}</p>

      <div className="mt-auto flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="flex-1" onClick={copyRaw}>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
        <Button size="sm" className="flex-1" onClick={() => setUseOpen(true)}>
          <Play className="h-3.5 w-3.5" />
          Use template
        </Button>
      </div>

      <TemplateDialog open={editOpen} onOpenChange={setEditOpen} template={template} />
      <UseTemplateDialog open={useOpen} onOpenChange={setUseOpen} template={template} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${template.name}"?`}
        description="This removes the template permanently. Messages you already sent are not affected."
        confirmLabel="Delete template"
        onConfirm={() => deleteTemplateAction(template.id)}
      />
    </div>
  );
}

export function AddTemplateButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New template
      </Button>
      <TemplateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
