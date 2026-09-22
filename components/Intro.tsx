"use client";

/**
 * The intro network. A short stem lifts off the bottom of the frame, splits into
 * a wide branching field, one amber path stays lit when the rest dim, and then
 * the whole thing travels down and across to become the mark beside the wordmark.
 *
 * Three things here are load-bearing:
 *
 * - One SVG, mounted once. The shrink is a transform, not a swap between a big
 *   tree and a small one. Remounting would restart every draw animation and the
 *   object would visibly flicker mid-move.
 *
 * - The SVG box is a child of the mark slot, and the shrink is expressed
 *   relative to that slot. Measuring where the slot sits and animating to those
 *   coordinates looks equivalent and is not: it is a snapshot, and the layout
 *   moves afterwards. A web font landing late reflows the heading, the stage
 *   centres its column vertically, and the mark is left stranded beside a
 *   heading that has since moved. Anchored to the slot, it simply goes along.
 *
 * - The transform is on a <g> inside the SVG, not on the wrapping div.
 *   vector-effect="non-scaling-stroke" only ignores transforms *within* the SVG;
 *   a CSS transform on an HTML ancestor scales strokes like everything else, so
 *   shrinking that way rendered the 2px amber at 0.2px — about 18% of its
 *   colour, a brown smudge. Scaling inside the SVG is what makes the attribute
 *   do its job.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { mulberry32 } from "@/lib/roll";
import { NAME, HERO, SUB } from "@/lib/content";
import { RegisterWall, WorldCount } from "./Register";

const VB_W = 1000;
const VB_H = 600;
const STEM = VB_H / 5; // a fifth of the frame: one line, read as one line, then it splits
const PAD_X = 24;
const TOP = 56;
const DEPTH = 5; // six levels of canopy above the stem
const LOGO_DEPTH = 2; // how far out the mark keeps branching
const CAP = 320; // ceiling on path count, so a lucky seed cannot run away
const SEED = 90210;

/**
 * Draw timing. A level may only start once the level above it has finished, so
 * STEP has to clear STEM_MS/DUR plus the jitter spread — otherwise a child
 * starts growing from a point its parent has not reached yet and hangs off the
 * end of the line, which is what made the lit path look broken.
 */
const STEM_MS = 800; // one amber line, alone, before anything leaves it
const STEP = 520; // per-level stagger, so growth propagates outward
const DUR = 500; // one segment; STEP - DUR must stay >= WOBBLE (see the draw)
const WOBBLE = 20; // small, so it never eats the gap between levels

const SETTLE = 4000; // the last segment lands at ~3920
const SHRINK = 4200;
const DOCK_MS = 1600; // a long, even glide rather than a snap
/**
 * How long into the dock before the drawing is out of the wordmark's band.
 *
 * Measured, not guessed: the kept group's bottom edge crosses above the h1 at
 * ~1250ms in. The wordmark used to start resolving at SHRINK, which put it
 * underneath a tree that was still travelling through it.
 */
const CLEAR = 1300;
const TEXT = SHRINK + CLEAR; // the space is empty before anything is put in it
const TYPE = TEXT + 1800; // the wordmark lands at TEXT + 1100; then a beat

const PAUSE_LINE = 1100; // before the closing line
const PAUSE_BUTTON = 1100; // after the last character, before the button

type Seg = { d: string; depth: number; primary: boolean; keep: boolean; jitter: number };

/**
 * The canopy grows generation by generation from (0,0), up being -y, and is
 * fitted to the frame afterwards. Fitting last is what guarantees it spans the
 * width: the angles can fall however they like and the shape still fills it.
 *
 * Growth is breadth-first because the interesting constraint is population, not
 * recursion depth. Once the field is busy, tips stop tripling and start simply
 * continuing — a network is paths that carry on, whereas letting every tip
 * split to the end just builds a haze of twigs around one hard rim.
 */
