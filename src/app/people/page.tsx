import { Suspense } from "react";
import { getPeopleDirectory, getDirectorySummary } from "@/server/actions/people";
import { getCompanies } from "@/server/actions/companies";
import { PeopleDirectoryClient } from "./people-directory-client";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  companyId?: string;
  role?: string;
  followUp?: string;
  sortBy?: string;
  sortDir?: string;
  page?: string;
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);

  const [directoryResult, summary, companies] = await Promise.all([
    getPeopleDirectory({
      search: sp.q,
      status: sp.status,
      companyId: sp.companyId ? Number(sp.companyId) : undefined,
      role: sp.role,
      followUp: sp.followUp as "overdue" | "today" | "upcoming" | "none" | "all" | undefined,
      sortBy: sp.sortBy as "name" | "company" | "last_contacted" | "next_follow_up" | "status" | "created" | undefined,
      sortDir: sp.sortDir as "asc" | "desc" | undefined,
      page,
      pageSize: 50,
    }),
    getDirectorySummary(),
    getCompanies(),
  ]);

  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <PeopleDirectoryClient
        initialData={directoryResult}
        summary={summary}
        companies={companies.map((c) => ({ id: c.company.id, name: c.company.name }))}
        initialFilters={sp as Record<string, string | undefined>}
      />
    </Suspense>
  );
}
