"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Pencil, Play, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import {
  EXPERIENCE_LEVEL_LABELS,
  SEARCH_ROLE_TYPE_LABELS,
  type ExperienceLevel,
  type SearchRoleType,
} from "@/lib/constants";
import type { SearchProfileView } from "@/lib/types";
import {
  deleteSearchProfile,
  toggleSearchProfileActive,
} from "@/server/actions/search-profiles";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SearchProfileDialog } from "@/components/search-profiles/search-profile-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

function ValueChips({
  values,
  limit,
  variant = "muted",
}: {
  values: string[];
  limit: number;
  variant?: "muted" | "outline";
}) {
  if (values.length === 0) {
    return <span className="text-xs text-muted-foreground">None yet — edit to add</span>;
  }

  const shown = values.slice(0, limit);
  const extra = values.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((value) => (
        <span
          key={value}
          className={
            variant === "muted"
              ? "rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
              : "rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
          }
        >
          {value}
        </span>
      ))}
      {extra > 0 && (
        <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  profile: SearchProfileView;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className={profile.active ? undefined : "opacity-70"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{profile.name}</CardTitle>
                <Badge variant={profile.active ? "success" : "outline"}>
                  {profile.active ? "Active" : "Paused"}
                </Badge>
              </div>
              <CardDescription className="mt-1">{profile.prompt}</CardDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              title={profile.active ? "Pause profile" : "Activate profile"}
              onClick={onToggle}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : profile.active ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button size="sm" variant="ghost" className="h-8" title="Edit profile" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-destructive hover:text-destructive"
              title="Delete profile"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Job titles
            </p>
            <ValueChips values={profile.titles} limit={5} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Keywords
            </p>
            <ValueChips values={profile.keywords} limit={8} variant="outline" />
          </div>
        </div>

        {(profile.locations.length > 0 || profile.excludedKeywords.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Locations
              </p>
              <ValueChips values={profile.locations} limit={4} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Excluded
              </p>
              <ValueChips values={profile.excludedKeywords} limit={4} variant="outline" />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span>
            {SEARCH_ROLE_TYPE_LABELS[profile.roleType as SearchRoleType] ?? profile.roleType}
          </span>
          <span>
            {EXPERIENCE_LEVEL_LABELS[profile.experienceLevel as ExperienceLevel] ??
              profile.experienceLevel}
          </span>
          <span>{profile.remoteOk ? "Remote ok" : "On-site only"}</span>
          <span>Min match {profile.minMatchScore}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function SearchProfilesClient({ profiles }: { profiles: SearchProfileView[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<SearchProfileView | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SearchProfileView | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const activeCount = profiles.filter((profile) => profile.active).length;

  const handleToggle = async (profile: SearchProfileView) => {
    setBusyId(profile.id);
    const result = await toggleSearchProfileActive(profile.id, !profile.active);
    setBusyId(null);
    if (!result.success) {
      toast({ title: "Could not update profile", description: result.message, variant: "destructive" });
      return;
    }
    toast({ title: result.message, variant: "success" });
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteSearchProfile(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (!result.success) {
      toast({ title: "Could not delete profile", description: result.message, variant: "destructive" });
      return;
    }
    toast({ title: "Search profile deleted", variant: "success" });
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Search Profiles</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Describe the roles you want once. The app expands each target into job titles, keywords and
            locations, then uses it for job discovery and matching.
          </p>
          {profiles.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {profiles.length} profile{profiles.length === 1 ? "" : "s"} · {activeCount} active
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Profile
        </Button>
      </div>

      {profiles.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">No search profiles yet</p>
          <p className="mb-4 mt-1 max-w-sm text-sm text-muted-foreground">
            Try “AI/ML internship, remote or Bengaluru”. Expansion works offline and gets better with an
            AI provider configured in Settings.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create your first profile
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              busy={busyId === profile.id}
              onEdit={() => setEditTarget(profile)}
              onToggle={() => handleToggle(profile)}
              onDelete={() => setDeleteTarget(profile)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <SearchProfileDialog
          open
          onOpenChange={(open) => !open && setCreateOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}

      {editTarget && (
        <SearchProfileDialog
          open
          profile={editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSaved={() => router.refresh()}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete search profile?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be deleted. Existing jobs and outreach records are kept.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isPending={deleting}
      />
    </div>
  );
}
