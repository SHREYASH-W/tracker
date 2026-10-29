"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { companySchema, type CompanyFormData } from "@/lib/validators";
import { updateCompany, deleteCompany } from "@/server/actions/companies";
import { toast } from "@/components/ui/use-toast";
import type { Company } from "@/lib/types";

export function EditCompanyClient({ company }: { company: Company }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company.name,
      website: company.website ?? "",
      industry: company.industry ?? "",
      location: company.location ?? "",
      linkedinUrl: company.linkedinUrl ?? "",
      size: company.size ?? "",
      notes: company.notes ?? "",
    },
  });

  const onSubmit = async (data: CompanyFormData) => {
    setIsPending(true);
    const result = await updateCompany(company.id, data);
    setIsPending(false);
    if (result.success) {
      toast({ title: "Company updated", variant: "success" });
      setOpen(false);
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error ?? result.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteCompany(company.id);
    setIsDeleting(false);
    if (result.success) {
      toast({ title: "Company deleted", variant: "success" });
      router.push("/companies");
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Company</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Company Name *</Label>
                <Input {...register("name")} className="mt-1" />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div><Label>Website</Label><Input {...register("website")} className="mt-1" /></div>
              <div><Label>Industry</Label><Input {...register("industry")} className="mt-1" /></div>
              <div><Label>Location</Label><Input {...register("location")} className="mt-1" /></div>
              <div><Label>Size</Label><Input {...register("size")} className="mt-1" /></div>
              <div className="col-span-2"><Label>LinkedIn URL</Label><Input {...register("linkedinUrl")} className="mt-1" /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea {...register("notes")} className="mt-1 h-20" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen} onOpenChange={setDeleteOpen}
        title="Delete this company?"
        description="Deleting a company will not delete the contacts associated with it — their company field will be cleared. This cannot be undone."
        confirmLabel="Delete Company"
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </>
  );
}
