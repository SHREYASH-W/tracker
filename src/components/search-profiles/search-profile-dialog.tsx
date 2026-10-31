"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles, X } from "lucide-react";
import {
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  SEARCH_ROLE_TYPES,
  SEARCH_ROLE_TYPE_LABELS,
} from "@/lib/constants";
import type { SearchProfileView } from "@/lib/types";
import { searchProfileSchema, type SearchProfileFormData } from "@/lib/validators";
import {
  createSearchProfile,
  expandSearchQuery,
  updateSearchProfile,
} from "@/server/actions/search-profiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

const PROVIDER_LABELS: Record<string, string> = {
  groq: "Groq",
  gemini: "Gemini",
  ollama: "Ollama (local)",
  heuristic: "local rules",
};

function ChipInput({
  label,
  hint,
  values,
  onChange,
  placeholder,
  max,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  max: number;
}) {
  const [draft, setDraft] = React.useState("");

  const add = () => {
    const value = draft.trim().replace(/,$/, "");
    if (!value) return;
    const exists = values.some((item) => item.toLowerCase() === value.toLowerCase());
    if (!exists && values.length < max) onChange([...values, value]);
    setDraft("");
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium leading-none">{label}</span>
        <span className="text-xs text-muted-foreground">
          {values.length}/{max}
        </span>
      </div>
      <div className="mt-1.5 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 shadow-sm">
        {values.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add();
            } else if (event.key === "Backspace" && !draft && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={add}
          placeholder={values.length === 0 ? placeholder : "Add…"}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SearchProfileDialog({
  open,
  onOpenChange,
  profile,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: SearchProfileView;
  onSaved: () => void;
}) {
  const [titles, setTitles] = React.useState<string[]>(profile?.titles ?? []);
  const [keywords, setKeywords] = React.useState<string[]>(profile?.keywords ?? []);
  const [locations, setLocations] = React.useState<string[]>(profile?.locations ?? []);
  const [excludedKeywords, setExcludedKeywords] = React.useState<string[]>(
    profile?.excludedKeywords ?? [],
  );
  const [expanding, setExpanding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [expansion, setExpansion] = React.useState<{
    provider: string;
    cached: boolean;
  } | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SearchProfileFormData>({
    resolver: zodResolver(searchProfileSchema),
    defaultValues: {
      name: profile?.name ?? "",
      prompt: profile?.prompt ?? "",
      titles: [],
      keywords: [],
      locations: [],
      excludedKeywords: [],
      roleType: (profile?.roleType as SearchProfileFormData["roleType"]) ?? "both",
      remoteOk: profile?.remoteOk ?? true,
      experienceLevel:
        (profile?.experienceLevel as SearchProfileFormData["experienceLevel"]) ?? "any",
      minMatchScore: profile?.minMatchScore ?? 60,
      active: profile?.active ?? true,
    },
  });

  const remoteOk = watch("remoteOk");
  const active = watch("active");
  const roleType = watch("roleType");

  const handleExpand = async () => {
    const prompt = getValues("prompt").trim();
    if (prompt.length < 2) {
      toast({
        title: "Describe your target first",
        description: "For example: “AI/ML internship, remote or Bengaluru”.",
        variant: "destructive",
      });
      return;
    }

    const context = getValues("name").trim() || undefined;
    setExpanding(true);
    const result = await expandSearchQuery(prompt, context);
    setExpanding(false);

    if (!result.success || !result.data) {
      toast({ title: "Could not expand", description: result.error ?? result.message, variant: "destructive" });
      return;
    }

    const expanded = result.data;
    setTitles(expanded.titles);
    setKeywords(expanded.keywords);
    setLocations(expanded.locations);
    setExcludedKeywords(expanded.excludedKeywords);
    setValue("roleType", expanded.roleType, { shouldValidate: true });
    setValue("experienceLevel", expanded.experienceLevel, { shouldValidate: true });
    setValue("remoteOk", expanded.remoteOk);
    if (!getValues("name").trim()) {
      setValue(
        "name",
        (expanded.titles[0] ?? prompt).slice(0, 120),
        { shouldValidate: true },
      );
    }
    setExpansion({ provider: expanded.provider, cached: expanded.cached });

    toast({
      title: "Search terms expanded",
      description:
        expanded.provider === "heuristic"
          ? "Built locally. Add an AI key or run Ollama for richer results."
          : `${expanded.titles.length} titles and ${expanded.keywords.length} keywords via ${
              PROVIDER_LABELS[expanded.provider] ?? expanded.provider
            }.`,
      variant: "success",
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    const payload = { ...values, titles, keywords, locations, excludedKeywords };
    const result = profile
      ? await updateSearchProfile(profile.id, payload)
      : await createSearchProfile(payload);
    setSaving(false);

    if (!result.success) {
      toast({
        title: profile ? "Could not update profile" : "Could not create profile",
        description: result.error ?? result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: profile ? "Search profile updated" : "Search profile created",
      description: result.message,
      variant: "success",
    });
    onOpenChange(false);
    onSaved();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit search profile" : "New search profile"}</DialogTitle>
          <DialogDescription>
            Describe the role you want. The app expands it into job titles and keywords — no company
            domain needed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <FormField label="Profile name" htmlFor="profile-name" required error={errors.name?.message}>
              <Input
                id="profile-name"
                placeholder="AI/ML internships"
                {...register("name")}
              />
            </FormField>
            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={active}
                  onCheckedChange={(checked) => setValue("active", checked === true)}
                />
                Active
              </label>
            </div>
          </div>

          <FormField
            label="What are you looking for?"
            htmlFor="profile-prompt"
            required
            error={errors.prompt?.message}
            hint="Free text is fine — e.g. “AI/ML internship in Bengaluru, remote ok”. Location is optional."
          >
            <Textarea
              id="profile-prompt"
              rows={2}
              placeholder="AI/ML internship, remote or Bengaluru, student friendly"
              {...register("prompt")}
            />
          </FormField>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleExpand} disabled={expanding}>
              {expanding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {expanding ? "Expanding…" : "Expand with AI"}
            </Button>
            {expansion && (
              <Badge variant={expansion.provider === "heuristic" ? "outline" : "success"}>
                {expansion.provider === "heuristic"
                  ? "Local expansion"
                  : `${PROVIDER_LABELS[expansion.provider] ?? expansion.provider}${
                      expansion.cached ? " · cached" : ""
                    }`}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Titles and keywords stay editable below.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Role type" htmlFor="profile-role-type">
              <NativeSelect
                id="profile-role-type"
                value={roleType}
                onChange={(event) =>
                  setValue("roleType", event.target.value as SearchProfileFormData["roleType"])
                }
              >
                {SEARCH_ROLE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {SEARCH_ROLE_TYPE_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Experience level" htmlFor="profile-experience">
              <NativeSelect id="profile-experience" {...register("experienceLevel")}>
                {EXPERIENCE_LEVELS.map((value) => (
                  <option key={value} value={value}>
                    {EXPERIENCE_LEVEL_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Minimum match score"
              htmlFor="profile-min-score"
              hint="Jobs below this score are hidden by default."
              error={errors.minMatchScore?.message}
            >
              <Input
                id="profile-min-score"
                type="number"
                min={0}
                max={100}
                {...register("minMatchScore", { valueAsNumber: true })}
              />
            </FormField>
            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={remoteOk}
                  onCheckedChange={(checked) => setValue("remoteOk", checked === true)}
                />
                Open to remote roles
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-md border bg-muted/20 p-3">
            <ChipInput
              label="Job titles"
              hint="Press Enter or comma to add. These titles are searched across job boards."
              values={titles}
              onChange={setTitles}
              placeholder="e.g. Machine Learning Intern"
              max={30}
            />
            <ChipInput
              label="Keywords"
              values={keywords}
              onChange={setKeywords}
              placeholder="e.g. python, pytorch, llm"
              max={40}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <ChipInput
                label="Locations"
                values={locations}
                onChange={setLocations}
                placeholder="e.g. Bengaluru"
                max={20}
              />
              <ChipInput
                label="Excluded keywords"
                values={excludedKeywords}
                onChange={setExcludedKeywords}
                placeholder="e.g. unpaid"
                max={30}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : profile ? "Save changes" : "Create profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
