"use client";

/**
 * Three phases: the four-part questionnaire, the lock, then the canon events.
 *
 * The canon events are deliberately not one of the four — they are a separate
 * record, so the questionnaire's counter runs 01/04 to 04/04 and the fix closes
 * at the end of part four rather than being diluted across five. The events
 * screen is the fifth station and its bar says so.
 *
 * The lock is its own screen rather than a label that appears in place. Derived
 * from the answers it fired the moment the first field of part four was filled,
 * because a station acquires on any answer; as a screen it happens once, when
 * the subject says they are finished.
 *
 * The tree grows on commit — blur or Enter — not on every keystroke, so a branch
 * arrives as the consequence of finishing a thought.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NAME, SCREENS, EVENT_SCREEN, OPTIONAL_NOTE, TRIANGULATION } from "@/lib/content";
import type { Profile } from "@/lib/types";
import { useJourney } from "./Journey";
import { Triangulation, liveStations, regionPercent, survivors } from "./Triangulation";
import { BranchTree } from "./BranchTree";

const KEYS = SCREENS.flatMap((s) => s.fields.map((f) => f.k));
const SLOTS = KEYS.length + 5; // every profile field plus every event row

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The only thing on these screens that says whose building this is. The mark is
 * the landing's branching figure reduced to what survives at 13px: one amber
 * stem — you, and what stayed — with two lilac offshoots going elsewhere.
 *
 * No rule under it. The gradient is already doing the separating.
 */
function TopBar({ where }: { where: string }) {
  return (
    <header className="topbar">
      <svg
        className="topbar-mark"
        width="13"
        height="17"
        viewBox="0 0 13 17"
        fill="none"
        aria-hidden="true"
      >
        <path d="M6.5 16.4V1.5" stroke="var(--amber)" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M6.5 10.6 1.9 5.7" stroke="var(--lilac)" strokeWidth="1" strokeLinecap="round" />
        <path d="M6.5 7.1 11.1 2.9" stroke="var(--lilac)" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <span className="topbar-name">{NAME}</span>
      <span className="topbar-step">{where}</span>
    </header>
  );
}

/**
 * Where it is in the sequence comes from the URL, not from state held here.
 * That is what makes Back a real Back: every section is a history entry, and a
 * reload resumes on the section it names rather than at the beginning.
 */