function build(seed: number): Seg[] {
  const rnd = mulberry32(seed);

  type Raw = {
    x1: number; y1: number; qx: number; qy: number; x2: number; y2: number;
    depth: number; primary: boolean; keep: boolean; jitter: number;
  };
  type Tip = { x: number; y: number; ang: number; len: number; primary: boolean; keep: boolean };

  const raw: Raw[] = [];
  let tips: Tip[] = [];
  for (let i = 0; i < 3; i++) {
    tips.push({ x: 0, y: 0, ang: -Math.PI / 2 + (i - 1) * 0.44, len: 104, primary: i === 1, keep: true });
  }

  for (let depth = 0; depth <= DEPTH && tips.length; depth++) {
    const next: Tip[] = [];
    const room = tips.length < 10 ? 2 : tips.length < 22 ? 1 : 0;

    for (const t of tips) {
      const x2 = t.x + Math.cos(t.ang) * t.len;
      const y2 = t.y + Math.sin(t.ang) * t.len;
      raw.push({
        x1: t.x, y1: t.y,
        qx: t.x + Math.cos(t.ang) * t.len * 0.5 + (rnd() - 0.5) * t.len * 0.4,
        qy: t.y + Math.sin(t.ang) * t.len * 0.55,
        x2, y2, depth, primary: t.primary, keep: t.keep, jitter: rnd() * WOBBLE,
      });

      if (depth === DEPTH || raw.length >= CAP) continue;
      // some paths simply stop, so the canopy ends on a ragged edge instead of
      // every branch reaching the same radius
      if (depth >= 2 && !t.primary && rnd() < 0.28) continue;

      const r = rnd();
      const kids = room === 2 ? (r < 0.55 ? 3 : 2) : room === 1 ? (r < 0.4 ? 3 : 2) : r < 0.3 ? 2 : 1;
      const heir = Math.floor(rnd() * kids); // the run of choices that actually happened
      const spread = 0.23 + depth * 0.085; // wider the further out it gets
      for (let i = 0; i < kids; i++) {
        const off = (i - (kids - 1) / 2) * spread * (0.8 + rnd() * 0.5);
        const isHeir = t.primary && i === heir;
        next.push({
          x: x2, y: y2,
          ang: t.ang + off,
          len: t.len * (0.79 + rnd() * 0.17),
          primary: isHeir,
          // The logo is this same object with most of it removed. Not the whole
          // lit spine — that is many times taller than it is wide, and fitting
          // it into a 50px square leaves a sliver. Instead: the full first fan,
          // which is where the width comes from, and the lit path one level
          // past it. Wide, shallow, unmistakably branching at 50px.
          keep: t.keep && (depth + 1 <= 1 || (isHeir && depth + 1 <= LOGO_DEPTH)),
        });
      }
    }
    tips = next;
  }

  let minX = 0, maxX = 0, minY = 0;
  for (const s of raw) {
    minX = Math.min(minX, s.x1, s.x2, s.qx);
    maxX = Math.max(maxX, s.x1, s.x2, s.qx);
    minY = Math.min(minY, s.y1, s.y2, s.qy);
  }
  // x is scaled off the wider half so the stem stays centred and the canopy
  // still reaches the edge; y independently, so the canopy height is exact
  const xs = (VB_W / 2 - PAD_X) / (Math.max(-minX, maxX) || 1);
  const ys = (VB_H - STEM - TOP) / (-minY || 1);
  const cx = VB_W / 2;
  const cy = VB_H - STEM;
  const px = (v: number) => (cx + v * xs).toFixed(1);
  const py = (v: number) => (cy + v * ys).toFixed(1);

  const segs: Seg[] = [
    { d: `M${cx} ${VB_H} L${cx} ${cy}`, depth: 0, primary: true, keep: true, jitter: 0 },
  ];
  for (const s of raw) {
    segs.push({
      d: `M${px(s.x1)} ${py(s.y1)} Q${px(s.qx)} ${py(s.qy)} ${px(s.x2)} ${py(s.y2)}`,
      depth: s.depth + 1,
      primary: s.primary,
      keep: s.keep,
      jitter: s.jitter,
    });
  }
  return segs;
}


