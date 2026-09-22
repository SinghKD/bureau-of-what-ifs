"use client";

/**
 * Cards first, then one life per screen.
 *
 * Never side by side: three lives in a row invites ranking, and none of these
 * lives is meant to be better than another. Cards arrive as they stream in, so
 * you can start reading the first before the third has finished writing.
 */
import { useMemo, useState } from "react";
import { ACCENTS, READING, RESULTS, ROLE_LABEL } from "@/lib/content";
import type { Profile } from "@/lib/types";
import type { Life } from "@/lib/types";

export function Results({
  lives,
  pending,
  profile,
  open: openEarth,
  onOpen,
  onRestart,
}: {
  lives: Life[];
  pending: number;
  /** the reader's own answers — the reference the rail is set against */
  profile: Profile;
  /** the earth designation in the URL, or null for the card screen */
  open: string | null;
  onOpen: (earth: number | null) => void;
  onRestart: () => void;
}) {
  const [mode, setMode] = useState<"prose" | "notes">("prose");
  /* Addressed by designation rather than by index: the cards stream in, so an
     index would point at a different life depending on when it was captured,
     and the URL has to outlive that. */
  const open = openEarth === null ? -1 : lives.findIndex((l) => String(l.earth) === openEarth);

  if (open < 0) {
    return (
      <div className="stage" style={{ maxWidth: "84rem", width: "100%", margin: "0 auto" }}>
        <div className="rise">
          {/* the dashed placeholder cards already say a sweep is still running,
              so the count does not need saying twice */}
          <h2 className="found">{RESULTS.heading(lives.length)}</h2>

          <div className="cards">
            {lives.map((v, i) => (
              <button
                key={v.earth ?? i}
                className="card rise"
                style={
                  {
                    "--acc": ACCENTS[i % ACCENTS.length],
                    animationDelay: `${i * 120}ms`,
                  } as React.CSSProperties
                }
                onClick={() => {
                  setMode("prose");
                  onOpen(v.earth);
                }}
              >
                <div className="eyebrow" style={{ color: ACCENTS[i % ACCENTS.length] }}>
                  {ROLE_LABEL[v.role] ?? "Elsewhere"}
                </div>
                <h3>Earth #{v.earth}</h3>
                <div className="eyebrow" style={{ marginBottom: ".9rem" }}>
                  Diverged {v.divergence_year}
                </div>
                {/* where the life stands now, not the turn that got it there —
                    the divergence itself is on the page behind the card */}
                <p className="card-now">{v.now?.trim() || v.divergence}</p>
              </button>
            ))}

            {Array.from({ length: pending }).map((_, i) => (
              <div
                key={`p${i}`}
                className="card"
                style={{ cursor: "default", opacity: 0.45, borderStyle: "dashed" }}
                aria-hidden="true"
              >
                <div className="eyebrow">{RESULTS.pending}</div>
                <h3 style={{ color: "var(--faint)" }}>Earth #&mdash;&mdash;&mdash;&mdash;</h3>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "1.4rem", alignItems: "center", marginTop: "2rem" }}>
            <p className="note" style={{ fontSize: ".8125rem", margin: 0 }}>
              {RESULTS.hint}
            </p>
            <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={onRestart}>
              Start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  const v = lives[open];
  const acc = ACCENTS[open % ACCENTS.length];
  const bars = READING.bars[v.role] ?? 3;

  /* Derived: a dimension only earns a row if the variant named it AND the reader
     actually answered it. A row with one side missing is not a comparison, and
     showing it half-empty would read as a gap rather than as a difference. */
  const rows = useMemo(
    () =>
      (v.attributes ?? [])
        .map((a) => ({
          key: a.dimension,
          here: (a.here ?? "").trim(),
          yours: (profile[a.dimension] ?? "").trim(),
        }))
        .filter((r) => r.here && r.yours)
        .slice(0, 4),
    [v, profile],
  );
  const same = (v.carried_over ?? []).filter((c) => c.trim());

  return (
    <div className="read" style={{ "--acc": acc } as React.CSSProperties}>
      <div className="stage readpage">
        <div key={v.earth} className="open">
          <header className="read-head">
            <div>
              <div className="eyebrow" style={{ color: acc }}>
                {ROLE_LABEL[v.role] ?? "Elsewhere"}
              </div>
              <h2 className="read-earth">Earth #{v.earth}</h2>
            </div>
            <div className="read-meta">
              {READING.diverged} {v.divergence_year} <span className="dot">·</span>{" "}
              {READING.signal}{" "}
              <span className="bars" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <i key={i} data-on={i < bars} />
                ))}
              </span>
              <span className="sr">{READING.reach(bars)}</span>
            </div>
          </header>

          <p className="display read-div">{v.divergence}</p>

          <div className="read-grid">
            <div>
              <div className="toggle" style={{ marginBottom: "2.2rem" }}>
                <button data-on={mode === "prose"} onClick={() => setMode("prose")}>
                  {READING.prose}
                </button>
                <button data-on={mode === "notes"} onClick={() => setMode("notes")}>
                  {READING.notes}
                </button>
              </div>

              {mode === "prose" ? (
                <div className="life">
                  {v.paragraphs.map((p, i) => (
                    <p key={i} className="rise" style={{ animationDelay: `${i * 140}ms` }}>
                      {p}
                    </p>
                  ))}
                </div>
              ) : (
                <ul className="notes">
                  {v.points.map((p, i) => (
                    <li key={i} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* The build is the point: this life, then the reader's own, then the
                one thing that survived both. It descends to the payload and gets
                brighter as it goes, and that order holds on every screen. */}
            <aside className="rail fade">
              {rows.length > 0 && (
                /* A table, and not for want of a simpler tag: this is two
                   columns of values that only mean anything paired by row — the
                   flat here, the flat there — and the pairing has to survive
                   being read aloud as well as being looked at. Two lists sitting
                   one above the other had the same data in the same order and
                   showed none of that. */
                <table className="rail-pair">
                  <thead>
                    <tr>
                      <th scope="col" style={{ color: acc }}>
                        {READING.here}
                      </th>
                      <th scope="col" style={{ color: "var(--lilac)" }}>
                        {READING.yours}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <td className="is-here">{r.here}</td>
                        <td className="is-yours">{r.yours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {same.length > 0 && (
                <section className="rail-both">
                  <h3 className="rail-label" style={{ color: "var(--amber)" }}>
                    {READING.both}
                  </h3>
                  <ul className="rail-list is-same">
                    {same.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>

          <footer className="read-foot">
            <button className="btn ghost" onClick={() => onOpen(null)}>
              &larr; {READING.back}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
