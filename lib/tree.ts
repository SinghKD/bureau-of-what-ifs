/**
 * Geometry for the divergence chart: your life as one amber line from BIRTH to
 * NOW, with a grey timeline peeling off at every year you record and never
 * coming back.
 *
 * ── Branches never cross, by construction ────────────────────────────────────
 * Collision detection after the fact does not converge, so crossing is made
 * impossible instead. The whole argument rests on one fact about the curve:
 *
 *   Every segment between two levels is the cubic `C x0 · x1 · x1`, so
 *   x(t) = x0 + (x1 - x0)·t²(3 - 2t) — the same normalised profile for every
 *   line, whatever its endpoints. Two lines sharing a level interval therefore
 *   satisfy a(t) - b(t) = (a0 - b0)(1 - f) + (a1 - b1)f, which cannot change
 *   sign if both endpoint differences share one. Ordering at the levels is
 *   ordering everywhere.
 *
 * So the whole job is ordering the lines at each of the six levels:
 *
 *   1. The lines are kept in one fixed left-to-right order. A new branch is
 *      inserted immediately beside its parent, on the side it leaves towards,
 *      so a later sibling always lands between the parent and an earlier one —
 *      which is right anyway, since a later divergence has had less time to
 *      travel and belongs nearer the trunk.
 *   2. Each line is given a lane — a final resting x — assigned by walking that
 *      order outward from the centre, so lanes are ordered by construction and
 *      spaced by how many levels the line has to reach them in.
 *   3. A line curls towards its lane with a step that decays 25% per level, so
 *      it leaves the trunk at an angle and flattens out rather than turning a
 *      right angle at the node.
 *   4. At every level, `settle()` walks outward from the prime and pushes any
 *      line that has come within `GAPMIN` of its inward neighbour further out.
 *      A line still sitting on the node it was born at is an anchor: it is
 *      never pushed off its parent, and its parent is never pushed off it.
 *
 * `buildTree` is held to this in lib/__tests__/tree.test.ts, which reads the
 * emitted path data rather than any of the above.
 *
 * ── Growth is seamless, by construction ──────────────────────────────────────
 * The whole five-year tree is built once, from a fixed seed, and the levels are
 * six fixed slots. Committing an event does not recompute anything — it reveals
 * lines whose geometry was already decided. Each level interval is its own
 * <path>, so a new year appends elements and never edits one that is on screen.
 */
import { mulberry32 } from "./roll";

/* ------------------------------------------------------------------ frame */
export const VW = 344;
export const VH = 472;
const XL = 44; // right of the year gutter
const XR = 332;
const XC = (XL + XR) / 2;
export const YB = 400; // birth
export const YT = 26; // now
export const LEVELS = 6; // five events plus a reserved slot of headroom
/* 6.5 gaps, so the top slot keeps half a gap of clear air under NOW */
const GAP = (YB - YT) / 6.5;
export const levelY = (i: number) => YB - GAP * (i + 1);

export const RULE = 430; // the legend's hairline

/* ------------------------------------------------------------- generation */
const SEED = 20773;
const MAXGEN = 3;
const MAXLINES = 12;
const PRIME_HALF = 12; // the prime drifts, but only inside this
const DECAY = 0.75; // each level turns ~25% less than the last, so lines curl
const SPLIT = [0, 0.5, 0.3, 0]; // chance a grey line forks, by generation
const OUTWARD = 0.7; // a grey fork prefers to keep fanning outward
const WILD = 0.25; // ...and this often the side weighting is ignored entirely
const LANE = 50; // nominal lane spacing — above the frame’s budget on purpose,
// so the scale factor below binds and the fan reaches the edges rather than
// huddling round the trunk
const GAPMIN = 9; // the closest two lines ever come away from a node
const MARGIN = 8; // clear air inside the frame
const SWAY = 0.45; // most of its own gap a line may sway across, never all

/* taper and fade with depth */
export const WIDTH = [1.6, 0.95, 0.73, 0.51];
export const FADE = [0.95, 0.62, 0.46, 0.32];

export const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Asymptotic containment. tanh never reaches ±1, so the result is always
 * strictly inside (lo, hi) — the prime eases away from the edge of its corridor
 * rather than hitting a clamp.
 */
function soft(v: number, lo: number, hi: number) {
  const m = (lo + hi) / 2;
  const r = (hi - lo) / 2;
  if (r <= 0) return m;
  return m + r * Math.tanh((v - m) / r);
}

type Side = -1 | 1;

