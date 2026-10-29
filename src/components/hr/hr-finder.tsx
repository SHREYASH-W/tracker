"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Linkedin, Loader2, Mail, Search, UserSearch } from "lucide-react";
import { addHrContactsAction, findHrContactsAction } from "@/lib/actions";
import type { HrContactImportSummary } from "@/lib/action-types";
import { PURPOSE_VALUES, type PurposeValue } from "@/lib/constants";
import type { HrContactResult, HrSearchResult } from "@/lib/email-lookup";
import { cn } from "@/lib/utils";
import { verificationLabel, verificationVariant } from "../email-verification";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { FormField } from "../ui/form-field";
import { Input } from "../ui/input";
import { NativeSelect } from "../ui/native-select";
import { useToast } from "../ui/use-toast";

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

export function HrFinder({ initialDomain }: { initialDomain: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const [domain, setDomain] = React.useState(initialDomain);
  const [targetRole, setTargetRole] = React.useState("");
  const [purpose, setPurpose] = React.useState<PurposeValue>("Internship");
  const [searching, setSearching] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [result, setResult] = React.useState<HrSearchResult | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [addedEmails, setAddedEmails] = React.useState<Set<string>>(() => new Set());
  const [skippedEmails, setSkippedEmails] = React.useState<Set<string>>(() => new Set());
  const [summary, setSummary] = React.useState<HrContactImportSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  function isUnavailable(contact: HrContactResult): boolean {
    const key = emailKey(contact.email);
    return addedEmails.has(key) || skippedEmails.has(key);
  }

  const selectable = (result?.contacts ?? []).filter((contact) => !isUnavailable(contact));

  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(emailKey(c.email)));

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    setNotice(null);
    setSummary(null);
    setResult(null);
    setSelected(new Set());

    try {
      const response = await findHrContactsAction(domain);
      if (!response.success) {
        setError(response.message);
        return;
      }
      if (!response.data || response.data.contacts.length === 0) {
        setNotice(response.message);
        return;
      }
      const found = response.data;
      setResult(found);
      setSelected(
        new Set(
          found.contacts
            .filter((contact) => {
              const key = emailKey(contact.email);
              return !addedEmails.has(key) && !skippedEmails.has(key);
            })
            .map((contact) => emailKey(contact.email)),
        ),
      );
    } catch {
      setError("Could not search Hunter. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function toggleContact(email: string, checked: boolean) {
    const key = emailKey(email);
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectable.map((contact) => emailKey(contact.email))));
  }

  async function handleAdd() {
    if (!result) return;
    const role = targetRole.trim();
    if (!role) {
      setError("Add the role you're targeting so you remember what to ask for.");
      return;
    }

    const contacts = result.contacts
      .filter((contact) => selected.has(emailKey(contact.email)) && !isUnavailable(contact))
      .map((contact) => ({
        email: contact.email,
        fullName: contact.fullName,
        jobTitle: contact.jobTitle,
        department: contact.department,
        seniority: contact.seniority,
        linkedinUrl: contact.linkedinUrl,
        phoneNumber: contact.phoneNumber,
      }));

    if (contacts.length === 0) {
      setError("Select at least one contact to add.");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const response = await addHrContactsAction({
        domain: result.domain,
        companyName: result.organization,
        targetRole: role,
        purpose,
        contacts,
      });

      if (!response.success) {
        setError(response.message);
        return;
      }

      const data = response.data;
      setSummary(data ?? null);
      setAddedEmails((prev) => new Set([...prev, ...(data?.addedEmails ?? []).map(emailKey)]));
      setSkippedEmails((prev) => new Set([...prev, ...(data?.skippedEmails ?? []).map(emailKey)]));
      setSelected(new Set());
      toast({
        title: data && data.added === 0 ? "Contacts already saved" : "HR contacts added",
        description: response.message,
        variant: "success",
      });
      router.refresh();
    } catch {
      setError("Could not add the contacts. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  const organization = result?.organization ?? result?.domain ?? "";
  const displayDomain = result?.domain ?? domain;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserSearch className="h-4 w-4 text-primary" />
            Search a company
          </CardTitle>
          <CardDescription>
            Enter the company domain and the role you want. Hunter returns up to 10 HR and recruiting
            contacts — pick the ones to cold email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSearch}
            className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_auto] md:items-end"
          >
            <FormField label="Company domain" htmlFor="hr-domain" required hint="One Hunter search credit.">
              <Input
                id="hr-domain"
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                placeholder="example.com"
                autoComplete="off"
                spellCheck={false}
                disabled={searching || adding}
              />
            </FormField>

            <FormField
              label="Target role"
              htmlFor="hr-target-role"
              required
              hint="Saved on the outreach record, e.g. AI/ML Developer."
            >
              <Input
                id="hr-target-role"
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                placeholder="AI/ML Developer or AI Internship"
                autoComplete="off"
                disabled={searching || adding}
              />
            </FormField>

            <FormField label="Outreach type" htmlFor="hr-purpose">
              <NativeSelect
                id="hr-purpose"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value as PurposeValue)}
                disabled={searching || adding}
              >
                {PURPOSE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <Button type="submit" disabled={searching || adding || !domain.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? "Searching…" : "Find HR contacts"}
            </Button>
          </form>

          {error && (
            <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {notice && (
            <p className="mt-4 rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">{notice}</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {organization}
              </CardTitle>
              <CardDescription>
                {result.contacts.length} HR {result.contacts.length === 1 ? "contact" : "contacts"} found
                on {displayDomain}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleAll}
                disabled={adding || selectable.length === 0}
              >
                {allSelected ? "Clear selection" : "Select all"}
              </Button>
            </div>
          </CardHeader>

          {summary && (
            <div className="mx-6 mb-4 flex flex-wrap items-center gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span>
                {summary.added > 0
                  ? `${summary.added} ${summary.added === 1 ? "contact" : "contacts"} added`
                  : "Contacts already saved"}
                {summary.skipped > 0 && summary.added > 0
                  ? ` · ${summary.skipped} already in your CRM`
                  : ""}
                .
              </span>
              {summary.companyId && (
                <Link
                  href={`/companies/${summary.companyId}`}
                  className="font-medium text-primary hover:underline"
                >
                  View company
                </Link>
              )}
            </div>
          )}

          <CardContent className="p-0">
            <ul className="divide-y border-t">
              {result.contacts.map((contact) => {
                const key = emailKey(contact.email);
                const added = addedEmails.has(key);
                const skipped = skippedEmails.has(key);
                const unavailable = added || skipped;
                const detail = [contact.jobTitle, contact.seniority].filter(Boolean).join(" · ");

                return (
                  <li
                    key={key}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 sm:px-6",
                      unavailable && "bg-muted/30",
                    )}
                  >
                    <Checkbox
                      className="mt-1"
                      checked={selected.has(key)}
                      disabled={unavailable || adding}
                      onCheckedChange={(checked) => toggleContact(contact.email, checked === true)}
                      aria-label={`Add ${contact.fullName}`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("font-medium", unavailable && "text-muted-foreground")}>
                          {contact.fullName}
                        </span>
                        <Badge variant={verificationVariant(contact.verificationStatus)}>
                          {verificationLabel(contact.verificationStatus)}
                        </Badge>
                        {added && <Badge variant="success">Added</Badge>}
                        {skipped && <Badge variant="secondary">Already in CRM</Badge>}
                      </div>

                      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="break-all font-mono text-foreground">{contact.email}</span>
                        </span>
                        {contact.linkedinUrl && (
                          <a
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            <Linkedin className="h-3 w-3" />
                            LinkedIn
                          </a>
                        )}
                        {contact.score > 0 && <span>{contact.score}% confidence</span>}
                        {contact.sourceCount > 0 && (
                          <span>
                            {contact.sourceCount} {contact.sourceCount === 1 ? "source" : "sources"}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 sm:px-6">
              <p className="text-xs text-muted-foreground">
                {selected.size} selected
                {targetRole.trim() ? ` · ${purpose} · ${targetRole.trim()}` : ""}
              </p>
              <Button
                type="button"
                onClick={handleAdd}
                disabled={adding || searching || selected.size === 0}
              >
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                {adding
                  ? "Adding…"
                  : selected.size > 0
                    ? `Add ${selected.size} ${selected.size === 1 ? "contact" : "contacts"} to CRM`
                    : "Add contacts to CRM"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
