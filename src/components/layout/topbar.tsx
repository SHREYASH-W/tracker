"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, Plus, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ThemeToggle } from "../theme-toggle";

export function Topbar({ onMenuClick, onAddContact }: { onMenuClick: () => void; onAddContact: () => void }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/people?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people, companies, roles, emails..."
          className="pl-9"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Button onClick={onAddContact} size="sm">
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>
    </header>
  );
}
