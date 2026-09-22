/**
 * Pure, deterministic pre-model work: seeding, operator rolls, and the facts
 * block. Everything here is unit-tested — the model never does arithmetic and
 * never chooses which events to bend.
 */
import type { Ev, Profile, Role } from "./types";

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same answers always produce the same multiverse. */
export function seedFrom(profile: Profile, events: Ev[]): number {
  const norm = JSON.stringify({
    p: Object.entries(profile)
      .filter(([, v]) => v?.trim())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, v.trim().toLowerCase()]),
    e: events.map((x) => [x.year, x.text.trim().toLowerCase()]),
  });
  let h = 2166136261;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const OPERATORS = [
  ...Array(3).fill("PERSIST"),
  ...Array(3).fill("NEGATE"),
  ...Array(2).fill("INVERT"),
  ...Array(2).fill("TRANSPOSE"),
  ...Array(2).fill("SHIFT"),
  "AMPLIFY",
  "LITERALIZE",
] as const;

export const ROLES: Role[] = ["near", "far", "parallel"];

export type Branch = {
  id: string;
  role: Role;
  ops: { event: string; operator: string }[];
};

export function rollBranches(events: Ev[], seed: number, n = 9): Branch[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
  const out: Branch[] = [];
  let guard = 0;

  while (out.length < n && guard++ < 400) {
    const role = ROLES[out.length % ROLES.length];
    const half = Math.ceil(events.length / 2);
    // near diverges late, far and parallel diverge early
    const pool =
      role === "near" ? events.slice(Math.floor(events.length / 2)) : events.slice(0, half);
    const a = pick(pool);
    if (!a) break;
    const rest = events.filter((e) => e.id !== a.id);
    const b = pick(rest);
    if (!b) break;
    const opA = pick(OPERATORS as unknown as string[]);
    const opB = pick(OPERATORS as unknown as string[]);
    // two negations produce an absence, not a life
    if (opA === "NEGATE" && opB === "NEGATE") continue;
    out.push({
      id: `b${out.length + 1}`,
      role,
      ops: [
        { event: a.id, operator: opA },
        { event: b.id, operator: opB },
      ],
    });
  }
  return out;
}

/** Ages are computed here so the model is never asked to do date maths. */
export function factsFor(profile: Profile, events: Ev[]) {
  const currentYear = new Date().getFullYear();
  const birth = Number(profile.birth_year) || null;
  const age = (y: number | null) => (birth && y ? y - birth : null);
  return {
    current_year: currentYear,
    current_age: age(currentYear),
    ages_at_events: Object.fromEntries(
      events.filter((e) => e.year).map((e) => [e.year, age(Number(e.year))]),
    ),
    note: "Use these numbers exactly. Do not compute or estimate any other age.",
  };
}

/** Expands a branch into readable changes plus an explicit did-not-happen ledger. */
export function describeBranch(b: Branch, events: Ev[]) {
  const byId = Object.fromEntries(events.map((e) => [e.id, e]));
  const years = b.ops.map((o) => Number(byId[o.event]?.year)).filter((y) => y > 0);
  return {
    ...b,
    /**
     * The first year this branch touches. Derived, never asked for: the map and
     * the author are separate calls, so a year each of them chooses for itself
     * is a year they can disagree about — and did, a card reading "diverged
     * 2001" above a sentence beginning "In 2023". The branch already names the
     * events it bends, so the year was never the model's to pick.
     */
    divergence_year: years.length ? Math.min(...years) : null,
    changes: b.ops.map((o) => ({
      year: byId[o.event]?.year,
      event: byId[o.event]?.text,
      operator: o.operator,
    })),
    ledger: b.ops
      .filter((o) => o.operator === "NEGATE")
      .map((o) => `DID NOT HAPPEN: ${byId[o.event]?.text}`),
  };
}
