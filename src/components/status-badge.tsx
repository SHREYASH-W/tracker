import { cn } from "@/lib/utils";
import { getStatusDef } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const def = getStatusDef(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        def.badgeClass,
        className,
      )}
    >
      {showDot && <span className={cn("h-1.5 w-1.5 rounded-full", def.dotClass)} />}
      {def.label}
    </span>
  );
}
