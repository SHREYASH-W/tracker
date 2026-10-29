"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { companySchema, type CompanyFormData } from "@/lib/validators";
import { createCompany } from "@/server/actions/companies";
import { toast } from "@/components/ui/use-toast";

export function AddCompanyClient({ label }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
  });

  const onSubmit = async (data: CompanyFormData) => {
    setIsPending(true);
    const result = await createCompany(data);
    setIsPending(false);
    if (result.success) {
      toast({ title: "Company created", variant: "success" });
      reset();
      setOpen(false);
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error ?? result.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />{label ?? "Add Company"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Company</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Company Name *</Label>
                <Input {...register("name")} className="mt-1" placeholder="Acme Inc." />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label>Website</Label>
                <Input {...register("website")} className="mt-1" placeholder="https://acme.com" />
              </div>
              <div>
                <Label>Industry</Label>
                <Input {...register("industry")} className="mt-1" placeholder="Technology" />
              </div>
              <div>
                <Label>Location</Label>
                <Input {...register("location")} className="mt-1" placeholder="San Francisco, CA" />
              </div>
              <div>
                <Label>Company Size</Label>
                <Input {...register("size")} className="mt-1" placeholder="50-200" />
              </div>
              <div className="col-span-2">
                <Label>LinkedIn URL</Label>
                <Input {...register("linkedinUrl")} className="mt-1" placeholder="https://linkedin.com/company/..." />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea {...register("notes")} className="mt-1 h-20" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Company
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
