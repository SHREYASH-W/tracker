import { getTemplates } from "@/server/actions/templates";
import { TemplatesClient } from "./templates-client";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await getTemplates();
  return <TemplatesClient templates={templates} />;
}
