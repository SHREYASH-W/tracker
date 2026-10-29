// --- Contact statuses ----------------------------------------------------

export const STATUS_VALUES = [
  "not_contacted",
  "message_drafted",
  "message_sent",
  "awaiting_reply",
  "replied",
  "follow_up_needed",
  "interview_discussion",
  "shortlisted",
  "selected_offer",
  "rejected",
  "not_interested",
  "archived",
] as const;

export type StatusValue = (typeof STATUS_VALUES)[number];

export interface StatusDef {
  value: StatusValue;
  label: string;
  /** Tailwind classes for badge styling: bg + text */
  badgeClass: string;
  /** Dot color for indicators */
  dotClass: string;
  /** Category: neutral, active, positive, negative */
  category: "neutral" | "active" | "positive" | "negative";
}

export const STATUS_DEFINITIONS: Record<StatusValue, StatusDef> = {
  not_contacted: {
    value: "not_contacted",
    label: "Not Contacted",
    badgeClass: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-stone-400 dark:bg-stone-500",
    category: "neutral",
  },
  message_drafted: {
    value: "message_drafted",
    label: "Message Drafted",
    badgeClass: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-900",
    dotClass: "bg-teal-400",
    category: "active",
  },
  message_sent: {
    value: "message_sent",
    label: "Message Sent",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
    dotClass: "bg-emerald-400",
    category: "active",
  },
  awaiting_reply: {
    value: "awaiting_reply",
    label: "Awaiting Reply",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    dotClass: "bg-amber-400",
    category: "active",
  },
  replied: {
    value: "replied",
    label: "Replied",
    badgeClass: "bg-teal-100/70 text-teal-900 border-teal-200 dark:bg-teal-900/50 dark:text-teal-200 dark:border-teal-800",
    dotClass: "bg-teal-500",
    category: "active",
  },
  follow_up_needed: {
    value: "follow_up_needed",
    label: "Follow-up Needed",
    badgeClass: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900",
    dotClass: "bg-orange-400",
    category: "active",
  },
  interview_discussion: {
    value: "interview_discussion",
    label: "Interview / Discussion",
    badgeClass: "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-900",
    dotClass: "bg-green-500",
    category: "positive",
  },
  shortlisted: {
    value: "shortlisted",
    label: "Shortlisted",
    badgeClass: "bg-primary/10 text-primary border-primary/25 dark:bg-primary/15 dark:border-primary/30",
    dotClass: "bg-primary",
    category: "positive",
  },
  selected_offer: {
    value: "selected_offer",
    label: "Selected / Offer",
    badgeClass: "bg-primary text-primary-foreground border-primary",
    dotClass: "bg-primary-foreground/80",
    category: "positive",
  },
  rejected: {
    value: "rejected",
    label: "Rejected",
    badgeClass: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
    dotClass: "bg-red-500",
    category: "negative",
  },
  not_interested: {
    value: "not_interested",
    label: "Not Interested",
    badgeClass: "bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800/80 dark:text-stone-300 dark:border-stone-700",
    dotClass: "bg-stone-400",
    category: "negative",
  },
  archived: {
    value: "archived",
    label: "Archived",
    badgeClass: "bg-stone-100/60 text-stone-500 border-stone-200 dark:bg-stone-800/40 dark:text-stone-500 dark:border-stone-800",
    dotClass: "bg-stone-400 dark:bg-stone-600",
    category: "neutral",
  },
};

export const STATUS_LIST = Object.values(STATUS_DEFINITIONS);

export function getStatusDef(status: string): StatusDef {
  return (
    STATUS_DEFINITIONS[status as StatusValue] ?? {
      value: status as StatusValue,
      label: status,
      badgeClass: "bg-muted text-muted-foreground border-border",
      dotClass: "bg-stone-400",
      category: "neutral" as const,
    }
  );
}

// --- Outreach purposes ----------------------------------------------------

export const PURPOSE_VALUES = [
  "Internship",
  "Full-time Job",
  "Referral",
  "Networking",
  "Collaboration",
  "Other",
] as const;

export type PurposeValue = (typeof PURPOSE_VALUES)[number];

// --- Contact channels -----------------------------------------------------

export const CHANNEL_VALUES = [
  "LinkedIn",
  "Email",
  "Phone",
  "Referral",
  "Other",
] as const;

export type ChannelValue = (typeof CHANNEL_VALUES)[number];

// --- Interaction types -----------------------------------------------------

export const INTERACTION_TYPES = [
  "Message Sent",
  "Reply Received",
  "Follow-up Sent",
  "Call",
  "Interview",
  "Referral",
  "Rejection",
  "Offer",
  "Note",
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

// --- Template categories --------------------------------------------------

export const TEMPLATE_CATEGORIES = [
  "LinkedIn connection request",
  "Internship outreach",
  "Job referral request",
  "Recruiter follow-up",
  "Thank-you message",
  "Interview follow-up",
  "Cold email",
  "Other",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

// --- Template variables ---------------------------------------------------

export const TEMPLATE_VARIABLES = [
  { token: "{{name}}", description: "Person's full name" },
  { token: "{{company}}", description: "Company name" },
  { token: "{{role}}", description: "Job title or target role" },
  { token: "{{my_background}}", description: "Your professional background" },
] as const;

// --- Positive outcomes (for dashboard metrics) ---------------------------

export const POSITIVE_OUTCOME_STATUSES: StatusValue[] = [
  "interview_discussion",
  "shortlisted",
  "selected_offer",
];

export const NEGATIVE_OUTCOME_STATUSES: StatusValue[] = [
  "rejected",
  "not_interested",
];

/** Statuses that end the outreach lifecycle — no follow-ups are expected. */
export const CLOSED_STATUSES: StatusValue[] = [
  "selected_offer",
  "rejected",
  "not_interested",
  "archived",
];

export function isClosedStatus(status: string): boolean {
  return (CLOSED_STATUSES as string[]).includes(status);
}

/** Outreach that is in progress (contacted and not closed). */
export function isActiveOutreachStatus(status: string): boolean {
  return status !== "not_contacted" && !isClosedStatus(status);
}

// --- Navigation -----------------------------------------------------------

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/people", label: "People Directory", icon: "Users" },
  { href: "/find-hr", label: "Find HR Contacts", icon: "UserSearch" },
  { href: "/companies", label: "Companies", icon: "Building2" },
  { href: "/follow-ups", label: "Follow-ups", icon: "Bell" },
  { href: "/activity", label: "Activity Timeline", icon: "Activity" },
  { href: "/templates", label: "Message Templates", icon: "MessageSquare" },
  { href: "/settings", label: "Settings & Data", icon: "Settings" },
] as const;