type Line = {
  id: string;
  gen: number;
  /** level it leaves its parent at; -1 for the prime, which starts at birth */
  spawn: number;
  side: Side | 0;
  /** which half of the chart it lives in — set by its gen-1 ancestor */
  half: Side | 0;
  parent: Line | null;
  /** how far out its lane sits relative to its inward neighbour */
  mag: number;
  /** the width of that offset — the room this line has to sway in */
  gap: number;
  /** the same, in frame units, once the lanes have been scaled to fit */
  gapPx: number;
  lane: number;
  /** current horizontal step, decaying each level */
  step: number;
  x: number[];
  xTop: number;
};

export type Seg = {
  id: string;
  d: string;
  gen: number;
  /** visible once this many events are recorded */
  at: number;
  /** how far up the line from its node, for the stagger */
  step: number;
};

export type Tree = { segs: Seg[]; xBirth: number; xNow: number; primeX: number[] };

export type Build = {
  seed?: number;
  /**
   * One value in -1..1 per level: how far the lines born at that year pull in
   * towards the trunk. A divergence is shaped by the words that caused it, so
   * this comes from the text of the row — which means a row still being typed
   * keeps adjusting its branch, and a row that commits does not move, because
   * the text it commits is the text it was already answering to.
   */
  sways?: number[];
};

