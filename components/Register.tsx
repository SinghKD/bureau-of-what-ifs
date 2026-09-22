"use client";

/**
 * The register wall: the landing's background, and the count above the wordmark.
 *
 * Both are one idea — the Bureau's index of worlds, big enough that it is still
 * being written while you stand at the door. The wall is what that index looks
 * like from across the room and the counter is the only part of it you are meant
 * to read.
 *
 * Three things are load-bearing:
 *
 * - Every number, opacity, speed and direction comes from one seeded
 *   `mulberry32`. The wall is a fixed thing being scanned, not a lava lamp, and
 *   a reader who reloads has to find the same register they left.
 *
 * - Scrolling is a CSS animation on the column and surfacing is a direct write
 *   to one element's `style.opacity`. Neither goes through React: there are
 *   ~1,400 entries on screen and a per-frame render loop over them would cost
 *   more than everything else on the page put together.
 *
 * - Nothing starts until the intro says it has landed. The wall is mounted from
 *   the first frame at `opacity: 0` so the counter's line is already holding its
 *   space — the mark docks onto a slot measured in a layout effect, and an
 *   element appearing above it later would move the target after the aim.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { mulberry32 } from "@/lib/roll";
import { REGISTER } from "@/lib/content";

/**
 * Chosen, not picked at random: this one puts five of the ten columns scanning
 * downward with no long run of either direction, spreads the speeds across most
 * of the 90-160s band, and uses 177 distinct designations out of 180. A seed
 * that sends nine columns the same way reads as a single sheet sliding past.
 */
const SEED = 41723;

const COLS = 10;
/**
 * Entries authored per column, and how many times that run is repeated to build
 * one loop unit.
 *
 * The loop is `translateY(-50%)` across two identical units, so the wall only
 * reads as continuous while one unit is at least as tall as the viewport. 18
 * entries at 12px on a 2.9 line-height is 626px — half a laptop screen, and the
 * bottom of the column would swing into view twice a minute. Four runs make the
 * unit 2,506px, which covers every desktop height there is; the register is
 * still 18 distinct designations per column, just written out more than once.
 */
const PER = 18;
const RUNS = 4;

/**
 * The one already claimed. Fixed, so it is the same world on every visit — and
 * kept out of the middle columns on purpose: the vignette is ~0.9 opaque across
 * the centre of the frame, so an entry sitting under the wordmark would be at
 * full amber and still invisible.
 */
const CLAIM_COL = 1;
const CLAIM_ROW = 7;
/**
 * ...and in only one of the four runs that make up a loop unit. Marking it in
 * every run put three amber lines down the same column at once, which reads as
 * "every eighteenth world is taken" rather than as one world that is. At one per
 * unit the two copies are a whole unit — 2,506px — apart, so only ever one of
 * them is on screen.
 */
const CLAIM_RUN = 1;

type Cell = { n: number; o: number };
type Col = { cells: Cell[]; dur: number; down: boolean; lead: number };

/** Digits stacked inside one dial, top to bottom. */
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Hand-rolled rather than `toLocaleString`: the count is rendered on the server
 * too, and a grouping that depends on the runtime's locale data is a hydration
 * mismatch waiting for the first reader outside en-US.
 */
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Reduced motion, read on the client so the server has nothing to disagree with. */
function useStill() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, []);
  return still;
}