export function Onboarding({
  phase,
  step,
  go,
}: {
  phase: "form" | "located" | "events";
  step: number;
  go: (to: string) => void;
}) {
  const {
    profile,
    setField,
    events,
    setEvents,
    committed,
    commit,
    seed,
    settleSeed,
    setMarks,
  } = useJourney();

  /**
   * The triangulation reads a settled copy of the profile, not the live one.
   * Driving it from every keystroke makes the beams lurch on the first character
   * of an answer and then again on each one after; waiting for a pause means a
   * bearing arrives when a thought is finished, which is also when it is true.
   */
  const [settled, setSettled] = useState<Profile>(profile);
  useEffect(() => {
    const t = setTimeout(() => setSettled(profile), 600);
    return () => clearTimeout(t);
  }, [profile]);

  // FLIP: the map is measured in the right column on the way out, then the lock
  // screen's copy is started from that rect and released to its natural place.
  // Animating *to* the real layout means the end state needs no measurement and
  // nothing can be left stranded if the page reflows underneath it.
  const figure = useRef<HTMLDivElement>(null);
  const lockFig = useRef<HTMLDivElement>(null);
  const from = useRef<DOMRect | null>(null);
  const [leaving, setLeaving] = useState(false);
  const total = SCREENS.length;
  const onEvents = phase === "events";

  /* A blur or an Enter says a thought is finished outright. A pause in typing
     says it too, so a branch arrives without having to leave the field — and
     the branch for the row still being written keeps adjusting until then. */
  useEffect(() => {
    const t = setTimeout(commit, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);
  /* growth happens on commit, not per keystroke: a branch is the consequence
     of finishing a thought, and redrawing on every letter both jitters and
     thrashes */
  const enterCommits = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    commit();
    ev.currentTarget.blur();
  };
  const setEv = (id: string, f: "year" | "text", v: string) =>
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, [f]: v } : e)));

  const filled = events.filter((e) => e.text.trim()).length;
  const bearings = liveStations(settled).length;
  const pct = regionPercent(settled);
  const ok = bearings === SCREENS.length;
  const advance = () => {
    settleSeed();
    if (step < SCREENS.length - 1) {
      go(`/questions?n=${step + 2}`);
      return;
    }
    // skip the debounce on the way out: an answer typed a moment before Next is
    // still an answer, and the lock screen must not under-report it
    setSettled(profile);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      go("/questions?n=lock");
      return;
    }
    setLeaving(true);
    window.setTimeout(() => {
      from.current = figure.current?.getBoundingClientRect() ?? null;
      setLeaving(false);
      go("/questions?n=lock");
      // 320ms is the fade on .onboard.is-leaving: swapping before it lands
      // leaves the questions visible at a few percent and then cuts them
    }, 340);
  };
  const run = () => {
    setMarks(survivors(profile, seed));
    go("/sweep");
  };
  const recorded =
    KEYS.filter((k) => (profile[k] ?? "").trim()).length + filled;

  const outOfOrder = useMemo(() => {
    const years = events.filter((e) => e.text.trim() && e.year).map((e) => Number(e.year));
    return years.some((y, i) => i > 0 && y < years[i - 1]);
  }, [events]);


  useLayoutEffect(() => {
    if (phase !== "located") return;
    const el = lockFig.current;
    const a = from.current;
    from.current = null;
    if (!el || !a || !a.width) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const b = el.getBoundingClientRect();
    if (!b.width) return;
    // the SVG keeps its aspect either side, so one uniform scale is exact
    const k = a.width / b.width;
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transition = "transform 900ms var(--glide)";
        el.style.transform = "none";
      }),
    );
    return () => cancelAnimationFrame(id);
  }, [phase]);

  const sortByYear = () =>
    setEvents((es: typeof events) =>
      [...es].sort((a, b) => (a.year ? Number(a.year) : Infinity) - (b.year ? Number(b.year) : Infinity)),
    );

  if (phase === "located") {
    return (
      <div className="stage onboard-stage lock-stage">
        {/* section four is behind them by the time the fix closes */}
        <TopBar where={`${pad(SCREENS.length)} / ${pad(SCREENS.length)}`} />
        <div className="locked-wrap">
          <div className="fade" style={{ textAlign: "center" }}>
            <p className={`lock-title${ok ? " lit" : ""}`}>
              {ok ? TRIANGULATION.located : TRIANGULATION.unlocated}
            </p>
            <p className="lock-sub">{ok ? TRIANGULATION.place : TRIANGULATION.short}</p>
          </div>

          <div ref={lockFig} className="lock-fig">
            <Triangulation profile={settled} seed={seed} instant />
          </div>

          <p className="tri-caption fade" style={{ margin: "0.9rem 0 2rem" }}>
            {bearings} of {SCREENS.length} {TRIANGULATION.bearings}
          </p>
          <div className="fade" style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
            <button className="btn ghost" onClick={() => go(`/questions?n=${SCREENS.length}`)}>
              Back
            </button>
            <button className={`btn solid${ok ? " breathe" : ""}`} onClick={() => go("/events")}>
              {TRIANGULATION.proceed}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ five */
  /* The events screen has its own frame: a wide two-column grid, no divider,
     and the chart's column setting the height that the ledger beside it is
     stretched to. It shares only the header bar and the ground with the four
     before it, so it is built here rather than threaded back through the
     questionnaire's layout as a set of conditionals. */
  if (onEvents) {
    return (
      <div className="stage events-stage">
        {/* the fifth and last station, and the bar counts it as one */}
        <TopBar where={`${pad(total + 1)} / ${pad(total + 1)}`} />
        <div className="events">
          <div className="evt-body rise">
            <h2 className="head" style={{ fontSize: "clamp(1.5rem,3.2vw,2.1rem)", margin: "0 0 .7rem" }}>
              {EVENT_SCREEN.title}
            </h2>
            <p className="note evt-note">{EVENT_SCREEN.note}</p>

            <div className="ledger">
              <div className="lhead">
                <span />
                <span>{EVENT_SCREEN.colYear}</span>
                <span>{EVENT_SCREEN.colWhat}</span>
              </div>
              {events.map((e, i) => (
                <div className={`lrow${e.text.trim() || e.year ? " on" : ""}`} key={e.id}>
                  <span className="lidx" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    className="lyear"
                    value={e.year}
                    onChange={(ev) =>
                      setEv(e.id, "year", ev.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    onBlur={commit}
                    onKeyDown={enterCommits}
                    placeholder={EVENT_SCREEN.yearHint}
                    aria-label={`${EVENT_SCREEN.colYear}, row ${i + 1}`}
                    inputMode="numeric"
                  />
                  <input
                    className="ltext"
                    value={e.text}
                    onChange={(ev) => setEv(e.id, "text", ev.target.value)}
                    onBlur={commit}
                    onKeyDown={enterCommits}
                    placeholder={EVENT_SCREEN.whatHint}
                    aria-label={`${EVENT_SCREEN.colWhat}, row ${i + 1}`}
                  />
                </div>
              ))}
            </div>

            {outOfOrder && (
              <button
                className="btn ghost fade"
                style={{ fontSize: ".625rem", padding: ".45rem 0 0", letterSpacing: ".2em" }}
                onClick={sortByYear}
              >
                {EVENT_SCREEN.order}
              </button>
            )}

            {/* One line, and it reports on the form only — the sweep is no
                longer in it. Between them the count and the note are also the
                whole explanation of a sweep that cannot be run yet, which is
                why the button itself does not have to plead its case. */}
            <div className="evt-foot">
              <button className="btn ghost" onClick={() => go("/questions?n=lock")}>
                {EVENT_SCREEN.back}
              </button>
              <span className="caption">
                {filled} of {events.length} {EVENT_SCREEN.recorded}
              </span>
              <p className="foot-note">
                {filled < 2 ? EVENT_SCREEN.minimum : EVENT_SCREEN.optional}
              </p>
            </div>
          </div>

          {/* No fill and no rule of its own. The page's gradient is what tints
              this side, so the chart's wash runs off into the page instead of
              stopping on a panel edge — and the 56px gap beside it is the only
              thing separating the two columns. */}
          <aside className="evt-side">
            <div className="imp-head">
              <span className="eyebrow">{TRIANGULATION.timeline}</span>
              <span className="tri-count">{`${recorded} / ${SLOTS}`}</span>
            </div>
            <div className="evt-figure">
              <BranchTree events={committed} live={events} />
            </div>
          </aside>
        </div>

        {/* Under both columns rather than inside the form: it acts on the pair
            of them, and it is the end of the screen. */}
        <div className="evt-run">
          <button className="btn solid sweep" disabled={filled < 2} onClick={run}>
            {EVENT_SCREEN.run}
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- one through four */
  const sec = SCREENS[step];
  return (
    <div className="stage onboard-stage">
      <TopBar where={`${pad(step + 1)} / ${pad(total)}`} />
      <div className={`onboard${leaving ? " is-leaving" : ""}`}>
        {/* deliberately outside the keyed block below: remounting it on every
            screen change would replay every bearing it has already taken */}
        <aside className="onboard-side is-tri">
          <div className="imp-head">
            <span className="eyebrow">{TRIANGULATION.label}</span>
            <span className="tri-count">
              {`${TRIANGULATION.region} ${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`}
            </span>
          </div>

          <div className="imp-figure" ref={figure}>
            <Triangulation profile={settled} seed={seed} />
          </div>

          <p className="tri-caption">
            {bearings} of {SCREENS.length} {TRIANGULATION.bearings}
          </p>
          <p className="imp-note">
            {bearings === 0
              ? TRIANGULATION.searching
              : bearings < SCREENS.length
                ? TRIANGULATION.hint
                : TRIANGULATION.locked}
          </p>
        </aside>

        <div key={sec.key} className="onboard-body rise">
          <h2 className="head" style={{ fontSize: "clamp(1.5rem,3.2vw,2.1rem)", margin: "0 0 .7rem" }}>
            {sec.title}
          </h2>
          {sec.note && (
            <p className="note" style={{ margin: "0 0 1.6rem" }}>
              {sec.note}
            </p>
          )}

          {/* takes whatever height the column has left over, so the row below
              it sits on the bottom of the column instead of wherever this
              section's last field happens to fall */}
          <div className="onboard-fields">
            {sec.fields.map((f) => (
              <div className="field" key={f.k}>
                <label htmlFor={f.k}>{f.label}</label>
                <input
                  id={f.k}
                  value={profile[f.k] ?? ""}
                  onChange={(e) => setField(f.k, e.target.value)}
                  placeholder={f.hint}
                />
              </div>
            ))}
          </div>

          {/* Back, the note and Next on one baseline. The note used to hang
              under the button as a third element with a third gap above it,
              which read as an afterthought rather than a condition of the form
              it belongs to. */}
          <div className="foot">
            {step > 0 && (
              <button className="btn ghost" onClick={() => go(`/questions?n=${step}`)}>
                Back
              </button>
            )}
            <p className="foot-note">{OPTIONAL_NOTE}</p>
            <span className="foot-go">
              <button className="btn solid" onClick={advance}>
                Next
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
