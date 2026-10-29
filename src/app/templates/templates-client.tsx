"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Copy, Pencil, Trash2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { templateSchema, type TemplateFormData } from "@/lib/validators";
import { TEMPLATE_CATEGORIES, TEMPLATE_VARIABLES } from "@/lib/constants";
import { createTemplate, updateTemplate, deleteTemplate, previewTemplate } from "@/server/actions/templates";
import { toast } from "@/components/ui/use-toast";
import type { MessageTemplate } from "@/lib/types";

function TemplateForm({ defaultValues, onSubmit, onCancel, isPending }: {
  defaultValues?: Partial<TemplateFormData>;
  onSubmit: (data: TemplateFormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: { category: "Cold email", ...defaultValues },
  });
  const body = watch("body", defaultValues?.body ?? "");

  const preview = previewTemplate(body, {
    name: "Alex Chen", company: "Acme Inc.", role: "Software Engineer", myBackground: "full-stack development",
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Template Name *</Label>
          <Input {...register("name")} className="mt-1" placeholder="My LinkedIn intro" />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <Label>Category</Label>
          <Select defaultValue={defaultValues?.category ?? "Cold email"} onValueChange={(v) => setValue("category", v as TemplateFormData["category"])}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{TEMPLATE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Subject (for emails)</Label>
          <Input {...register("subject")} className="mt-1" placeholder="Interested in [Role] at [Company]" />
        </div>
        <div className="col-span-2">
          <Label>Message Body *</Label>
          <Textarea {...register("body")} className="mt-1 h-40 font-mono text-sm" placeholder="Hi {{name}}, ..." />
          {errors.body && <p className="text-xs text-destructive mt-1">{errors.body.message}</p>}
          <div className="flex flex-wrap gap-1 mt-2">
            {TEMPLATE_VARIABLES.map(v => (
              <button key={v.token} type="button" title={v.description}
                className="text-xs px-2 py-0.5 rounded border bg-muted hover:bg-accent font-mono"
                onClick={() => { const el = document.activeElement as HTMLTextAreaElement; if (el?.tagName === "TEXTAREA") { const s = el.selectionStart; const before = el.value.slice(0, s); el.value = before + v.token + el.value.slice(el.selectionEnd ?? s); } }}>
                {v.token}
              </button>
            ))}
          </div>
        </div>
        {body && (
          <div className="col-span-2">
            <Label className="text-muted-foreground">Preview (with sample data)</Label>
            <pre className="mt-1 text-xs whitespace-pre-wrap bg-muted/50 rounded p-3 border font-sans text-muted-foreground max-h-40 overflow-y-auto">{preview}</pre>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Template
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TemplatesClient({ templates }: { templates: MessageTemplate[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<MessageTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<number | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [copied, setCopied] = React.useState<number | null>(null);

  const handleCreate = async (data: TemplateFormData) => {
    setIsPending(true);
    const result = await createTemplate(data);
    setIsPending(false);
    if (result.success) { toast({ title: "Template created", variant: "success" }); setCreateOpen(false); router.refresh(); }
    else toast({ title: "Error", description: result.error ?? result.message, variant: "destructive" });
  };

  const handleEdit = async (data: TemplateFormData) => {
    if (!editTarget) return;
    setIsPending(true);
    const result = await updateTemplate(editTarget.id, data);
    setIsPending(false);
    if (result.success) { toast({ title: "Template updated", variant: "success" }); setEditTarget(null); router.refresh(); }
    else toast({ title: "Error", description: result.error ?? result.message, variant: "destructive" });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deleteTemplate(deleteTarget);
    setIsDeleting(false);
    setDeleteTarget(null);
    if (result.success) { toast({ title: "Template deleted", variant: "success" }); router.refresh(); }
    else toast({ title: "Error", description: result.message, variant: "destructive" });
  };

  const handleCopy = (body: string, id: number) => {
    navigator.clipboard.writeText(body).then(() => {
      setCopied(id);
      toast({ title: "Copied to clipboard", variant: "success" });
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const grouped = templates.reduce<Record<string, MessageTemplate[]>>((acc, t) => {
    const arr = acc[t.category] ?? [];
    arr.push(t);
    acc[t.category] = arr;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Message Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Reusable outreach drafts with variable substitution</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" />New Template</Button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center border rounded-lg">
          <p className="text-muted-foreground text-sm mb-3">No templates yet.</p>
          <Button onClick={() => setCreateOpen(true)}>Create Template</Button>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{category}</h2>
            <div className="space-y-2">
              {items.map(t => (
                <Card key={t.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t.name}</span>
                          <Badge variant="outline" className="text-xs">{t.category}</Badge>
                        </div>
                        {t.subject && <p className="text-xs text-muted-foreground mt-0.5">Subject: {t.subject}</p>}
                        <pre className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground line-clamp-3 font-sans">{t.body.slice(0, 200)}{t.body.length > 200 ? "..." : ""}</pre>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleCopy(t.body, t.id)}>
                          {copied === t.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditTarget(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Template</DialogTitle></DialogHeader>
          <TemplateForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} isPending={isPending} />
        </DialogContent>
      </Dialog>

      {editTarget && (
        <Dialog open onOpenChange={() => setEditTarget(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Template</DialogTitle></DialogHeader>
            <TemplateForm
              defaultValues={{ name: editTarget.name, category: editTarget.category as TemplateFormData["category"], subject: editTarget.subject ?? "", body: editTarget.body }}
              onSubmit={handleEdit} onCancel={() => setEditTarget(null)} isPending={isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}
        title="Delete template?" description="This template will be permanently deleted."
        confirmLabel="Delete" onConfirm={handleDelete} isPending={isDeleting}
      />
    </div>
  );
}
