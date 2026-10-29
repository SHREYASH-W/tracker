import { Suspense } from "react";
import Link from "next/link";
import { Users, Building2, Send, Clock, Bell, TrendingUp, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { PersonAvatar } from "@/components/person-avatar";
import {
  getDashboardStats, getStatusDistribution, getCompanyBreakdown,
  getRecentActivity, getTopFollowUps,
} from "@/server/actions/dashboard";
import { formatDate, formatRelative, isOverdue, isDueToday } from "@/lib/utils";
import { DashboardChart } from "./dashboard-chart";

export const dynamic = "force-dynamic";

const STAT_CARDS = [
  { key: "totalPeople", label: "Total People", icon: Users, color: "text-blue-600" },
  { key: "totalCompanies", label: "Total Companies", icon: Building2, color: "text-indigo-600" },
  { key: "messagesSent", label: "Messages Sent", icon: Send, color: "text-violet-600" },
  { key: "awaitingReplies", label: "Awaiting Replies", icon: Clock, color: "text-amber-600" },
  { key: "followUpsDue", label: "Follow-ups Due", icon: Bell, color: "text-orange-600" },
  { key: "interviews", label: "Interviews", icon: TrendingUp, color: "text-teal-600" },
  { key: "positiveOutcomes", label: "Positive Outcomes", icon: CheckCircle, color: "text-green-600" },
  { key: "rejections", label: "Rejections", icon: XCircle, color: "text-red-500" },
] as const;

export default async function DashboardPage() {
  const [stats, statusDist, companyBreakdown, recentActivity, topFollowUps] = await Promise.all([
    getDashboardStats(),
    getStatusDistribution(),
    getCompanyBreakdown(),
    getRecentActivity(8),
    getTopFollowUps(5),
  ]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your outreach activities</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold mt-0.5">{stats[key as keyof typeof stats]}</p>
              </div>
              <Icon className={`h-8 w-8 ${color} opacity-80`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Status distribution chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Outreach Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {statusDist.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                No outreach data yet.{" "}
                <Link href="/people" className="ml-1 text-primary underline">Add contacts</Link>
              </div>
            ) : (
              <Suspense fallback={<div className="h-56 animate-pulse rounded bg-muted" />}>
                <DashboardChart data={statusDist} />
              </Suspense>
            )}
          </CardContent>
        </Card>

        {/* Follow-ups due */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Follow-ups Due</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/follow-ups" className="flex items-center gap-1 text-xs">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {topFollowUps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No follow-ups due</p>
            ) : topFollowUps.map((f) => (
              <Link
                key={f.outreach_id}
                href={`/people/${f.person_id}`}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-muted transition-colors"
              >
                <PersonAvatar name={f.full_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{f.company_name ?? "—"}</p>
                </div>
                <span className={`text-xs font-medium ${isOverdue(f.next_follow_up_at) ? "text-destructive" : isDueToday(f.next_follow_up_at) ? "text-amber-600" : "text-muted-foreground"}`}>
                  {formatRelative(f.next_follow_up_at)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/activity" className="flex items-center gap-1 text-xs">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded yet</p>
            ) : recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <PersonAvatar name={a.person_name} size="sm" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={`/people/${a.person_id}`} className="text-sm font-medium hover:underline truncate">
                      {a.person_name}
                    </Link>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(a.ts)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.interaction_type}
                    {a.company_name ? ` · ${a.company_name}` : ""}
                  </p>
                  {a.summary && <p className="text-xs text-muted-foreground truncate mt-0.5">{a.summary}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Company breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Company Breakdown</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/companies" className="flex items-center gap-1 text-xs">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {companyBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No companies yet</p>
            ) : companyBreakdown.map((c) => (
              <Link
                key={c.companyId}
                href={`/companies/${c.companyId}`}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-muted transition-colors"
              >
                <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center text-xs font-semibold text-secondary-foreground">
                  {c.companyName.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium truncate">{c.companyName}</span>
                <span className="text-xs text-muted-foreground">{c.contactCount} contact{c.contactCount !== 1 ? "s" : ""}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
