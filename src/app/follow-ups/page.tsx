import { getFollowUps } from "@/server/actions/outreach";
import { FollowUpsClient } from "./follow-ups-client";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const data = await getFollowUps();
  return <FollowUpsClient data={data} />;
}