/**
 * The shrink, expressed in SVG user units.
 *
 * `ux/uy` lifts the drawing off its slot so it covers the viewport; `tx/ty/sk`
 * puts the kept paths back onto the slot. Both are relative to the slot, because
 * the SVG box is a child of it — so the docked figures depend only on the
 * viewport and the geometry, never on where the slot sits on the page. A late
 * font, a reflow or a resize moves the slot and the mark goes with it.
 *
 * The transform lives on a <g> inside the SVG rather than on the wrapping div,
 * and that is not a detail. vector-effect="non-scaling-stroke" only ignores
 * transforms *within* the SVG; a CSS transform on an HTML ancestor scales the
 * strokes like everything else, so shrinking that way rendered the 2px amber at
 * 0.2px — about 18% of its colour, a brown smudge. Scaling inside the SVG is
 * what makes the attribute do its job, and the strokes hold their width all the
 * way down.
 */
type Frame = { ux: number; uy: number; tx: number; ty: number; sk: number; z: number };

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** True once `active` has held for `ms` — the pauses between stages. */
function useAfter(active: boolean, ms: number, quick: boolean) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (quick) {
      setOn(active);
      return;
    }
    if (!active) {
      setOn(false);
      return;
    }
    const t = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(t);
  }, [active, ms, quick]);
  return on;
}

/**
 * Reveals `text` a character at a time and returns how many are showing.
 *
 * The caller renders the whole string either way and only drops the opacity of
 * the tail, so nothing reflows as it types — growing the text node instead would
 * re-wrap the paragraph on almost every keystroke and shift the layout under the
 * mark. Pauses are taken from the punctuation rather than hard-coded to a word,
 * so the copy stays editable in lib/content.ts.
 */
function useTypewriter(text: string, start: boolean, quick: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (quick) {
      setN(text.length);
      return;
    }
    if (!start) {
      setN(0);
      return;
    }
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      i += 1;
      setN(i);
      if (i >= text.length) return;
      const just = text[i - 1];
      const wait = just === "," ? 620 : just === "." ? 340 : 32;
      t = setTimeout(step, wait);
    };
    t = setTimeout(step, 20);
    return () => clearTimeout(t);
  }, [text, start, quick]);
  return n;
}

