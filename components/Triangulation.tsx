"use client";

/**
 * Five stations take bearings on the subject's position. Each screen answered
 * swings one needle onto target and narrows its corridor; the region is the
 * intersection of every corridor acquired so far, and the last one closes it to
 * a point.
 *
 * Two decisions carry the whole thing:
 *
 * - Corridor half-widths tighten station to station (26° → 4°). With uniformly
 *   narrow corridors the first bearing pins the position to a sliver and the
 *   remaining four change nothing you can see, so no station appears to matter.
 *   Staged precision means every bearing takes a real bite. It happens to be
 *   true of the questions too: a birth year constrains less than what you do.
 *
 * - A station's half-width is a function of how many of its fields were
 *   answered, and a screen left blank never acquires at all. So the final region
 *   is an honest measure of how much was given, and a half-answered profile
 *   visibly fails to resolve. Nothing is clamped to a flattering number.
 *
 * Everything is derived from `profile`. The animation loop mutates SVG
 * attributes directly rather than going through React, so the eased motion costs
 * no re-renders.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { mulberry32 } from "@/lib/roll";
import { SCREENS } from "@/lib/content";
import type { Profile } from "@/lib/types";

const VW = 320;
const VH = 340;
const FX = 158;
const FY = 172;
const RMAX = 208; // the unconstrained region, and the binary-search ceiling
const NA = 72; // sample angles around the fix
const NCAND = 70;
const SEED = 8531;

const DEG = Math.PI / 180;
/**
 * Tightest half-width per station, in radians — the staged precision.
 *
 * One station per questionnaire section, and the questionnaire is four sections.
 * The canon events are a separate stage, not part of it, so the fix closes at the
 * end of section 04.
 */
const TIGHT = [26, 14, 9, 2.15].map((d) => d * DEG);
/** How sharply the corridor closes over a section's fields. Under 1, so the
 *  first answer of a section takes the biggest bite. */
const CLOSE = 0.85;
/**
 * A ceiling on the corridor, so a barely-answered section still reads as a beam.
 * Uncapped it reaches 130deg of half-width — geometrically honest, but 260deg of
 * spread is a wash across the whole frame, not a bearing.
 */
const HMAX = 55 * (Math.PI / 180);

export type Station = { x: number; y: number; bearing: number; label: string };

export const STATIONS: Station[] = (() => {
  const rnd = mulberry32(SEED);
  return Array.from({ length: TIGHT.length }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / TIGHT.length + (rnd() - 0.5) * 0.55;
    const R = 152 + (rnd() - 0.5) * 26;
    const x = FX + Math.cos(a) * R;
    const y = FY + Math.sin(a) * R;
    // a small fixed error, so the corridors do not all pass exactly through one
    // point and the region has a real shape
    const bearing = Math.atan2(FY - y, FX - x) + (rnd() - 0.5) * 0.055;
    return { x, y, bearing, label: String(i + 1).padStart(2, "0") };
  });
})();

type Live = { x: number; y: number; bearing: number; h: number };

const wrap = (d: number) => Math.atan2(Math.sin(d), Math.cos(d));

function inside(live: Live[], px: number, py: number) {
  for (const s of live) {
    if (Math.abs(wrap(Math.atan2(py - s.y, px - s.x) - s.bearing)) > s.h) return false;
  }
  return true;
}

/**
 * Radial sampling: from the fix, binary search outward for the last radius still
 * inside every corridor. The region is convex and the fix is inside it, so this
 * is exact rather than an approximation.
 */
function boundary(live: Live[], n = NA, iters = 20) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const cx = Math.cos(th);
    const cy = Math.sin(th);
    if (!live.length || inside(live, FX + cx * RMAX, FY + cy * RMAX)) {
      out[i] = RMAX;
      continue;
    }
    let lo = 0;
    let hi = RMAX;
    for (let k = 0; k < iters; k++) {
      const mid = (lo + hi) / 2;
      if (inside(live, FX + cx * mid, FY + cy * mid)) lo = mid;
      else hi = mid;
    }
    out[i] = lo;
  }
  return out;
}

function area(r: ArrayLike<number>) {
  const step = (Math.PI * 2) / NA;
  let a = 0;
  for (let i = 0; i < NA; i++) a += 0.5 * r[i] * r[(i + 1) % NA] * Math.sin(step);
  return a;
}

