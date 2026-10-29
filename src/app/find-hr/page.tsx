import Link from "next/link";
import { UserSearch, Users } from "lucide-react";
import { HrFinder } from "@/components/hr/hr-finder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Find HR Contacts" };

export default async function FindHrPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const params = await searchParams;
  const initialDomain = typeof params.domain === "string" ? params.domain : "";

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Find HR contacts</h1>
            <Badge variant="outline" className="gap-1">
              <UserSearch className="h-3 w-3" />
              Hunter
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Search a company&apos;s domain for HR and recruiting contacts, then add them to your CRM with
            the role you want to ask about. Their email addresses come from public sources.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/people">
            <Users className="h-4 w-4" />
            People directory
          </Link>
        </Button>
      </div>

      <HrFinder initialDomain={initialDomain} />
    </div>
  );
}