export function Intro({ onBegin, skip = false }: { onBegin: () => void; skip?: boolean }) {
  const segs = useMemo(() => build(SEED), []);
  const kept = useMemo(() => segs.filter((s) => s.keep), [segs]);
  const rest = useMemo(() => segs.filter((s) => !s.keep), [segs]);

  const [settled, setSettled] = useState(false);
  const [docked, setDocked] = useState(false);
  const [shown, setShown] = useState(false);
  const [typing, setTyping] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [quick, setQuick] = useState(false); // reduced motion, or the reader skipped

  const wrap = useRef<HTMLDivElement>(null);
  const keepG = useRef<SVGGElement>(null);
  const slot = useRef<HTMLSpanElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /**
   * Measured in SVG user units via getBBox, not in screen pixels.
   *
   * The obvious approach — blank the transform, read getBoundingClientRect, put
   * it back — cannot work here: the element carries a transition on `transform`,
   * so clearing it starts an animation rather than applying instantly, and the
   * read comes back mid-glide. getBBox is in the SVG's own coordinate space, and
   * offsetWidth/offsetHeight are layout sizes; no transform touches either.
   */
  const remeasure = useCallback(() => {
    const box = wrap.current, g = keepG.current, sl = slot.current;
    if (!box || !g || !sl) return;

    const W = box.offsetWidth, H = box.offsetHeight;
    if (!W || !H) return;
    const bb = g.getBBox();
    if (!bb.width || !bb.height) return;

    // replicate preserveAspectRatio="xMidYMax meet" to convert between the box's
    // pixels and the viewBox's user units
    const z = Math.min(W / VB_W, H / VB_H);
    const offX = (W - VB_W * z) / 2;
    const offY = H - VB_H * z;

    const sb = sl.getBoundingClientRect(); // the slot itself is never transformed
    const side = sb.width / z; // the slot, in user units
    const sk = Math.min(side / bb.width, side / bb.height);

    setFrame({
      z,
      ux: -sb.left / z,
      uy: -sb.top / z,
      sk,
      tx: -offX / z + (side - bb.width * sk) / 2 - sk * bb.x,
      ty: -offY / z + (side - bb.height * sk) / 2 - sk * bb.y,
    });
  }, []);

  const finish = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setQuick(true);
    setSettled(true);
    setDocked(true);
    setShown(true);
    setTyping(true);
  }, []);

  useIso(() => {
    remeasure();
    // `skip`: someone who has already watched this is coming back to it, by a
    // Back press or the logo. Replaying it would be a seven-second toll on a
    // navigation they expected to be instant.
    if (skip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setQuick(true);
      setSettled(true);
      setDocked(true);
      setShown(true);
      setTyping(true);
      return;
    }
    timers.current = [
      setTimeout(() => setSettled(true), SETTLE),
      setTimeout(() => setDocked(true), SHRINK),
      setTimeout(() => setShown(true), TEXT),
      setTimeout(() => setTyping(true), TYPE),
    ];
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, [remeasure, skip]);

  /**
   * Keep the frame honest about the box it is mapping into.
   *
   * `frame` converts between viewBox units and pixels, so it is only valid for
   * one particular size of the SVG box — and the dock aims at a slot expressed
   * in those units. Let the box change size without re-measuring and the mark
   * lands beside the ring rather than inside it, by however much the scale
   * drifted. A window `resize` listener does not catch all of it: a scrollbar
   * appearing, or a mobile URL bar collapsing, changes what 100vw/100vh resolve
   * to without necessarily telling the window. So watch the element itself.
   */
  useEffect(() => {
    let live = true;
    let raf = 0;
    const again = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => live && remeasure());
    };
    window.addEventListener("resize", again);
    document.fonts?.ready.then(() => live && again());
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(again);
    if (wrap.current) ro?.observe(wrap.current);
    return () => {
      live = false;
      window.removeEventListener("resize", again);
      ro?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [remeasure]);

  const dockMs = quick ? 320 : DOCK_MS;

  const heroN = useTypewriter(HERO, typing, quick);
  const subStart = useAfter(heroN >= HERO.length, PAUSE_LINE, quick);
  const subN = useTypewriter(SUB, subStart, quick);
  const ready = useAfter(subN >= SUB.length, PAUSE_BUTTON, quick);

  /**
   * The two path groups, memoised.
   *
   * Every typed character is a state change on this component, and without this
   * each keystroke would re-render all ~90 paths. Nothing here depends on the
   * typing, so it is rebuilt only when the phase or the viewport scale actually
   * changes.
   */
  const z = frame?.z ?? 1;
  const tree = useMemo(() => {
    const line = (s: Seg, i: number) => {
      // while it draws, the outer levels sit back — a flat opacity across every
      // level reads as noise rather than as depth
      const growing = Math.max(0.16, 0.54 - s.depth * 0.045);
      const dim = docked ? (s.keep ? 0.55 : 0.12) : settled ? 0.12 : growing;
      const weight = s.primary ? 2 : 1;
      return (
        <path
          key={i}
          className="seg"
          d={s.d}
          pathLength="1"
          fill="none"
          // These two cannot both be on at once. non-scaling-stroke resolves the
          // dash pattern in device space while pathLength normalises in user
          // space, so the dash covers only 1/z of each path — at z=1.42 that is
          // 70%, and every segment ends ~30% short of the next one. The lit path
          // renders as a dashed line. So: plain strokes while it draws, where the
          // dash has to be exact; non-scaling-stroke only for the shrink, where
          // holding the stroke width is what matters and the dash is long done.
          vectorEffect={docked ? "non-scaling-stroke" : undefined}
          // and the widths are chosen so the device weight is identical either
          // side of that switch — base/z scaled by z, or base held flat
          stroke={s.primary ? "var(--amber)" : "var(--lilac)"}
          strokeWidth={docked ? weight : weight / z}
          strokeLinecap="round"
          style={{
            strokeDasharray: docked ? "none" : undefined,
            ...(quick
              ? { animation: "none", strokeDashoffset: 0 }
              : {
                  animationDelay: `${s.depth === 0 ? 0 : STEM_MS + (s.depth - 1) * STEP + s.jitter}ms`,
                  animationDuration: `${s.depth === 0 ? STEM_MS : DUR}ms`,
                  // linear, not --ease: a line being drawn should travel at a
                  // steady rate. Under an expo-out each stroke leaps out and then
                  // creeps through its last percent, which both reads as jitter
                  // and holds a visible gap open at every joint.
                  animationTimingFunction: "linear",
                }),
            opacity: s.primary ? (settled ? 1 : 0.95) : dim,
            transition: `opacity ${quick ? 200 : 900}ms ease`,
          }}
        />
      );
    };
    return (
      <>
        {/* everything the logo drops, cleared by the same movement */}
        <g style={{ opacity: docked ? 0 : 1, transition: `opacity ${quick ? 200 : 800}ms ease` }}>
          {rest.map(line)}
        </g>
        {/* what survives at mark size: the lit path and enough of its neighbours
            to still read as a branching form */}
        <g ref={keepG}>{kept.map(line)}</g>
      </>
    );
  }, [kept, rest, docked, settled, quick, z]);

  const soft = (delay: number) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? "none" : "translateY(12px)",
    // 800ms from TEXT lands exactly as the mark finishes travelling
    transition:
      `opacity ${quick ? 200 : 1100}ms ease ${quick ? 0 : delay}ms, ` +
      `transform ${quick ? 200 : 1100}ms var(--glide) ${quick ? 0 : delay}ms`,
  });

  return (
    // overflow:hidden matters — the SVG box is 100vw x 100vh anchored to the mark
    // slot, so it runs past the right and bottom edges and would otherwise widen
    // the document and push the wordmark off screen at narrow widths. The tree is
    // meant to fill exactly the viewport, so clipping to it costs nothing.
    <div
      style={{ position: "relative", minHeight: "100dvh", overflow: "hidden" }}
      onClick={finish}
    >
      {/* Behind everything, and tied to `shown` rather than a timer of its own:
          that is the moment the mark has cleared the wordmark's band and the
          composition starts resolving, and it is already a state this component
          keeps. A second timer would be the same number written twice and would
          drift the first time either one is tuned. `skip` and reduced motion set
          `shown` synchronously, so the register is simply already there. */}
      <RegisterWall on={shown} quick={quick} />

      <div className="stage" style={{ position: "relative", zIndex: 2, alignItems: "center" }}>
        {/* mounted from the first frame: the slot has to hold its final position
            before there is anything to dock onto it, and the copy is present in
            full from the start so that typing it out never reflows anything */}
        <div
          className="introtext"
          aria-hidden={shown ? undefined : true}
          style={{ maxWidth: "44rem", width: "100%", textAlign: "center" }}
        >
          {/* The circle fades in via border-colour, never opacity. The
              full-screen SVG is a descendant of this element, so an opacity of 0
              here hides the entire growth animation and the tree only appears at
              the instant it starts shrinking. Border-colour leaves the subtree
              alone, and holding the 1px width keeps the layout still. */}
          <div
            className="markring"
            style={{
              borderColor: docked ? "var(--rule)" : "transparent",
              transition: `border-color ${quick ? 200 : 900}ms ease ${quick ? 0 : 700}ms`,
            }}
          >
            <span
              ref={slot}
              aria-hidden="true"
              style={{
                position: "relative",
                width: "var(--mark)",
                height: "var(--mark)",
                flex: "none",
              }}
            >
              <div
                ref={wrap}
                className="markwrap"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "100vw",
                  height: "100vh",
                  pointerEvents: "none",
                  // hidden only until the first measurement, which happens in a
                  // layout effect and so lands before any paint
                  visibility: frame ? "visible" : "hidden",
                }}
              >
                <svg
                  viewBox={`0 0 ${VB_W} ${VB_H}`}
                  preserveAspectRatio="xMidYMax meet"
                  width="100%"
                  height="100%"
                  style={{ display: "block", overflow: "visible" }}
                >
                  <g
                    style={{
                      transformBox: "view-box",
                      transformOrigin: "0 0",
                      // both states carry the same function list — translate then
                      // scale — so the transition interpolates function by
                      // function instead of falling back to matrix decomposition
                      transform: frame
                        ? docked
                          ? `translate(${frame.tx}px, ${frame.ty}px) scale(${frame.sk})`
                          : `translate(${frame.ux}px, ${frame.uy}px) scale(1)`
                        : "translate(0px, 0px) scale(1)",
                      /* Only the dock is a journey. Undocked, the transform is
                         just where the drawing has to sit to cover the viewport,
                         and it is set twice — once on mount and again whenever a
                         late font or a resize moves the slot. With a transition
                         standing, the first of those animated: `remeasure` reads
                         getBoundingClientRect before setting state, which flushes
                         style and hands the browser a previous value of
                         translate(0,0) — the slot itself — so the tree launched
                         from mid-screen and slid into place while it drew. */
                      transition: docked ? `transform ${dockMs}ms var(--glide)` : "none",
                    }}
                  >
                    {tree}
                  </g>
                </svg>
              </div>
            </span>
          </div>

          {/* Mounted from the first frame, hidden, so its line is holding its
              space before the mark is measured: the dock aims at a slot read in
              a layout effect, and anything appearing above it afterwards moves
              the target after the aim has been taken. */}
          <WorldCount on={shown} quick={quick} />

          <h1 className="name" style={soft(0)}>
            {NAME}
          </h1>

          <p
            style={{
              fontFamily: "var(--body)",
              color: "var(--bone)",
              fontSize: "clamp(.95rem,1.9vw,1.1rem)",
              lineHeight: 1.55,
              margin: "2rem auto .7rem",
              maxWidth: "30rem",
            }}
          >
            <span>{HERO.slice(0, heroN)}</span>
            <span style={{ opacity: 0 }}>{HERO.slice(heroN)}</span>
          </p>
          <p className="note" style={{ fontFamily: "var(--body)", margin: "0 auto 2.9rem" }}>
            <span>{SUB.slice(0, subN)}</span>
            <span style={{ opacity: 0 }}>{SUB.slice(subN)}</span>
          </p>

          <button
            className={`btn solid${ready ? " breathe" : ""}`}
            // a plain fade — no travel. The mark and the wordmark have already
            // moved; the button should simply resolve where it stands.
            style={{
              opacity: ready ? 1 : 0,
              transition: `opacity ${quick ? 200 : 700}ms ease`,
            }}
            disabled={!ready}
            onClick={onBegin}
          >
            Begin
          </button>
        </div>
      </div>

      {!ready && (
        <button
          className="btn ghost"
          onClick={finish}
          style={{ position: "fixed", right: "3vw", bottom: "3vh", zIndex: 10 }}
        >
          Skip
        </button>
      )}
    </div>
  );
}
