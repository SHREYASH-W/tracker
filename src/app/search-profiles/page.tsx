import { listSearchProfiles } from "@/server/search-profiles/repository";
import { SearchProfilesClient } from "./search-profiles-client";

export const dynamic = "force-dynamic";

export default async function SearchProfilesPage() {
  const profiles = await listSearchProfiles();
  return <SearchProfilesClient profiles={profiles} />;
}
