"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddContactDialog } from "@/components/add-contact-dialog";

export function AddContactToCompanyClient({ companyId, companyName }: { companyId: number; companyName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />Add Contact
      </Button>
      <AddContactDialog
        open={open}
        onOpenChange={setOpen}
        defaultCompanyId={companyId}
        defaultCompanyName={companyName}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
