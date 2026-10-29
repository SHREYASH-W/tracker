import Link from "next/link";
import { Plus } from "lucide-react";
import { getCompanies } from "@/server/actions/companies";
import { Button } from "@/components/ui/button";
import { CompanyInitials } from "@/components/person-avatar";
import { formatDate } from "@/lib/utils";
import { AddCompanyClient } from "./add-company-client";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await getCompanies();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{companies.length} companies in your network</p>
        </div>
        <AddCompanyClient />
      </div>

      {companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center border rounded-lg">
          <p className="text-muted-foreground text-sm mb-3">No companies yet. Add contacts to get started.</p>
          <AddCompanyClient label="Add Company" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Company</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Industry</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Location</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Contacts</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Active Outreach</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">Last Interaction</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(({ company, peopleCount, activeOutreachCount, lastInteractionAt }) => (
                <tr key={company.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${company.id}`} className="flex items-center gap-3 group">
                      <CompanyInitials name={company.name} size="md" />
                      <div>
                        <p className="font-medium group-hover:text-primary">{company.name}</p>
                        {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline">{company.website.replace(/^https?:\/\//, "")}</a>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{company.industry ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{company.location ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{peopleCount}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{activeOutreachCount}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">{formatDate(lastInteractionAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
