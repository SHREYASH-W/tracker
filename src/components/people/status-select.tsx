"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateOutreachStatusAction } from "@/lib/actions";
import { STATUS_LIST, getStatusDef } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "../ui/use-toast";

export function StatusSelect({
  outreachId,
  status,
  className,
}: {
  outreachId: number;
  status: string;
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = React.useState(status);
  const [pending, setPending] = React.useState(false);
  const def = getStatusDef(value);

  React.useEffect(() => {
    setValue(status);
  }, [status]);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    const previous = value;
    setValue(next);
    setPending(true);
    try {
      const result = await updateOutreachStatusAction(outreachId, next);
      if (result.success) {
        toast({ title: "Status updated", description: result.message, variant: "success" });
        router.refresh();
      } else {
        setValue(previous);
        toast({ title: "Could not update status", description: result.message, variant: "destructive" });
      }
    } catch {
      setValue(previous);
      toast({ title: "Could not update status", description: "Please try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      aria-label="Outreach status"
      value={value}
      onChange={handleChange}
      disabled={pending}
      className={cn(
        "h-7 max-w-[180px] cursor-pointer rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60",
        def.badgeClass,
        className,
      )}
    >
      {STATUS_LIST.map((option) => (
        <option key={option.value} value={option.value} className="bg-background text-foreground">
          {option.label}
        </option>
      ))}
    </select>
  );
}
