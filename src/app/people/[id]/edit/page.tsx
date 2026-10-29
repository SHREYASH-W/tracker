import { notFound } from "next/navigation";
import { getPersonWithDetails } from "@/server/actions/people";
import { getCompanies } from "@/server/actions/companies";
import { EditPersonClient } from "./edit-person-client";

export const dynamic = "force-dynamic";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  if (isNaN(personId)) notFound();

  const [data, companiesData] = await Promise.all([
    getPersonWithDetails(personId),
    getCompanies(),
  ]);
  if (!data) notFound();

  return <EditPersonClient
    person={data.person}
    company={data.company}
    companies={companiesData.map(c => ({ id: c.company.id, name: c.company.name }))}
  />;
}
