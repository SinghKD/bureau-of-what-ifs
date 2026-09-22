import { describe, expect, it } from "vitest";
import { seedFrom, rollBranches, factsFor, describeBranch } from "../roll";
import { extractJSON } from "../json";
import type { Ev } from "../types";

const events: Ev[] = [
  { id: "e1", year: "2009", text: "played bass, quit before the final show" },
  { id: "e2", year: "2014", text: "took a job in a city I'd never visited" },
  { id: "e3", year: "2016", text: "stopped talking to a friend over something stupid" },
  { id: "e4", year: "2019", text: "ate the same lunch every day for two years" },
  { id: "e5", year: "2021", text: "almost signed a lease near the water" },
];

describe("seedFrom", () => {
  it("is stable across key order and whitespace", () => {
    const a = seedFrom({ birth_year: "1994", grew_up: "Pune" }, events);
    const b = seedFrom({ grew_up: " pune ", birth_year: "1994" }, events);
    expect(a).toBe(b);
  });

  it("changes when an answer changes", () => {
    const a = seedFrom({ grew_up: "Pune" }, events);
    const b = seedFrom({ grew_up: "Nashik" }, events);
    expect(a).not.toBe(b);
  });
});

describe("rollBranches", () => {
  it("is deterministic for a seed", () => {
    const seed = seedFrom({}, events);
    expect(rollBranches(events, seed)).toEqual(rollBranches(events, seed));
  });

  it("never rolls two negations onto one branch", () => {
    for (let s = 0; s < 200; s++) {
      for (const b of rollBranches(events, s)) {
        const negs = b.ops.filter((o) => o.operator === "NEGATE").length;
        expect(negs).toBeLessThan(2);
      }
    }
  });

  it("covers all three roles and never bends one event twice", () => {
    const bs = rollBranches(events, 42);
    expect(new Set(bs.map((b) => b.role))).toEqual(new Set(["near", "far", "parallel"]));
    for (const b of bs) expect(b.ops[0].event).not.toBe(b.ops[1].event);
  });
});

describe("factsFor", () => {
  it("computes ages so the model never has to", () => {
    const f = factsFor({ birth_year: "1994" }, events);
    expect(f.ages_at_events["2014"]).toBe(20);
    expect(f.current_age).toBe(new Date().getFullYear() - 1994);
  });

  it("returns nulls rather than guesses when birth year is blank", () => {
    const f = factsFor({}, events);
    expect(f.current_age).toBeNull();
    expect(f.ages_at_events["2014"]).toBeNull();
  });
});

describe("describeBranch", () => {
  it("lists negated events explicitly", () => {
    const b = { id: "b1", role: "near" as const, ops: [
      { event: "e2", operator: "NEGATE" },
      { event: "e4", operator: "PERSIST" },
    ]};
    const d = describeBranch(b, events);
    expect(d.ledger).toHaveLength(1);
    expect(d.ledger[0]).toContain("DID NOT HAPPEN");
  });
});

describe("extractJSON", () => {
  it("survives preambles and fences", () => {
    expect(extractJSON('I need to say: {"a":1}')).toBe('{"a":1}');
    expect(extractJSON('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJSON("no object here")).toBeNull();
  });
});

describe("divergence year", () => {
  const evs: Ev[] = [
    { id: "e1", year: "2001", text: "a" },
    { id: "e2", year: "2017", text: "b" },
    { id: "e3", year: "", text: "undated" },
  ];

  it("is the earliest year the branch actually bends", () => {
    const b = {
      id: "b1",
      role: "near" as const,
      ops: [
        { event: "e2", operator: "NEGATE" },
        { event: "e1", operator: "PERSIST" },
      ],
    };
    expect(describeBranch(b, evs).divergence_year).toBe(2001);
  });

  it("ignores events with no year, and gives null when none are dated", () => {
    const dated = {
      id: "b2",
      role: "far" as const,
      ops: [
        { event: "e3", operator: "NEGATE" },
        { event: "e2", operator: "SHIFT" },
      ],
    };
    expect(describeBranch(dated, evs).divergence_year).toBe(2017);

    const none = {
      id: "b3",
      role: "far" as const,
      ops: [{ event: "e3", operator: "NEGATE" }],
    };
    expect(describeBranch(none, evs).divergence_year).toBeNull();
  });

  it("agrees with the years it reports in its own changes", () => {
    for (const b of rollBranches(evs, 12345, 9)) {
      const d = describeBranch(b, evs);
      const years = d.changes.map((c) => Number(c.year)).filter((y) => y > 0);
      if (years.length) expect(d.divergence_year).toBe(Math.min(...years));
      else expect(d.divergence_year).toBeNull();
    }
  });
});
