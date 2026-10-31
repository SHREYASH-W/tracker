"use client";
import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Download,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Upload,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/use-toast";
import { exportFullBackup, restoreBackup } from "@/server/actions/import-export";
import type { getLlmStatus } from "@/server/llm";
import type { UsageSnapshot } from "@/server/providers/usage";

interface SettingsClientProps {
  llm: ReturnType<typeof getLlmStatus>;
  usage: UsageSnapshot[];
}

export function SettingsClient({ llm, usage }: SettingsClientProps) {
  const { theme, setTheme } = useTheme();
  const [restoreOpen, setRestoreOpen] = React.useState(false);
  const [pendingJson, setPendingJson] = React.useState<string | null>(null);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const json = await exportFullBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Backup downloaded", variant: "success" });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        JSON.parse(text); // validate
        setPendingJson(text);
        setRestoreOpen(true);
      } catch {
        toast({ title: "Invalid backup file", description: "The file could not be parsed as JSON.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRestore = async () => {
    if (!pendingJson) return;
    setIsRestoring(true);
    const result = await restoreBackup(pendingJson);
    setIsRestoring(false);
    setRestoreOpen(false);
    setPendingJson(null);
    if (result.success) {
      toast({ title: "Backup restored", description: result.message, variant: "success" });
      window.location.reload();
    } else {
      toast({ title: "Restore failed", description: result.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings & Data</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage theme, backups, and data import/export</p>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[
              { value: "light", icon: Sun, label: "Light" },
              { value: "dark", icon: Moon, label: "Dark" },
              { value: "system", icon: Monitor, label: "System" },
            ].map(({ value, icon: Icon, label }) => (
              <Button
                key={value}
                variant={theme === value ? "default" : "outline"}
                className="flex-1"
                onClick={() => setTheme(value)}
              >
                <Icon className="h-4 w-4 mr-2" />{label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI provider */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Provider
              </CardTitle>
              <CardDescription>
                Powers query expansion, job-match explanations and outreach drafts.
              </CardDescription>
            </div>
            <Badge variant={llm.anyConfigured ? "success" : "outline"}>
              {llm.anyConfigured ? "Ready" : "Rules only"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {llm.providers.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="flex items-center gap-2.5">
                  {provider.configured ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <CircleSlash className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{provider.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {provider.model} · {provider.local ? "local" : "cloud"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    provider.configured
                      ? llm.primary === provider.id
                        ? "default"
                        : "outline"
                      : "outline"
                  }
                >
                  {provider.configured
                    ? llm.primary === provider.id
                      ? "Primary"
                      : "Fallback"
                    : "Not configured"}
                </Badge>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Groq is used first when <code className="rounded bg-muted px-1 py-0.5">GROQ_API_KEY</code> is
            set. Ollama runs locally on port 11434 and Gemini is optional. With no provider configured,
            query expansion falls back to built-in rules so the app keeps working.
          </p>

          {usage.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium">Calls today (UTC)</p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {usage.map((row) => (
                  <li
                    key={`${row.provider}-${row.operation}`}
                    className="flex justify-between gap-3"
                  >
                    <span>
                      {row.provider} · {row.operation}
                    </span>
                    <span>
                      {row.count}
                      {row.quotaLimit !== null ? ` / ${row.quotaLimit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            API keys live in <code className="rounded bg-muted px-1 py-0.5">.env.local</code> and are only
            read by the server — they never reach the browser.
          </p>
        </CardContent>
      </Card>

      {/* Backup & restore */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Backup & Restore</CardTitle>
          <CardDescription>Export a full JSON backup of all your data, or restore from a previous backup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md border">
            <div>
              <p className="text-sm font-medium">Export Full Backup</p>
              <p className="text-xs text-muted-foreground mt-0.5">Downloads a JSON file with all contacts, companies, interactions and templates.</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" />Download
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
            <div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium">Restore from Backup</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">This will replace ALL existing data. This action cannot be undone.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1.5" />Choose File
            </Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
          </div>
        </CardContent>
      </Card>

      {/* CSV import link */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Import Contacts</CardTitle>
          <CardDescription>Bulk import contacts from a CSV file with preview and duplicate detection.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="/people/import"><Upload className="h-4 w-4 mr-1.5" />Go to CSV Import</a>
          </Button>
        </CardContent>
      </Card>

      {/* Data info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">About Your Data</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>All data is stored locally in a SQLite database at <code className="text-xs bg-muted px-1 py-0.5 rounded">./data/contact_crm.db</code>.</p>
          <p>Optional email lookup and AI providers only receive the specific query or contact details you trigger. Keys stay on the server.</p>
          <p>Back up the database file directly or use the JSON backup above to preserve your data.</p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={restoreOpen} onOpenChange={setRestoreOpen}
        title="Restore backup?"
        description="This will permanently replace ALL your current data (contacts, companies, interactions, templates) with the backup. This cannot be undone. Make sure to export your current data first if you need it."
        confirmLabel="Restore Backup"
        onConfirm={handleRestore}
        isPending={isRestoring}
      />
    </div>
  );
}
