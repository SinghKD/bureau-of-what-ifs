/**
 * Deliberately minimal: an in-memory sliding window, per IP.
 *
 * This only holds within a single warm instance, so it is a speed bump rather
 * than a guarantee — serverless will run several instances under load. It is
 * enough to stop a stuck client hammering the endpoint. Before this URL is
 * shared anywhere public, move the counter to Upstash or equivalent.
 */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const hits = new Map<string, number[]>();

export function ipFrom(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function allow(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    hits.set(ip, recent);
    return { ok: false, retryAfter };
  }

  recent.push(now);
  hits.set(ip, recent);

  // opportunistic cleanup so the map cannot grow without bound
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    }
  }
  return { ok: true, retryAfter: 0 };
}