export function buildTree({ seed = SEED, sways = [] }: Build = {}): Tree {
  const rnd = mulberry32(seed);
  const prime: Line = {
    id: "p",
    gen: 0,
    spawn: -1,
    side: 0,
    half: 0,
    parent: null,
    mag: 1,
    gap: 0,
    gapPx: 0,
    lane: XC,
    step: 0,
    x: [],
    xTop: 0,
  };
  /* the fixed left-to-right order — the only thing that has to hold */
  const order: Line[] = [prime];

  /* ---- shape, level by level, so "which side is heavier" means something
     chronologically. Nothing is placed yet. */
  const mass = { l: 0, r: 0 };
  for (let l = 0; l < LEVELS - 1; l++) {
    for (const L of [...order]) {
      if (L.spawn >= l || L.gen >= MAXGEN || order.length >= MAXLINES) continue;
      if (L.gen > 0 && rnd() >= SPLIT[L.gen]) continue;

      let side: Side;
      if (L.gen === 0) {
        // the only choice that moves weight between the halves of the chart
        const sum = mass.l + mass.r;
        const left = rnd() < WILD ? 0.5 : sum === 0 ? 0.5 : mass.r / sum;
        side = rnd() < left ? -1 : 1;
      } else {
        side = rnd() < OUTWARD ? (L.side as Side) : ((-L.side) as Side);
      }

      // a fork stays beside its parent, so it never changes chart half
      const half = L.gen === 0 ? side : (L.half as Side);
      const kid: Line = {
        id: `${L.id}.${l}`,
        gen: L.gen + 1,
        spawn: l,
        side,
        half,
        parent: L,
        mag: 0.75 + 0.55 * rnd(),
        gap: 0,
        gapPx: 0,
        lane: 0,
        step: 0,
        x: [],
        xTop: 0,
      };
      // beside its parent, on the side it leaves towards: a later sibling
      // therefore falls between the parent and an earlier one
      order.splice(order.indexOf(L) + (side < 0 ? 0 : 1), 0, kid);
      if (half < 0) mass.l += 1 / kid.gen;
      else mass.r += 1 / kid.gen;
    }
  }

  /* ---- lanes, walking that order outward from the centre. A line spawning
     late gets a lane close to its inward neighbour: it has fewer levels to
     reach it in, and a long reach in two levels reads as a right angle. */
  const p = order.indexOf(prime);
  const span = (L: Line) => LANE * L.mag * (0.4 + (0.6 * (LEVELS - 1 - L.spawn)) / (LEVELS - 1));
  const reach = (from: number, dir: 1 | -1) => {
    let d = 0;
    for (let i = from; i >= 0 && i < order.length; i += dir) {
      order[i].gap = span(order[i]);
      d += order[i].gap;
      order[i].lane = d;
    }
    return d;
  };
  const dR = reach(p + 1, 1);
  const dL = reach(p - 1, -1);
  const kR = Math.min(1, (XR - MARGIN - XC) / (dR || 1));
  const kL = Math.min(1, (XC - XL - MARGIN) / (dL || 1));
  /* A sway pulls a limb — the line born at that year and every fork hanging off
     it — in towards the trunk. Every line in the limb moves by the *same*
     absolute amount, capped at a fraction of the narrowest lane gap inside it.
     That cap is what confines the effect to the limb: a line only ever moves
     inward, so the neighbour outside it gains room rather than losing it, and
     `settle()` can push the limb back out only as far as its canonical lane.
     Type into row 3 and row 3's branch moves; nothing else does. */
  const chain = (L: Line): number[] =>
    L.parent ? [...chain(L.parent), L.spawn] : L.spawn >= 0 ? [L.spawn] : [];
  const chains = new Map(order.map((L) => [L, chain(L)]));
  const room = new Map<number, number>();
  for (let lvl = 0; lvl < LEVELS - 1; lvl++) {
    const limb = order.filter((L) => chains.get(L)!.includes(lvl));
    if (limb.length) room.set(lvl, Math.min(...limb.map((L) => L.gap)));
  }
  const pull = (L: Line) =>
    chains
      .get(L)!
      .reduce(
        (a, lvl) =>
          a + SWAY * (room.get(lvl) ?? 0) * (1 - Math.max(-1, Math.min(1, sways[lvl] ?? 1))) * 0.5,
        0,
      );
  for (let i = 0; i < order.length; i++) {
    if (i === p) continue;
    const d = order[i].lane - pull(order[i]);
    const k = i > p ? kR : kL;
    order[i].gapPx = order[i].gap * k;
    order[i].lane = i > p ? XC + d * k : XC - d * k;
  }

  /* ---- placement, one level at a time: advance, settle, then hang the new
     branches on their nodes */
  const live = (L: Line, l: number) => L.spawn <= l;
  const settle = (l: number, get: (L: Line) => number, set: (L: Line, v: number) => void) => {
    const walk = (from: number, dir: 1 | -1) => {
      let prev: Line = prime;
      for (let i = from; i >= 0 && i < order.length; i += dir) {
        const L = order[i];
        if (!live(L, l)) continue;
        // a line still sitting on the node it was born at is an anchor: it is
        // never pushed off its parent, and its parent is never pushed off it
        const joined =
          (L.spawn === l && L.parent === prev) || (prev.spawn === l && prev.parent === L);
        if (L.spawn < l && !joined) {
          const edge = get(prev) + dir * GAPMIN;
          set(L, dir > 0 ? Math.max(get(L), edge) : Math.min(get(L), edge));
        }
        prev = L;
      }
    };
    walk(p + 1, 1);
    walk(p - 1, -1);
  };

  let drift = 0;
  for (let l = 0; l < LEVELS; l++) {
    for (const L of order) {
      if (L.spawn >= l) continue;
      if (L.gen === 0) {
        drift += (rnd() - 0.5) * 5.5;
        L.x[l] = soft(XC + drift, XC - PRIME_HALF, XC + PRIME_HALF);
      } else {
        L.x[l] = L.x[l - 1] + L.step;
        L.step *= DECAY;
      }
    }
    for (const L of order) {
      if (L.spawn !== l) continue;
      L.x[l] = L.parent!.x[l];
      // a geometric series decaying by DECAY that sums to exactly the distance
      // left to the lane, so it arrives at the top slot without a correction
      const m = LEVELS - 1 - l;
      L.step = m === 0 ? 0 : ((L.lane - L.x[l]) * (1 - DECAY)) / (1 - Math.pow(DECAY, m));
    }
    settle(
      l,
      (L) => L.x[l],
      (L, v) => (L.x[l] = v),
    );
  }
  const top = LEVELS - 1;
  drift += (rnd() - 0.5) * 5.5;
  for (const L of order) {
    /* The run to NOW covers half a level, so it turns half as much — but capped
       by the line's own lane width. Uncapped, a line with a long stride splays
       further at the top than its neighbour and `settle()` starts stacking the
       row, which chains one line's movement onto the next. Capped, the top row
       inherits the order and the spacing of the row below it. */
    const over = Math.sign(L.step) * Math.min(Math.abs(L.step * 0.5), L.gapPx * 0.3);
    L.xTop =
      L.gen === 0 ? soft(XC + drift, XC - PRIME_HALF, XC + PRIME_HALF) : L.x[top] + over;
  }
  settle(
    top,
    (L) => L.xTop,
    (L, v) => (L.xTop = v),
  );

  /* ---- segments, one per level interval, so growth only ever appends */
  const segs: Seg[] = [];
  const curve = (x0: number, y0: number, x1: number, y1: number) => {
    const k = (y0 - y1) * 0.42;
    return `M${r2(x0)} ${r2(y0)}C${r2(x0)} ${r2(y0 - k)} ${r2(x1)} ${r2(y1 + k)} ${r2(x1)} ${r2(y1)}`;
  };

  for (const L of order) {
    let n = 0;
    const push = (x0: number, y0: number, x1: number, y1: number) => {
      segs.push({
        id: `${L.id}:${n}`,
        d: curve(x0, y0, x1, y1),
        gen: L.gen,
        at: L.spawn + 1,
        step: n++,
      });
    };
    if (L.gen === 0) push(XC, YB, L.x[0], levelY(0));
    for (let l = Math.max(L.spawn, 0); l < top; l++) {
      push(L.x[l], levelY(l), L.x[l + 1], levelY(l + 1));
    }
    push(L.x[top], levelY(top), L.xTop, YT);
  }

  return { segs, xBirth: XC, xNow: prime.xTop, primeX: prime.x };
}
