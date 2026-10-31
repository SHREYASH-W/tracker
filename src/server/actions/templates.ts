"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { messageTemplates } from "@/db/schema";
import { eq, like, or } from "drizzle-orm";
import { templateSchema } from "@/lib/validators";
import type { ActionResult } from "@/lib/types";

export async function getTemplates(category?: string) {
  if (category && category !== "all") {
    return db.select().from(messageTemplates)
      .where(eq(messageTemplates.category, category))
      .orderBy(messageTemplates.name);
  }
  return db.select().from(messageTemplates).orderBy(messageTemplates.category, messageTemplates.name);
}

export async function getTemplate(id: number) {
  const rows = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createTemplate(formData: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = templateSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", error: parsed.error.errors[0]?.message };
  }
  const data = parsed.data;
  const result = await db.insert(messageTemplates).values({
    name: data.name,
    category: data.category,
    subject: data.subject || null,
    body: data.body,
  }).returning({ id: messageTemplates.id });

  revalidatePath("/templates");
  return { success: true, message: "Template created", data: { id: result[0]!.id } };
}

export async function updateTemplate(id: number, formData: unknown): Promise<ActionResult> {
  const parsed = templateSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", error: parsed.error.errors[0]?.message };
  }
  const data = parsed.data;
  await db.update(messageTemplates).set({
    name: data.name,
    category: data.category,
    subject: data.subject || null,
    body: data.body,
    updatedAt: Date.now(),
  }).where(eq(messageTemplates.id, id));

  revalidatePath("/templates");
  return { success: true, message: "Template updated" };
}

export async function deleteTemplate(id: number): Promise<ActionResult> {
  await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
  revalidatePath("/templates");
  return { success: true, message: "Template deleted" };
}

/** Fill template variables with real values. */
export async function previewTemplate(
  body: string,
  vars: { name?: string; company?: string; role?: string; myBackground?: string },
): Promise<string> {
  return body
    .replace(/\{\{name\}\}/g, vars.name ?? "[Name]")
    .replace(/\{\{company\}\}/g, vars.company ?? "[Company]")
    .replace(/\{\{role\}\}/g, vars.role ?? "[Role]")
    .replace(/\{\{my_background\}\}/g, vars.myBackground ?? "[Your background]");
}
