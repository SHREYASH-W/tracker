import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPersonWithDetails } from "@/server/actions/people";
import { PersonProfileClient } from "./person-profile-client";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  if (isNaN(personId)) notFound();

  const data = await getPersonWithDetails(personId);
  if (!data) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-4">
      <Link href="/people" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="h-4 w-4" /> Back to People Directory
      </Link>
      <PersonProfileClient data={data} />
    </div>
  );
}
