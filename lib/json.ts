/**
 * Pulling JSON out of a reply that may have a preamble, a fence, or both.
 * Pure and testable — kept out of the server-only client on purpose.
 */
export function extractJSON(text: string): string | null {
  const t = String(text).trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : t;
  const a = body.indexOf("{");
  const b = body.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;
  return body.slice(a, b + 1);
}

export function tryParse<T>(text: string): T | null {
  const c = extractJSON(text);
  if (!c) return null;
  try {
    return JSON.parse(c) as T;
  } catch {
    return null;
  }
}