/** The reference the readout is a percentage of: station 01 alone, fully answered. */
const REF_AREA = area(boundary([{ ...STATIONS[0], h: TIGHT[0] }]));

const pts = (r: ArrayLike<number>, n = NA) => {
  let s = "";
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    s += `${(FX + Math.cos(th) * r[i]).toFixed(1)},${(FY + Math.sin(th) * r[i]).toFixed(1)} `;
  }
  return s.trim();
};

/** Corridor widths, derived from how much of each section was answered. */
export function liveStations(profile: Profile): Live[] {
  const answered = SCREENS.map((s) => ({
    done: s.fields.filter((f) => (profile[f.k] ?? "").trim()).length,
    total: s.fields.length,
  }));
  const out: Live[] = [];
  answered.forEach((sc, i) => {
    if (!sc.done || i >= STATIONS.length) return; // a blank screen never acquires
    /* Interpolated from the ceiling down to the station's tightest width, not
       scaled up from it and clamped. Scaled, a five-field section reached 130°,
       104° and 78° on its first three answers — all three past HMAX, all three
       drawn at the same 55°, so answers two and three moved nothing on screen.
       Interpolating keeps every answer inside the visible range: the beam takes
       a bite every single time, and a part-answered section still reads wide. */
    const frac = sc.done / sc.total;
    out.push({ ...STATIONS[i], h: TIGHT[i] + (HMAX - TIGHT[i]) * Math.pow(1 - frac, CLOSE) });
  });
  return out;
}

export function regionPercent(profile: Profile) {
  const live = liveStations(profile);
  if (!live.length) return 100;
  return Math.min(100, (area(boundary(live)) / REF_AREA) * 100);
}

/** Candidate variants, in viewBox space. Deterministic for a given seed. */
function scatter(seed: number) {
  const rnd = mulberry32(seed);
  return Array.from({ length: NCAND }, () => ({
    x: 18 + rnd() * (VW - 36),
    y: 18 + rnd() * (VH - 36),
  }));
}

/** How far outside every corridor a point sits; <= 0 means inside. */
function violation(live: Live[], px: number, py: number) {
  let worst = -Math.PI;
  for (const s of live) {
    worst = Math.max(worst, Math.abs(wrap(Math.atan2(py - s.y, px - s.x) - s.bearing)) - s.h);
  }
  return live.length ? worst : -Math.PI;
}

/**
 * The candidates still standing — what the sweep goes looking for. Ranked by how
 * little each violates the corridors rather than filtered by a hard inside test:
 * by the last screen the region is a few pixels across and a strict filter
 * returns nothing, leaving Sweep with no marks at all.
 */
