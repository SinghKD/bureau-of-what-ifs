import { describe, expect, it } from "vitest";
import { LEVELS, buildTree } from "../tree";

/**
 * These read the emitted path data rather than the internals, so they test what
 * is actually drawn. Every segment is `M x0 y0 C x0 · x1 · x1`, so x(t) is the
 * cubic through those four control points and y(t) is identical for every
 * segment sharing a level interval — comparing two segments at equal t is
 * therefore comparing them at equal y.
 */
const nums = (d: string) => d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);

function seg(d: string) {
  const [x0, y0, c1x, , c2x, , x1, y1] = nums(d);
  return {
    y0,
    y1,
    at: (t: number) => {
      const u = 1 - t;
      return u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1;
    },
  };
}

/** a handful of sway vectors, including every level swaying at once */
const VECTORS = [
  [],
  [1, 1, 1, 1, 1],
  [-1, -1, -1, -1, -1],
  [0, -1, 0.4, -0.6, 1],
  [-0.9, 0.3, -1, 0.8, -0.2],
];

const visible = (n: number, sways: number[] = []) =>
  buildTree({ sways })
    .segs.filter((s) => s.at <= n)
    .map((s) => ({ ...seg(s.d), id: s.id }));

describe("divergence chart", () => {
  it("is identical on every build", () => {
    expect(buildTree().segs).toEqual(buildTree().segs);
  });

  it("never lets two lines cross, at any number of events or sway", () => {
    for (let n = 0; n <= LEVELS - 1; n++) {
      for (const sways of VECTORS) {
        // group by level interval; only segments sharing one can meet at all
        const bands = new Map<string, ReturnType<typeof visible>>();
        for (const s of visible(n, sways)) {
          const k = `${s.y0}|${s.y1}`;
          bands.set(k, [...(bands.get(k) ?? []), s]);
        }
        for (const [, group] of bands) {
          for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
              const signs = new Set<number>();
              for (let t = 0; t <= 1.0001; t += 0.01) {
                const d = group[i].at(t) - group[j].at(t);
                // they may share the node they diverge from, and only that
                if (Math.abs(d) > 1e-9) signs.add(Math.sign(d));
              }
              expect(
                signs.size,
                `${group[i].id} crosses ${group[j].id} at ${n} events, sways ${sways}`,
              ).toBeLessThan(2);
            }
          }
        }
      }
    }
  });

  it("moves only the limb whose row is being typed", () => {
    /* A line's id is the chain of levels it was born through — `p.1.2` left the
       prime at level 1 and forked at level 2 — so a limb is every line whose
       chain contains that level. A fork hangs off its parent's node, so it has
       to travel with it; nothing outside the limb may move at all. And while
       the newest row is being typed its limb has no forks yet, so only the one
       line moves. */
    const limb = (id: string, lvl: number) =>
      id.split(".").slice(1).map(Number).includes(lvl);

    for (let lvl = 0; lvl < LEVELS - 1; lvl++) {
      for (const base of VECTORS) {
        const fixed = new Map(
          buildTree({ sways: base })
            .segs.filter((x) => !limb(x.id.split(":")[0], lvl))
            .map((x) => [x.id, x.d]),
        );
        expect(fixed.size).toBeGreaterThan(0);
        for (const v of [-1, -0.5, 0, 0.5, 1]) {
          const next = [...base];
          next[lvl] = v;
          for (const x of buildTree({ sways: next }).segs) {
            if (fixed.has(x.id)) {
              expect(x.d, `${x.id} moved when level ${lvl} swayed to ${v}`).toBe(fixed.get(x.id));
            }
          }
        }
      }
    }
  });

  it("actually reshapes a line when its own row sways", () => {
    const at = (v: number) => {
      const sways: number[] = [1, 1, v, 1, 1];
      return buildTree({ sways }).segs.filter((x) => x.at === 3).map((x) => x.d);
    };
    expect(at(1)).not.toEqual(at(-1));
  });

  it("never moves anything already drawn when an event is added", () => {
    const all = buildTree().segs;
    for (let n = 1; n <= LEVELS - 1; n++) {
      const before = new Map(all.filter((s) => s.at <= n - 1).map((s) => [s.id, s.d]));
      for (const s of all.filter((s) => s.at <= n)) {
        if (before.has(s.id)) expect(s.d).toBe(before.get(s.id));
      }
      // and the new year does bring something with it
      expect(all.some((s) => s.at === n)).toBe(true);
    }
  });

  it("fans to both sides without mirroring", () => {
    const { segs, primeX } = buildTree();
    const side = (s: (typeof segs)[number]) => Math.sign(seg(s.d).at(1) - primeX[0]);
    const grey = segs.filter((s) => s.gen > 0);
    expect(grey.some((s) => side(s) < 0)).toBe(true);
    expect(grey.some((s) => side(s) > 0)).toBe(true);
    // a mirror would put the same count on both sides at every level
    const byLevel = new Map<number, number>();
    for (const s of grey) byLevel.set(s.at, (byLevel.get(s.at) ?? 0) + side(s));
    expect([...byLevel.values()].some((v) => v !== 0)).toBe(true);
  });

  it("splits branches off branches", () => {
    expect(buildTree().segs.some((s) => s.gen > 1)).toBe(true);
  });
});
