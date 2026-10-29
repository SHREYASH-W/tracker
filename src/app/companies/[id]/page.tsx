import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Linkedin, MapPin, Pencil } from "lucide-react";
import { getCompany } from "@/server/actions/companies";
import { getPeopleDirectory } from "@/server/actions/people";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { PersonAvatar } from "@/components/person-avatar";
import { formatDate } from "@/lib/utils";
import { EditCompanyClient } from "./edit-company-client";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  if (isNaN(companyId)) notFound();

  const [company, peopleResult] = await Promise.all([
    getCompany(companyId),
    getPeopleDirectory({ companyId, pageSize: 100 }),
  ]);
  if (!company) notFound();

  const people = peopleResult.rows;

  return (
    <div className="max-w-4xl mx-auto px-6 py-4 space-y-4">
      <Link href="/companies" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="h-4 w-4" />Back to Companies
      </Link>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center text-xl font-bold text-secondary-foreground">
                {company.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-semibold">{company.name}</h1>
                {company.industry && <p className="text-muted-foreground">{company.industry}</p>}
                <div className="flex flex-wrap gap-3 mt-2">
                  {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Globe className="h-3.5 w-3.5" />{company.website.replace(/^https?:\/\//, "")}</a>}
                  {company.linkedinUrl && <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><Linkedin className="h-3.5 w-3.5" />LinkedIn</a>}
                  {company.location && <span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{company.location}</span>}
                  {company.size && <span className="text-sm text-muted-foreground">{company.size} employees</span>}
                </div>
              </div>
            </div>
            <EditCompanyClient company={company} />
          </div>
          {company.notes && <p className="mt-4 text-sm text-muted-foreground bg-muted/50 rounded p-3">{company.notes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Contacts at {company.name} ({people.length})</CardTitle>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/people?companyId=${companyId}`}>View all in directory</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No contacts at this company yet.</p>
          ) : (
            <div className="space-y-2">
              {people.map(({ person, primaryOutreach }) => (
                <Link key={person.id} href={`/people/${person.id}`} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted transition-colors">
                  <PersonAvatar name={person.fullName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{person.fullName}</p>
                    <p className="text-xs text-muted-foreground">{person.jobTitle ?? "—"}</p>
                  </div>
                  <StatusBadge status={primaryOutreach?.status ?? "not_contacted"} />
                  {primaryOutreach?.lastContactedAt && (
                    <span className="text-xs text-muted-foreground hidden md:block">{formatDate(primaryOutreach.lastContactedAt)}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