export function survivors(profile: Profile, seed: number) {
  const live = liveStations(profile);
  return scatter(seed)
    .map((p) => ({ p, v: violation(live, p.x, p.y) }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 3)
    .map(({ p }) => ({ x: p.x / VW, y: p.y / VH }));
}

/** The ten station pairs, in a fixed order so the polygons keep stable keys. */
const PAIRS: [number, number][] = [];
for (let a = 0; a < STATIONS.length; a++)
  for (let b = a + 1; b < STATIONS.length; b++) PAIRS.push([a, b]);

export function Triangulation({
  profile,
  seed,
  instant = false,
}: {
  profile: Profile;
  seed: number;
  /** Start with the beams already at width — for a remount that should look
   *  like the same map continuing, not a new one growing in. */
  instant?: boolean;
}) {
  const live = useMemo(() => liveStations(profile), [profile]);
  const cand = useMemo(() => scatter(seed), [seed]);

  const fix = useRef<SVGCircleElement>(null);
  const pulse = useRef<SVGCircleElement>(null);
  const glow = useRef<SVGCircleElement>(null);
  const beams = useRef<(SVGPathElement | null)[]>([]);
  const cross = useRef<(SVGPolygonElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);

  const liveRef = useRef(live);
  liveRef.current = live;
  const candRef = useRef(cand);
  candRef.current = cand;

  /* Layout, not passive: `useEffect` runs after the browser has painted, so the
     first frame showed beams at opacity 0 and every candidate still at the
     origin. On a remount that reads as the map blinking out and rebuilding
     itself — which is exactly what it did on the way to the lock screen. */
  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // seeded at their targets, not at the origin: the easing below is for when
    // the scatter itself changes, not for arriving on screen
    const cx = new Float64Array(NCAND);
    const cy = new Float64Array(NCAND);
    candRef.current.forEach((p, i) => {
      cx[i] = p.x;
      cy[i] = p.y;
    });
    // beam half-widths ease toward target, so a beam narrows rather than snapping
    const hw = new Float64Array(STATIONS.length).fill(0);
    if (instant) liveRef.current.forEach((q) => {
      const i = STATIONS.findIndex((st) => st.x === q.x && st.y === q.y);
      if (i >= 0) hw[i] = q.h;
    });

    let signature = "";
    let locked = false;
    let lockAt = 0;
    let raf = 0;

    const byIndex = (l: Live[]) => {
      const m = new Array<Live | undefined>(STATIONS.length);
      l.forEach((q) => {
        const i = STATIONS.findIndex((s) => s.x === q.x && s.y === q.y);
        if (i >= 0) m[i] = q;
      });
      return m;
    };

    const NC = 40; // cheaper sampling for the ten crossing polygons

    const retarget = (now: number, m: (Live | undefined)[]) => {
      const sig = m.map((q) => (q ? q.h.toFixed(4) : "-")).join("|");
      if (sig === signature) return;
      signature = sig;
      const wasLocked = locked;
      // not m.every(Boolean): the array is built with holes and `every` skips
      // them, so an entirely empty one reports true and the prime reads as
      // located before a single question is answered
      locked = m.filter(Boolean).length === STATIONS.length;
      if (locked && !wasLocked) lockAt = now;
    };

    /**
     * The enclosed area where two beams cross.
     *
     * Built from the half-widths as they are *now*, not from their targets.
     * Targeting made the highlight appear at its final size the instant a section
     * changed — the area arriving before the beam that was supposed to create it.
     */
    const recross = () => {
      PAIRS.forEach(([a, b], k) => {
        const el = cross.current[k];
        if (!el) return;
        if (hw[a] <= 0.004 || hw[b] <= 0.004) {
          el.setAttribute("opacity", "0");
          return;
        }
        const qa = { ...STATIONS[a], h: hw[a] };
        const qb = { ...STATIONS[b], h: hw[b] };
        el.setAttribute("points", pts(boundary([qa, qb], NC, 14), NC));
        el.setAttribute("opacity", "1");
      });
    };

    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const m = byIndex(liveRef.current);
      retarget(now, m);

      let moving = false;
      STATIONS.forEach((s, i) => {
        const q = m[i];
        // the beam converges as the section is answered, and holds once it is done
        const wantH = q ? q.h : 0;
        if (Math.abs(wantH - hw[i]) > 1e-4) moving = true;
        hw[i] += (wantH - hw[i]) * (reduced ? 1 : 0.06);
        const el = beams.current[i];
        if (!el) return;
        if (hw[i] <= 0.002) {
          el.setAttribute("opacity", "0");
          return;
        }
        // A sector, not a triangle through the two edge points. A part-answered
        // section holds a corridor well past 90deg of half-width, and a triangle
        // whose edges are more than 180deg apart traces the wrong side of the
        // apex entirely — which is a beam pointing backwards.
        const L = 620;
        const a0 = s.bearing - hw[i];
        const a1 = s.bearing + hw[i];
        const x0 = (s.x + Math.cos(a0) * L).toFixed(1);
        const y0 = (s.y + Math.sin(a0) * L).toFixed(1);
        const x1 = (s.x + Math.cos(a1) * L).toFixed(1);
        const y1 = (s.y + Math.sin(a1) * L).toFixed(1);
        const big = hw[i] > Math.PI / 2 ? 1 : 0;
        el.setAttribute(
          "d",
          `M${s.x.toFixed(1)} ${s.y.toFixed(1)} L${x0} ${y0} A${L} ${L} 0 ${big} 1 ${x1} ${y1} Z`,
        );
        el.setAttribute("opacity", "1");
      });

      if (moving) recross();

      const c = candRef.current;
      for (let i = 0; i < NCAND; i++) {
        const p = c[i];
        const d = dots.current[i];
        if (!p || !d) continue;
        cx[i] += (p.x - cx[i]) * (reduced ? 1 : 0.06);
        cy[i] += (p.y - cy[i]) * (reduced ? 1 : 0.06);
        d.setAttribute("cx", cx[i].toFixed(1));
        d.setAttribute("cy", cy[i].toFixed(1));
      }

      // never perfectly still: two out-of-phase sines, sub-pixel
      const jx = reduced ? 0 : Math.sin(t * 1.7) * 0.6 + Math.sin(t * 0.9) * 0.35;
      const jy = reduced ? 0 : Math.cos(t * 1.3) * 0.6 + Math.sin(t * 2.1) * 0.3;
      if (fix.current) {
        fix.current.setAttribute("cx", (FX + jx).toFixed(2));
        fix.current.setAttribute("cy", (FY + jy).toFixed(2));
        // grey until the prime is actually located, then it is the one amber thing
        fix.current.setAttribute("fill", locked ? "var(--amber)" : "var(--bone)");
        fix.current.setAttribute("fill-opacity", locked ? "1" : "0.3");
        fix.current.setAttribute("r", locked ? "2.6" : "1.6");
      }

      if (glow.current) {
        const b = locked && !reduced ? 0.5 + 0.5 * Math.sin(t * 2.4) : locked ? 1 : 0;
        glow.current.setAttribute("opacity", (locked ? 0.18 + 0.3 * b : 0).toFixed(3));
        glow.current.setAttribute("r", (6 + b * 3.5).toFixed(2));
        glow.current.setAttribute("cx", (FX + jx).toFixed(2));
        glow.current.setAttribute("cy", (FY + jy).toFixed(2));
      }

      if (pulse.current) {
        if (locked && !reduced) {
          const k = ((now - lockAt) / 1800) % 1;
          pulse.current.setAttribute("r", (3 + k * 26).toFixed(1));
          pulse.current.setAttribute("opacity", (0.5 * (1 - k)).toFixed(3));
        } else {
          pulse.current.setAttribute("opacity", "0");
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw(t0); // once, synchronously, so the first painted frame is a real one
    return () => cancelAnimationFrame(raf);
  }, [instant]);

  return (
    <svg
      // padded rather than rescaled: the stations sit near the frame edge and
      // their labels overhang it
      viewBox="-22 -14 366 372"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      {STATIONS.map((_, i) => (
        <path
          key={`b${i}`}
          ref={(el) => {
            beams.current[i] = el;
          }}
          d=""
          fill="var(--lilac)"
          fillOpacity={0.07}
          stroke="var(--lilac)"
          strokeOpacity={0.3}
          strokeWidth={0.5}
          opacity={0}
          // a beam that is already at width has nothing to fade in from
          style={instant ? undefined : { transition: "opacity 700ms var(--ease)" }}
        />
      ))}

      {PAIRS.map((_, k) => (
        <polygon
          key={`x${k}`}
          ref={(el) => {
            cross.current[k] = el;
          }}
          points=""
          fill="var(--amber)"
          fillOpacity={0.07}
          stroke="none"
          opacity={0}
          // a beam that is already at width has nothing to fade in from
          style={instant ? undefined : { transition: "opacity 700ms var(--ease)" }}
        />
      ))}

      {Array.from({ length: NCAND }, (_, i) => (
        <circle
          key={`c${i}`}
          ref={(el) => {
            dots.current[i] = el;
          }}
          cx={cand[i]?.x.toFixed(1)}
          cy={cand[i]?.y.toFixed(1)}
          r={1.1}
          fill="var(--bone)"
          fillOpacity={0.22}
        />
      ))}

      {STATIONS.map((s, i) => (
        <g key={`s${i}`}>
          <circle cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={2.4} fill="var(--bone)" fillOpacity={0.5} />
          <text
            x={s.x.toFixed(1)}
            y={(s.y - 7).toFixed(1)}
            textAnchor="middle"
            className="year-label"
            fill="var(--faint)"
          >
            {s.label}
          </text>
        </g>
      ))}

      <circle ref={glow} cx={FX} cy={FY} r={6} fill="var(--amber)" opacity={0} />
      <circle ref={pulse} cx={FX} cy={FY} r={3} fill="none" stroke="var(--amber)" strokeWidth={0.8} opacity={0} />
      <circle ref={fix} cx={FX} cy={FY} r={1.6} fill="var(--bone)" fillOpacity={0.3} />
    </svg>
  );
}
