"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { previewCsvImport, importCsv } from "@/server/actions/import-export";
import type { ImportPreview } from "@/lib/types";

export function ImportClient() {
  const router = useRouter();
  const [csvText, setCsvText] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string>("");
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setIsPreviewLoading(true);
    const p = await previewCsvImport(text);
    setPreview(p);
    setIsPreviewLoading(false);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!csvText) return;
    setIsImporting(true);
    const result = await importCsv(csvText, true);
    setIsImporting(false);
    if (result.success && result.data) {
      toast({
        title: "Import complete",
        description: `${result.data.added} added · ${result.data.skipped} skipped · ${result.data.invalid} invalid`,
        variant: "success",
      });
      router.push("/people");
    } else {
      toast({ title: "Import failed", description: result.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <Link href="/people" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="h-4 w-4" />Back to People Directory
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Import Contacts from CSV</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload a CSV file to bulk-import contacts with duplicate detection</p>
      </div>

      {/* CSV format guide */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Expected CSV Format</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">Your CSV should have a header row with these columns (extras are ignored):</p>
          <code className="text-xs bg-muted px-2 py-1 rounded block">
            fullName, email, phone, jobTitle, companyName, linkedinUrl, location, purpose, notes
          </code>
          <p className="text-xs text-muted-foreground mt-2">Required: <strong>fullName</strong>, <strong>companyName</strong>. All other fields optional.</p>
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card>
        <CardContent className="pt-6">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) {
                const evt = { target: { files: [file], value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>;
                handleFile(evt);
              }
            }}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="font-medium">{fileName || "Drop CSV file here or click to browse"}</p>
            <p className="text-xs text-muted-foreground mt-1">Supports .csv files</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </CardContent>
      </Card>

      {/* Preview */}
      {isPreviewLoading && <p className="text-sm text-muted-foreground text-center py-4">Analysing file...</p>}

      {preview && !isPreviewLoading && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Import Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" />{preview.valid} valid</span>
              <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="h-4 w-4" />{preview.duplicates} duplicates</span>
              <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" />{preview.invalid} invalid</span>
              <span className="text-muted-foreground ml-auto">Total: {preview.total}</span>
            </div>

            {preview.rows.length > 0 && (
              <div className="max-h-60 overflow-y-auto rounded border text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">#</th>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Company</th>
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber} className={`border-t ${row.status === "invalid" ? "bg-red-50/50 dark:bg-red-950/20" : row.status === "duplicate" ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.rowNumber}</td>
                        <td className="px-3 py-1.5">{row.person.fullName}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.person.companyName}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.person.email ?? "—"}</td>
                        <td className="px-3 py-1.5">
                          {row.status === "valid" && <span className="text-green-600">✓ Valid</span>}
                          {row.status === "duplicate" && <span className="text-amber-600">⚠ Duplicate</span>}
                          {row.status === "invalid" && <span className="text-destructive">✗ {row.issues[0]}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.valid > 0 && (
              <Button onClick={handleImport} disabled={isImporting} className="w-full">
                {isImporting ? "Importing..." : `Import ${preview.valid} contact${preview.valid !== 1 ? "s" : ""} (skip ${preview.duplicates} duplicates)`}
              </Button>
            )}
            {preview.valid === 0 && preview.total > 0 && (
              <p className="text-sm text-muted-foreground text-center">No valid rows to import.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
