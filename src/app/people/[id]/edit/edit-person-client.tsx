"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { editPersonSchema, type EditPersonFormData } from "@/lib/validators";
import { updatePerson } from "@/server/actions/people";
import { toast } from "@/components/ui/use-toast";
import type { Person, Company } from "@/lib/types";

export function EditPersonClient({ person, company, companies }: {
  person: Person; company: Company | null; companies: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<EditPersonFormData>({
    resolver: zodResolver(editPersonSchema),
    defaultValues: {
      fullName: person.fullName,
      jobTitle: person.jobTitle ?? "",
      department: person.department ?? "",
      seniority: person.seniority ?? "",
      email: person.email ?? "",
      phone: person.phone ?? "",
      linkedinUrl: person.linkedinUrl ?? "",
      otherProfileUrl: person.otherProfileUrl ?? "",
      location: person.location ?? "",
      notes: person.notes ?? "",
      companyId: person.companyId,
    },
  });

  const onSubmit = async (data: EditPersonFormData) => {
    setIsPending(true);
    const result = await updatePerson(person.id, data);
    setIsPending(false);
    if (result.success) {
      toast({ title: "Contact updated", variant: "success" });
      router.push(`/people/${person.id}`);
    } else {
      toast({ title: "Error", description: result.error ?? result.message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-4">
      <Link href={`/people/${person.id}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="h-4 w-4" />Back to profile
      </Link>
      <Card>
        <CardHeader><CardTitle>Edit Contact</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input {...register("fullName")} className="mt-1" />
                {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName.message}</p>}
              </div>
              <div>
                <Label>Job Title</Label>
                <Input {...register("jobTitle")} className="mt-1" />
              </div>
              <div>
                <Label>Department</Label>
                <Input {...register("department")} className="mt-1" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" {...register("email")} className="mt-1" />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label>Phone</Label>
                <Input {...register("phone")} className="mt-1" />
              </div>
              <div>
                <Label>LinkedIn URL</Label>
                <Input {...register("linkedinUrl")} className="mt-1" />
              </div>
              <div>
                <Label>Location</Label>
                <Input {...register("location")} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Company</Label>
                <Select defaultValue={String(person.companyId ?? "")} onValueChange={(v) => setValue("companyId", v ? Number(v) : null)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="No company" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No company</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea {...register("notes")} className="mt-1 h-24" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.push(`/people/${person.id}`)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