/* ------------------------------------------------------------------- wall */
export function RegisterWall({ on, quick = false }: { on: boolean; quick?: boolean }) {
  const still = useStill();
  const host = useRef<HTMLDivElement>(null);

  const cols = useMemo<Col[]>(() => {
    const rnd = mulberry32(SEED);
    const out: Col[] = [];
    for (let c = 0; c < COLS; c++) {
      const cells: Cell[] = [];
      for (let r = 0; r < PER; r++) {
        cells.push({
          n: 1000 + Math.floor(rnd() * 9000),
          // 0.09–0.26. The ceiling is still the point — past about a quarter
          // the wall stops being a texture and starts being something to read,
          // and the wordmark is what is meant to be read here — but the floor
          // matters too: at 0.05 the dimmest entries were not showing at all,
          // so the wall read as a handful of lines rather than a full register.
          o: Math.round((0.09 + rnd() * 0.17) * 1000) / 1000,
        });
      }
      out.push({
        cells,
        // 90–160s, and deliberately not normalised: columns agreeing on a speed
        // reads as end credits, columns disagreeing reads as a machine scanning
        // an archive one shelf at a time.
        dur: Math.round(90 + rnd() * 70),
        down: rnd() < 0.5,
        // a seeded head start, so the wall is already mid-scan when it appears
        // rather than every column setting off together from its first line
        lead: Math.round(rnd() * 90),
      });
    }
    return out;
  }, []);

  /**
   * Surfacing: one entry at a time is brought up out of the texture and then let
   * back down. It is the whole difference between a register that is being kept
   * and a poster of one.
   *
   * Written straight to the node. One property, no layout, no React — and the
   * 900ms ease that carries it lives on `.reg-e` in CSS, so this only ever sets
   * a number.
   */
  useEffect(() => {
    if (!on || still) return;
    const box = host.current;
    if (!box) return;
    // the claimed world carries its own class and so is never in this list
    const cells = Array.from(box.querySelectorAll<HTMLElement>(".reg-e"));
    if (!cells.length) return;

    const rnd = mulberry32(SEED + 1);
    const pending = new Set<ReturnType<typeof setTimeout>>();
    const lit = new Set<HTMLElement>();

    const tick = setInterval(() => {
      const el = cells[Math.floor(rnd() * cells.length)];
      // already up: picking it again would leave the first timer to drop it
      // back early, which shows as a blink
      if (!el || lit.has(el)) return;
      lit.add(el);
      // lifted with the base below it, so surfacing stays a clear step up out
      // of the texture rather than a shade of it
      el.style.opacity = String(Math.round((0.5 + rnd() * 0.3) * 1000) / 1000);
      const back = setTimeout(
        () => {
          el.style.opacity = el.dataset.base ?? "0.1";
          lit.delete(el);
          pending.delete(back);
        },
        1400 + rnd() * 1600,
      );
      pending.add(back);
    }, 240);

    return () => {
      clearInterval(tick);
      pending.forEach(clearTimeout);
    };
  }, [on, still]);

  return (
    <div
      className={`reg${on ? " on" : ""}`}
      aria-hidden="true"
      style={{ transition: `opacity ${quick ? 200 : 1200}ms ease` }}
    >
      <div className="reg-wall" ref={host}>
        {cols.map((col, c) => (
          <div
            key={c}
            className={`reg-col${col.down ? " dn" : ""}`}
            style={{ animationDuration: `${col.dur}s`, animationDelay: `-${col.lead}s` }}
          >
            {Array.from({ length: RUNS * 2 }, (_, k) => (
              <Fragment key={k}>
                {col.cells.map((cell, r) => {
                  const claimed =
                    c === CLAIM_COL && r === CLAIM_ROW && k % RUNS === CLAIM_RUN;
                  return (
                    <span
                      key={r}
                      className={claimed ? "reg-claim" : "reg-e"}
                      data-base={claimed ? undefined : cell.o}
                      style={{ opacity: claimed ? 1 : cell.o }}
                    >
                      {REGISTER.entry} #{cell.n}
                    </span>
                  );
                })}
              </Fragment>
            ))}
          </div>
        ))}
      </div>
      {/* the wall only ever shows at the edges: the middle of this is very
          nearly solid --void, because the wordmark sits on it */}
      <div className="reg-mask" />
    </div>
  );
}

/* ---------------------------------------------------------------- counter */
export function WorldCount({ on, quick = false }: { on: boolean; quick?: boolean }) {
  const still = useStill();
  const [n, setN] = useState(REGISTER.start);
  /**
   * Nothing of this is put on the page until the register is revealed — which
   * is to say, until the logo has finished moving — and under reduced motion it
   * arrives without a fade.
   *
   * Both halves of that are about one thing. The intro's mark is an SVG group
   * transformed far outside its own viewport and drawn there by
   * `overflow: visible`; a neighbour inside `.introtext` that gets its own
   * compositing layer — which is what a transition or animation on opacity buys
   * you — is enough to cost that group its rasterisation. It keeps its box, its
   * position and `visibility: visible` throughout; it simply stops being drawn.
   * Reduced motion is where it bites, because there the whole intro resolves on
   * the first frame and the fade lands on top of the dock.
   *
   * So: absent until the reveal, and plain when motion is not wanted.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const dial = ready && on && !still;

  useEffect(() => {
    if (!on) return;
    const rnd = mulberry32(SEED + 2);
    const id = setInterval(() => setN((v) => v + 1 + Math.floor(rnd() * 3)), 900);
    return () => clearInterval(id);
  }, [on]);

  const text = group(n);

  return (
    /**
     * A zero-height slot, with the count itself lifted out of the flow into the
     * gap the wordmark already had above it.
     *
     * Not a nicety: in the column as laid out, `.markring` is followed by
     * 1.6rem of margin and then the h1, and this sits in that margin. Giving the
     * count a box of its own instead moves the mark's slot — which the intro
     * measures once, in a layout effect, to aim the dock at — and everything
     * below it, for a line that had somewhere to go already.
     *
     * One label for the whole thing, and every moving part hidden beneath it:
     * announcing a number that changes every 900ms is not a readout, it is an
     * interruption, so the digits are scenery and the label is the sentence.
     * role="img" because a bare element with an aria-label is not reliably given
     * a name, and with the digits hidden there would be nothing left to read.
     */
    <div className="reg-slot">
      {on && (
      <p
        className={`reg-count${still ? "" : " fade"}`}
        role="img"
        aria-label={`${text} ${REGISTER.label}`}
        style={still ? undefined : { animationDuration: `${quick ? 200 : 1200}ms` }}
      >
        <span className="reg-num" aria-hidden="true">
          {!dial
            ? text
            : text.split("").map((ch, i) =>
                ch === "," ? (
                  <span className="reg-sep" key={i}>
                    ,
                  </span>
                ) : (
                  <span className="reg-d" key={i}>
                    {/* the strip is ten digits tall and the window is one digit
                        high, so a place that has not changed simply does not
                        move — which is why the ones spin and the millions sit */}
                    <span
                      className="reg-strip"
                      style={{ transform: `translateY(calc(var(--dh) * -${ch}))` }}
                    >
                      {DIGITS.map((d) => (
                        <b key={d}>{d}</b>
                      ))}
                    </span>
                  </span>
                ),
              )}
        </span>
        <span className="reg-label" aria-hidden="true">
          {REGISTER.label}
        </span>
      </p>
      )}
    </div>
  );
}
