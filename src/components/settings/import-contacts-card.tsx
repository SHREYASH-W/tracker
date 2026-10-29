"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { importContactsAction } from "@/lib/actions";
import type { CsvImportRow, ImportSummary } from "@/lib/action-types";
import { parseCsv, toCsv } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { useToast } from "../ui/use-toast";

type FieldKey = keyof CsvImportRow;

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  fullName: ["full_name", "fullname", "name", "contact_name", "contact"],
  email: ["email", "email_address"],
  phone: ["phone", "phone_number", "mobile", "mobile_number"],
  jobTitle: ["job_title", "jobtitle", "title", "role", "position"],
  companyName: ["company", "company_name", "companyname", "organization", "organisation"],
  linkedinUrl: ["linkedin", "linkedin_url", "linkedinurl", "linkedin_profile"],
  location: ["location", "city", "country"],
  purpose: ["purpose", "outreach_purpose"],
  notes: ["notes", "note", "comments"],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ParsedRow {
  rowNumber: number;
  data: CsvImportRow;
  issues: string[];
  valid: boolean;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function ImportContactsCard() {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = React.useTransition();
  const [fileName, setFileName] = React.useState("");
  const [parsed, setParsed] = React.useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setSummary(null);
    setParseError(null);
    setParsed(null);
    setFileName(file.name);

    if (file.size > 5 * 1024 * 1024) {
      setParseError("The file is larger than 5 MB. Split it into smaller files.");
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        setParseError("The file needs a header row and at least one contact row.");
        return;
      }

      const headers = rows[0]!.map(normalizeHeader);
      const indexes = new Map<FieldKey, number>();
      for (const field of Object.keys(FIELD_ALIASES) as FieldKey[]) {
        const index = headers.findIndex((header) => FIELD_ALIASES[field].includes(header));
        if (index >= 0) indexes.set(field, index);
      }

      const missing = (["fullName", "companyName"] as FieldKey[]).filter((field) => !indexes.has(field));
      if (missing.length > 0) {
        setParseError(
          "Missing required column(s): " +
            missing.map((field) => (field === "fullName" ? "full name" : "company name")).join(", ") +
            ". Download the sample CSV to see the expected format.",
        );
        return;
      }

      const value = (cells: string[], field: FieldKey): string => {
        const index = indexes.get(field);
        return index === undefined ? "" : (cells[index] ?? "").trim();
      };

      const parsedRows: ParsedRow[] = rows.slice(1).map((cells, index) => {
        const fullName = value(cells, "fullName");
        const companyName = value(cells, "companyName");
        const email = value(cells, "email");
        const issues: string[] = [];

        if (!fullName) issues.push("Missing full name");
        if (!companyName) issues.push("Missing company name");
        if (email && !EMAIL_RE.test(email)) issues.push("Invalid email address");

        return {
          rowNumber: index + 2,
          issues,
          valid: issues.length === 0,
          data: {
            fullName,
            companyName,
            email: email || undefined,
            phone: value(cells, "phone") || undefined,
            jobTitle: value(cells, "jobTitle") || undefined,
            linkedinUrl: value(cells, "linkedinUrl") || undefined,
            location: value(cells, "location") || undefined,
            purpose: value(cells, "purpose") || undefined,
            notes: value(cells, "notes") || undefined,
          },
        };
      });

      if (parsedRows.length === 0) {
        setParseError("No contact rows were found in the file.");
        return;
      }

      setParsed(parsedRows);
    } catch {
      setParseError("Could not read that file. Make sure it is a valid CSV.");
    }
  }

  function clearFile() {
    setParsed(null);
    setParseError(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function runImport() {
    if (!parsed) return;
    const validRows = parsed.filter((row) => row.valid).map((row) => row.data);
    if (validRows.length === 0) return;

    startTransition(async () => {
      const result = await importContactsAction(validRows);
      if (result.success && result.data) {
        setSummary(result.data);
        toast({ title: "Import complete", description: result.message, variant: "success" });
        clearFile();
        router.refresh();
      } else {
        toast({ title: "Import failed", description: result.message, variant: "destructive" });
      }
    });
  }

  function downloadSample() {
    const csv = toCsv([
      ["Full Name", "Email", "Phone", "Job Title", "Company", "LinkedIn URL", "Location", "Purpose", "Notes"],
      [
        "Ada Lovelace",
        "ada@example.com",
        "+1 555 0100",
        "Engineering Manager",
        "Acme Corp",
        "linkedin.com/in/ada",
        "London, UK",
        "Referral",
        "Met at a meetup",
      ],
      [
        "Grace Hopper",
        "grace@example.com",
        "",
        "Staff Engineer",
        "Acme Corp",
        "",
        "New York, NY",
        "Networking",
        "",
      ],
    ]);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contacts-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const validCount = parsed?.filter((row) => row.valid).length ?? 0;
  const invalidCount = parsed ? parsed.length - validCount : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import contacts</CardTitle>
        <CardDescription>
          Add many people at once from a CSV. Required columns: full name and company. Duplicates (matching
          email or name) are skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => handleFile(event.target.files?.[0])}
            disabled={isPending}
            className="max-w-sm cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium"
          />
          <Button type="button" variant="outline" size="sm" onClick={downloadSample} disabled={isPending}>
            <Download className="h-4 w-4" />
            Sample CSV
          </Button>
        </div>

        {parseError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {summary && (
          <div className="space-y-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              Imported {summary.imported} {summary.imported === 1 ? "contact" : "contacts"}
            </div>
            <p className="text-muted-foreground">
              {summary.skipped} skipped as duplicates or invalid · {summary.companiesCreated}{" "}
              {summary.companiesCreated === 1 ? "company" : "companies"} created.
            </p>
            {summary.errors.length > 0 && (
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {summary.errors.slice(0, 8).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
                {summary.errors.length > 8 && <li>…and {summary.errors.length - 8} more.</li>}
              </ul>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setSummary(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {parsed && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{fileName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary">{validCount} ready</Badge>
                {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalid</Badge>}
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Row</th>
                    <th className="px-2 py-1.5 font-medium">Name</th>
                    <th className="px-2 py-1.5 font-medium">Company</th>
                    <th className="px-2 py-1.5 font-medium">Email</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsed.slice(0, 20).map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.rowNumber}</td>
                      <td className="px-2 py-1.5">{row.data.fullName || "—"}</td>
                      <td className="px-2 py-1.5">{row.data.companyName || "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.data.email || "—"}</td>
                      <td className="px-2 py-1.5">
                        {row.valid ? (
                          <span className="text-success">Ready</span>
                        ) : (
                          <span className="text-destructive" title={row.issues.join(", ")}>
                            {row.issues.join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.length > 20 && (
              <p className="text-xs text-muted-foreground">Showing the first 20 of {parsed.length} rows.</p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={clearFile} disabled={isPending}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={runImport} disabled={isPending || validCount === 0}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isPending ? "Importing…" : `Import ${validCount} ${validCount === 1 ? "contact" : "contacts"}`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
