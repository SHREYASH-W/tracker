"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Bell,
  Activity,
  MessageSquare,
  Settings,
  Target,
  UserSearch,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search-profiles", label: "Search Profiles", icon: Target },
  { href: "/people", label: "People Directory", icon: Users },
  { href: "/find-hr", label: "Find HR Contacts", icon: UserSearch },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/follow-ups", label: "Follow-ups", icon: Bell },
  { href: "/activity", label: "Activity Timeline", icon: Activity },
  { href: "/templates", label: "Message Templates", icon: MessageSquare },
  { href: "/settings", label: "Settings & Data", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Users className="h-4 w-4" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Contact CRM</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3 text-xs text-muted-foreground">
        <p>Your data stays on this device.</p>
      </div>
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full">
        <div className="relative h-full">
          <Sidebar onNavigate={onClose} />
          <button
            onClick={onClose}
            className="absolute -right-10 top-3 rounded-md bg-background p-2 shadow-md"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
