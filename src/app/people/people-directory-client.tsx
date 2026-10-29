"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus, Upload, Download, Search, X, ChevronUp, ChevronDown,
  Filter, MoreHorizontal, Pencil, Trash2, Eye, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/status-badge";
import { PersonAvatar, CompanyInitials } from "@/components/person-avatar";
import { AddContactDialog } from "@/components/add-contact-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/use-toast";
import { formatDate, isOverdue, isDueToday, formatRelative } from "@/lib/utils";
import { STATUS_VALUES, PURPOSE_VALUES } from "@/lib/constants";
import { deletePerson } from "@/server/actions/people";
import { exportPeopleCsv } from "@/server/actions/import-export";
import type { PeopleDirectoryResult } from "@/server/actions/people";

interface Props {
  initialData: PeopleDirectoryResult;
  summary: { total: number; notContacted: number; messaged: number; awaiting: number; followupDue: number; positive: number };
  companies: { id: number; name: string }[];
  initialFilters: Record<string, string | undefined>;
}

export function PeopleDirectoryClient({ initialData, summary, companies, initialFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [addOpen, setAddOpen] = React.useState(false);
  const [search, setSearch] = React.useState(initialFilters.q ?? "");
  const [status, setStatus] = React.useState(initialFilters.status ?? "all");
  const [companyId, setCompanyId] = React.useState(initialFilters.companyId ?? "all");
  const [followUp, setFollowUp] = React.useState(initialFilters.followUp ?? "all");
  const [sortBy, setSortBy] = React.useState(initialFilters.sortBy ?? "name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">((initialFilters.sortDir as "asc" | "desc") ?? "asc");
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<number | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const { rows, total, page, totalPages } = initialData;

  const pushFilters = React.useCallback((overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const curr = { q: search, status, companyId, followUp, sortBy, sortDir: sortDir, ...overrides };
    if (curr.q) params.set("q", curr.q);
    if (curr.status && curr.status !== "all") params.set("status", curr.status);
    if (curr.companyId && curr.companyId !== "all") params.set("companyId", curr.companyId);
    if (curr.followUp && curr.followUp !== "all") params.set("followUp", curr.followUp);
    if (curr.sortBy && curr.sortBy !== "name") params.set("sortBy", curr.sortBy);
    if (curr.sortDir && curr.sortDir !== "asc") params.set("sortDir", curr.sortDir);
    router.push(`${pathname}?${params.toString()}`);
  }, [search, status, companyId, followUp, sortBy, sortDir, router, pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    pushFilters({ q: search, page: undefined });
  };

  const handleSort = (col: string) => {
    const newDir = sortBy === col && sortDir === "asc" ? "desc" : "asc";
    setSortBy(col); setSortDir(newDir);
    pushFilters({ sortBy: col, sortDir: newDir });
  };

  const clearFilters = () => {
    setSearch(""); setStatus("all"); setCompanyId("all"); setFollowUp("all");
    setSortBy("name"); setSortDir("asc");
    router.push(pathname);
  };

  const hasFilters = !!(search || (status && status !== "all") || (companyId && companyId !== "all") || (followUp && followUp !== "all"));

  const toggleRow = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.person.id)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deletePerson(deleteTarget);
    setIsDeleting(false);
    setDeleteTarget(null);
    if (result.success) {
      toast({ title: "Contact deleted", variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const handleExport = async () => {
    const ids = selected.size > 0 ? Array.from(selected) : undefined;
    const csv = await exportPeopleCsv(ids);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `contacts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span className="inline-flex flex-col ml-1 opacity-50">
      {sortBy === col ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
    </span>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">People Directory</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your professional network and track every conversation.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href="/people/import"><Upload className="h-4 w-4 mr-1.5" />Import CSV</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" />Export CSV
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Add Contact
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
          <span><strong className="text-foreground">{summary.total}</strong> total</span>
          <span><strong className="text-foreground">{summary.notContacted}</strong> not contacted</span>
          <span><strong className="text-foreground">{summary.messaged}</strong> messaged</span>
          <span><strong className="text-foreground">{summary.awaiting}</strong> awaiting reply</span>
          <span className={summary.followupDue > 0 ? "text-orange-600 font-medium" : ""}>
            <strong>{summary.followupDue}</strong> follow-ups due
          </span>
          <span className="text-green-600"><strong>{summary.positive}</strong> positive outcomes</span>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3 flex flex-wrap gap-2 items-center bg-muted/30">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people, companies, roles, emails..."
            className="pl-8 h-8 w-72 text-sm"
          />
        </form>

        <Select value={status} onValueChange={(v) => { setStatus(v); pushFilters({ status: v }); }}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={companyId} onValueChange={(v) => { setCompanyId(v); pushFilters({ companyId: v }); }}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={followUp} onValueChange={(v) => { setFollowUp(v); pushFilters({ followUp: v }); }}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Follow-ups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All follow-ups</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="today">Due Today</SelectItem>
            <SelectItem value="upcoming">Due Soon</SelectItem>
            <SelectItem value="none">None Scheduled</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
            <X className="h-3.5 w-3.5 mr-1" />Clear filters
          </Button>
        )}

        {selected.size > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {selected.size} selected —{" "}
            <button className="text-primary underline" onClick={handleExport}>Export selected</button>
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-muted-foreground text-sm mb-4">
              {hasFilters ? "No contacts match your filters." : "No contacts yet."}
            </div>
            {!hasFilters && (
              <div className="flex gap-2">
                <Button onClick={() => setAddOpen(true)}>Add Your First Contact</Button>
                <Button variant="outline" asChild><Link href="/people/import">Import Contacts</Link></Button>
              </div>
            )}
            {hasFilters && <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>}
          </div>
        ) : (
          <table className="w-full text-sm sticky-header">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 pl-4 py-2.5">
                  <Checkbox checked={selected.size === rows.length && rows.length > 0} onCheckedChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort("name")}>
                  Name <SortIcon col="name" />
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort("company")}>
                  Company <SortIcon col="company" />
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Role</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Contact</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort("status")}>
                  Status <SortIcon col="status" />
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell cursor-pointer hover:text-foreground" onClick={() => handleSort("last_contacted")}>
                  Last Contact <SortIcon col="last_contacted" />
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden xl:table-cell cursor-pointer hover:text-foreground" onClick={() => handleSort("next_follow_up")}>
                  Follow-up <SortIcon col="next_follow_up" />
                </th>
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, company, primaryOutreach }) => {
                const isOverdueFollowUp = isOverdue(primaryOutreach?.nextFollowUpAt);
                const isTodayFollowUp = isDueToday(primaryOutreach?.nextFollowUpAt);
                return (
                  <tr key={person.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="pl-4 py-2.5">
                      <Checkbox checked={selected.has(person.id)} onCheckedChange={() => toggleRow(person.id)} aria-label={`Select ${person.fullName}`} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/people/${person.id}`} className="flex items-center gap-2.5 group">
                        <PersonAvatar name={person.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium truncate group-hover:text-primary">{person.fullName}</p>
                          {person.jobTitle && <p className="text-xs text-muted-foreground truncate">{person.jobTitle}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {company ? (
                        <Link href={`/companies/${company.id}`} className="flex items-center gap-2 hover:text-primary">
                          <CompanyInitials name={company.name} />
                          <span className="truncate max-w-[120px]">{company.name}</span>
                        </Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <span className="text-muted-foreground truncate max-w-[140px] block">
                        {primaryOutreach?.targetRole ?? person.jobTitle ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {person.email ?? person.linkedinUrl ? (
                          person.email ? (
                            <a href={`mailto:${person.email}`} className="hover:underline">{person.email}</a>
                          ) : (
                            <a href={person.linkedinUrl!} target="_blank" rel="noopener noreferrer" className="hover:underline">LinkedIn</a>
                          )
                        ) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={primaryOutreach?.status ?? "not_contacted"} />
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                      {formatDate(primaryOutreach?.lastContactedAt)}
                    </td>
                    <td className="px-3 py-2.5 hidden xl:table-cell">
                      {primaryOutreach?.nextFollowUpAt ? (
                        <span className={`text-xs font-medium ${isOverdueFollowUp ? "text-destructive" : isTodayFollowUp ? "text-amber-600" : "text-muted-foreground"}`}>
                          {formatRelative(primaryOutreach.nextFollowUpAt)}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/people/${person.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(person.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t px-6 py-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{total} contacts · page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => pushFilters({ page: String(page - 1) })}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => pushFilters({ page: String(page + 1) })}>Next</Button>
          </div>
        </div>
      )}

      <AddContactDialog open={addOpen} onOpenChange={setAddOpen} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete contact?"
        description="This will permanently delete the contact, all their outreach records, and interaction history. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </div>
  );
}
