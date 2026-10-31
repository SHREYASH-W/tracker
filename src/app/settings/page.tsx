import { getLlmStatus } from "@/server/llm";
import { getProviderUsage } from "@/server/providers/usage";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const llm = getLlmStatus();
  const usage = await getProviderUsage();
  return <SettingsClient llm={llm} usage={usage} />;
}
