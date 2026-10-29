"use client";
import * as React from "react";
import { Download, Upload, AlertTriangle, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/use-toast";
import { exportFullBackup, restoreBackup } from "@/server/actions/import-export";

export function SettingsClient() {
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
          <p>No data is sent to external servers. Your contacts are private and stay on this machine.</p>
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
