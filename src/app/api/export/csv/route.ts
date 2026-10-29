import { getAllOutreachRecords, getPeople } from "@/lib/queries";
import { timestampToDateInput, toCsv } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const people = getPeople({ sort: "name" });
  const outreach = getAllOutreachRecords();
  const outreachByPerson = new Map<number, typeof outreach>();
  for (const record of outreach) {
    const list = outreachByPerson.get(record.personId) ?? [];
    list.push(record);
    outreachByPerson.set(record.personId, list);
  }

  const rows: (string | number | null)[][] = [
    [
      "Full Name",
      "Email",
      "Phone",
      "Job Title",
      "Department",
      "Seniority",
      "Company",
      "Industry",
      "Location",
      "LinkedIn URL",
      "Person Notes",
      "Purpose",
      "Channel",
      "Target Role",
      "Status",
      "First Contacted",
      "Last Contacted",
      "Last Response",
      "Next Follow-up",
      "Outreach Notes",
    ],
  ];

  for (const { person, company } of people) {
    const records = outreachByPerson.get(person.id) ?? [];
    const base: (string | number | null)[] = [
      person.fullName,
      person.email,
      person.phone,
      person.jobTitle,
      person.department,
      person.seniority,
      company?.name ?? "",
      company?.industry ?? "",
      person.location ?? company?.location ?? "",
      person.linkedinUrl,
      person.notes,
    ];

    if (records.length === 0) {
      rows.push([...base, "", "", "", "", "", "", "", "", ""]);
      continue;
    }

    for (const record of records) {
      rows.push([
        ...base,
        record.purpose,
        record.channel,
        record.targetRole,
        record.status,
        timestampToDateInput(record.firstContactedAt),
        timestampToDateInput(record.lastContactedAt),
        timestampToDateInput(record.lastResponseAt),
        timestampToDateInput(record.nextFollowUpAt),
        record.notes,
      ]);
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response("\uFEFF" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contact-crm-export-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
