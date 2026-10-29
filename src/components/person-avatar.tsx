import { cn, getInitials } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-cyan-100 text-cyan-700",
  "bg-teal-100 text-teal-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

interface PersonAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = { sm: "h-7 w-7 text-xs", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" };

export function PersonAvatar({ name, size = "md", className }: PersonAvatarProps) {
  const color = getAvatarColor(name);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizeClasses[size],
        color,
        className,
      )}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

interface CompanyInitialsProps {
  name: string;
  size?: "sm" | "md";
  className?: string;
}

export function CompanyInitials({ name, size = "sm", className }: CompanyInitialsProps) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-secondary font-semibold text-secondary-foreground",
        size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm",
        className,
      )}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
