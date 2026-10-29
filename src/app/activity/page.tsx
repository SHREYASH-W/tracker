import Link from "next/link";
import { getActivityTimeline } from "@/server/actions/outreach";
import { PersonAvatar } from "@/components/person-avatar";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_COLORS: Record<string, string> = {
  "Message Sent": "bg-indigo-500",
  "Reply Received": "bg-cyan-500",
  "Follow-up Sent": "bg-orange-400",
  "Call": "bg-violet-500",
  "Interview": "bg-teal-500",
  "Offer": "bg-green-500",
  "Rejection": "bg-red-500",
  "Note": "bg-gray-400",
  "Referral": "bg-blue-400",
};

export default async function ActivityPage() {
  const items = await getActivityTimeline(100);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Activity Timeline</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Chronological record of all your outreach interactions</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center border rounded-lg">
          <p className="text-muted-foreground">No activity yet. Start by logging an interaction on a contact's profile.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {items.map((item, i) => (
              <div key={item.id} className="relative flex gap-4 pl-14">
                <div className={`absolute left-3.5 top-1.5 h-3 w-3 rounded-full ring-2 ring-background ${TYPE_COLORS[item.headline] ?? "bg-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">{item.headline}</span>
                      {item.person_name && (
                        <Link href={`/people/${item.id}`} className="font-medium text-sm hover:text-primary truncate">
                          {item.person_name}
                        </Link>
                      )}
                      {item.company_name && <span className="text-xs text-muted-foreground shrink-0">· {item.company_name}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(item.ts)}</span>
                  </div>
                  {item.detail && <p className="text-sm text-muted-foreground mt-0.5">{item.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
