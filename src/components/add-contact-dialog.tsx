"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { addContactSchema, type AddContactFormData } from "@/lib/validators";
import { PURPOSE_VALUES, CHANNEL_VALUES, STATUS_VALUES } from "@/lib/constants";
import { createPersonWithOutreach } from "@/server/actions/people";
import { checkDuplicates } from "@/server/actions/people";
import { toast } from "./ui/use-toast";
import { timestampToDateInput } from "@/lib/utils";

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompanyId?: number;
  defaultCompanyName?: string;
  onSuccess?: (personId: number) => void;
}

export function AddContactDialog({
  open, onOpenChange, defaultCompanyId, defaultCompanyName, onSuccess,
}: AddContactDialogProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [duplicateWarnings, setDuplicateWarnings] = React.useState<{ personName: string; matchField: string }[]>([]);
  const [forceSubmit, setForceSubmit] = React.useState(false);

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } =
    useForm<AddContactFormData>({
      resolver: zodResolver(addContactSchema),
      defaultValues: {
        status: "not_contacted",
        purpose: "Networking",
        companyId: defaultCompanyId,
        companyName: defaultCompanyName ?? "",
      },
    });

  React.useEffect(() => {
    if (open) {
      reset({
        status: "not_contacted",
        purpose: "Networking",
        companyId: defaultCompanyId,
        companyName: defaultCompanyName ?? "",
      });
      setDuplicateWarnings([]);
      setForceSubmit(false);
    }
  }, [open, defaultCompanyId, defaultCompanyName, reset]);

  const onSubmit = async (data: AddContactFormData) => {
    if (!forceSubmit) {
      const dups = await checkDuplicates(data.fullName, data.email, data.linkedinUrl);
      if (dups.length > 0) {
        setDuplicateWarnings(dups);
        return;
      }
    }

    setIsPending(true);
    try {
      const result = await createPersonWithOutreach(data);
      if (result.success && result.data) {
        toast({ title: "Contact created", variant: "success" });
        onOpenChange(false);
        onSuccess?.(result.data.personId);
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error ?? result.message, variant: "destructive" });
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>

        {duplicateWarnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3 text-sm">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">Possible duplicate detected</p>
                {duplicateWarnings.map((w, i) => (
                  <p key={i} className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                    {w.personName} matched by {w.matchField}
                  </p>
                ))}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDuplicateWarnings([])}>Go back</Button>
                  <Button size="sm" variant="default" onClick={() => { setForceSubmit(true); handleSubmit(onSubmit)(); }}>
                    Add anyway
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
          <Tabs defaultValue="person">
            <TabsList className="mb-4">
              <TabsTrigger value="person">Personal Info</TabsTrigger>
              <TabsTrigger value="company">Company</TabsTrigger>
              <TabsTrigger value="outreach">Outreach</TabsTrigger>
            </TabsList>

            {/* Personal info */}
            <TabsContent value="person" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input id="fullName" {...register("fullName")} placeholder="Jane Smith" className="mt-1" />
                  {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName.message}</p>}
                </div>
                <div>
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input id="jobTitle" {...register("jobTitle")} placeholder="Software Engineer" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" {...register("department")} placeholder="Engineering" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register("email")} placeholder="jane@example.com" className="mt-1" />
                  {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" {...register("phone")} placeholder="+1 555 0100" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                  <Input id="linkedinUrl" {...register("linkedinUrl")} placeholder="https://linkedin.com/in/..." className="mt-1" />
                  {errors.linkedinUrl && <p className="mt-1 text-xs text-destructive">{errors.linkedinUrl.message}</p>}
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" {...register("location")} placeholder="San Francisco, CA" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" {...register("notes")} placeholder="Any additional notes..." className="mt-1 h-20" />
                </div>
              </div>
            </TabsContent>

            {/* Company */}
            <TabsContent value="company" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input id="companyName" {...register("companyName")} placeholder="Acme Inc." className="mt-1" />
                  {errors.companyName && <p className="mt-1 text-xs text-destructive">{errors.companyName.message}</p>}
                </div>
                <div>
                  <Label htmlFor="companyWebsite">Website</Label>
                  <Input id="companyWebsite" {...register("companyWebsite")} placeholder="https://acme.com" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="companyIndustry">Industry</Label>
                  <Input id="companyIndustry" {...register("companyIndustry")} placeholder="Technology" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="companyLocation">Company Location</Label>
                  <Input id="companyLocation" {...register("companyLocation")} placeholder="New York, NY" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="companySize">Company Size</Label>
                  <Input id="companySize" {...register("companySize")} placeholder="50-200" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="companyLinkedinUrl">Company LinkedIn</Label>
                  <Input id="companyLinkedinUrl" {...register("companyLinkedinUrl")} placeholder="https://linkedin.com/company/..." className="mt-1" />
                </div>
              </div>
            </TabsContent>

            {/* Outreach */}
            <TabsContent value="outreach" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="purpose">Purpose *</Label>
                  <Select defaultValue="Networking" onValueChange={(v) => setValue("purpose", v as AddContactFormData["purpose"])}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PURPOSE_VALUES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="channel">Channel</Label>
                  <Select onValueChange={(v) => setValue("channel", v as AddContactFormData["channel"])}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNEL_VALUES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select defaultValue="not_contacted" onValueChange={(v) => setValue("status", v as AddContactFormData["status"])}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_VALUES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="targetRole">Target Role</Label>
                  <Input id="targetRole" {...register("targetRole")} placeholder="Software Engineer" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="firstContactedAt">First Contacted</Label>
                  <Input id="firstContactedAt" type="date" {...register("firstContactedAt")} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="nextFollowUpAt">Next Follow-up</Label>
                  <Input id="nextFollowUpAt" type="date" {...register("nextFollowUpAt")} className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="outreachNotes">Outreach Notes</Label>
                  <Textarea id="outreachNotes" {...register("outreachNotes")} placeholder="Notes about this outreach..." className="mt-1 h-20" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="opportunityTitle">Opportunity Title (optional)</Label>
                  <Input id="opportunityTitle" {...register("opportunityTitle")} placeholder="Senior Engineer — Backend Platform" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="jobPostingUrl">Job Posting URL</Label>
                  <Input id="jobPostingUrl" {...register("jobPostingUrl")} placeholder="https://jobs.example.com/..." className="mt-1" />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? "Saving..." : "Add Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
