"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Database, Globe, Layers, Loader2, Mail, Search, Sparkles } from "lucide-react";
import { emailLookupAction, saveFoundEmailAction } from "@/lib/actions";
import {
  EMAIL_PROVIDERS,
  EMAIL_PROVIDER_LABELS,
  type EmailLookupResult,
  type EmailProvider,
} from "@/lib/email-lookup";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import { verificationLabel, verificationVariant } from "../email-verification";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FormField } from "../ui/form-field";
import { Input } from "../ui/input";
import { useToast } from "../ui/use-toast";

const PROVIDER_DETAILS: Record<
  EmailProvider,
  { description: string; hint: string; icon: typeof Globe }
> = {
  hunter: {
    description: "Web sources",
    hint: "Each Hunter lookup uses one search credit.",
    icon: Globe,
  },
  prospeo: {
    description: "B2B database",
    hint: "Prospeo uses a credit only when it finds an email.",
    icon: Database,
  },
  enrichlayer: {
    description: "Verified emails",
    hint: "Enrich Layer validates the mailbox; catch-all domains are flagged.",
    icon: Layers,
  },
};

function resultAccent(status: string | null): string {
  if (status === "valid") return "border-success/30 bg-success/5";
  if (status === "invalid" || status === "disposable") return "border-destructive/30 bg-destructive/5";
  return "border-warning/30 bg-warning/5";
}

export function EmailLookupDialog({
  open,
  onOpenChange,
  person,
  initialDomain,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Person;
  initialDomain: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [provider, setProvider] = React.useState<EmailProvider>("hunter");
  const [domain, setDomain] = React.useState(initialDomain ?? "");
  const [looking, setLooking] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [result, setResult] = React.useState<EmailLookupResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDomain(initialDomain ?? "");
    setResult(null);
    setError(null);
    setNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDomain]);

  function handleProviderChange(next: EmailProvider) {
    setProvider(next);
    setResult(null);
    setError(null);
    setNotice(null);
  }

  async function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLooking(true);
    setError(null);
    setNotice(null);
    setResult(null);

    try {
      const response = await emailLookupAction(person.id, provider, domain);
      if (!response.success) {
        setError(response.message);
      } else if (!response.data) {
        setNotice(response.message);
      } else {
        setResult(response.data);
      }
    } catch {
      setError(`Could not query ${EMAIL_PROVIDER_LABELS[provider]}. Please try again.`);
    } finally {
      setLooking(false);
    }
  }

  async function handleApply() {
    if (!result) return;
    setApplying(true);
    setError(null);

    try {
      const response = await saveFoundEmailAction(person.id, result.email);
      if (!response.success) {
        setError(response.message);
        return;
      }
      toast({ title: "Email saved", description: response.message, variant: "success" });
      router.refresh();
      onOpenChange(false);
    } catch {
      setError("Could not save the email. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  const label = EMAIL_PROVIDER_LABELS[provider];
  const details = result
    ? [
        `Found with ${EMAIL_PROVIDER_LABELS[result.provider]}`,
        result.score != null ? `${result.score}% confidence` : null,
        result.sourceCount != null
          ? `${result.sourceCount} ${result.sourceCount === 1 ? "source" : "sources"}`
          : null,
        result.position,
        result.company ? `at ${result.company}` : null,
        result.isCatchAll ? "catch-all domain" : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Find email
          </DialogTitle>
          <DialogDescription>
            Look up {person.fullName}&apos;s work email with {label}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLookup} className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Provider</p>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Email provider">
              {EMAIL_PROVIDERS.map((value) => {
                const active = provider === value;
                const Icon = PROVIDER_DETAILS[value].icon;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={looking || applying}
                    onClick={() => handleProviderChange(value)}
                    className={cn(
                      "flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "hover:bg-muted/50",
                      (looking || applying) && "opacity-60",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{EMAIL_PROVIDER_LABELS[value]}</span>
                      <span className="block text-xs text-muted-foreground">
                        {PROVIDER_DETAILS[value].description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <FormField label="Company domain" htmlFor="lookup-domain" hint={PROVIDER_DETAILS[provider].hint}>
            <Input
              id="lookup-domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="example.com"
              autoComplete="off"
              spellCheck={false}
              disabled={looking || applying}
            />
          </FormField>

          {person.email && (
            <p className="text-xs text-muted-foreground">
              Current email: <span className="font-mono text-foreground">{person.email}</span>
            </p>
          )}

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {notice && (
            <p className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">{notice}</p>
          )}

          {result && (
            <div className={cn("space-y-3 rounded-md border p-3", resultAccent(result.verificationStatus))}>
              <div className="flex flex-wrap items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="break-all font-mono text-sm font-medium">{result.email}</span>
                <Badge variant={verificationVariant(result.verificationStatus)}>
                  {verificationLabel(result.verificationStatus)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{details}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={looking || applying}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={result ? "outline" : "default"}
              disabled={looking || applying || !domain.trim()}
            >
              {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {looking ? "Searching…" : result ? "Search again" : "Find email"}
            </Button>
            {result && (
              <Button type="button" onClick={handleApply} disabled={applying || looking}>
                {applying && <Loader2 className="h-4 w-4 animate-spin" />}
                {person.email ? "Replace email" : "Save email"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
