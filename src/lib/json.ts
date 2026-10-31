/**
 * Parse JSON that may be wrapped in markdown fences or surrounded by prose.
 * Returns null when no JSON object can be recovered.
 */
export function parseJsonLoose(text: string): unknown | null {
  if (!text?.trim()) return null;

  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
