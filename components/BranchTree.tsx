"use client";

/**
 * The divergence chart. All of the geometry — and the argument for why nothing
 * crosses — lives in lib/tree.ts; this file only draws it.
 *
 * Growth is seamless because the whole five-year tree is built once from a
 * fixed seed and the levels are six fixed slots: committing an event reveals
 * lines whose geometry was already decided rather than recomputing anything.
 * Each level interval is its own <path>, so a new year appends elements and
 * never edits one already on screen — which is also why nothing already drawn
 * replays its draw-in.
 */
import { useMemo } from "react";
import { TREE } from "@/lib/content";
import { buildTree, levelY, FADE, LEVELS, RULE, VH, VW, WIDTH, YB, YT, r2 } from "@/lib/tree";
import type { Ev } from "@/lib/types";

/* ------------------------------------------------------------------- view */
export function BranchTree({ events, live }: { events: Ev[]; live?: Ev[] }) {
  /* Chart order is year order — sorting the input rows is a separate courtesy.
     Undated rows fall in after the dated ones and are labelled with a dash. */
  const marked = useMemo(() => {
    const filled = events.filter((e) => e.text.trim());
    return [
      ...filled.filter((e) => e.year).sort((a, b) => Number(a.year) - Number(b.year)),
      ...filled.filter((e) => !e.year),
    ].slice(0, LEVELS - 1);
  }, [events]);

  const n = marked.length;

  /* A divergence is shaped by the words that caused it. Reading the *live* row
     rather than the committed one means the branch keeps adjusting while you
     are still writing, and does not move at all when the row finally commits —
     the text it commits is the text it was already answering to. */
  const sways = marked
    .map((row) => {
      const text = (live?.find((e) => e.id === row.id) ?? row).text.trim();
      return Math.round(Math.cos(text.length * 0.5) * 1000) / 1000;
    })
    .join(",");
  const tree = useMemo(
    () => buildTree({ sways: sways ? sways.split(",").map(Number) : [] }),
    [sways],
  );

  return (
    <>
      <svg
        className="tree"
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {marked.map((e, i) => (
          <line
            key={`g${i}`}
            className="fade"
            x1={36}
            x2={VW - 8}
            y1={r2(levelY(i))}
            y2={r2(levelY(i))}
            stroke="var(--faint)"
            strokeWidth={0.8}
            strokeDasharray="1 4"
            style={{ animationDelay: "220ms" }}
          />
        ))}

        {tree.segs
          .filter((s) => s.at <= n)
          .map((s) => (
            <path
              key={s.id}
              className="grow"
              d={s.d}
              pathLength={1}
              fill="none"
              stroke={s.gen === 0 ? "var(--amber)" : "var(--dim)"}
              strokeWidth={WIDTH[s.gen]}
              strokeLinecap="round"
              style={{
                d: `path("${s.d}")`,
                opacity: FADE[s.gen],
                // outward from the node: deeper and further along arrive later
                animationDelay: `${Math.max(0, s.gen - 1) * 110 + s.step * 55}ms`,
              }}
            />
          ))}

        <circle cx={r2(tree.xBirth)} cy={YB} r={3.4} fill="var(--bone)" />
        <text x={r2(tree.xBirth)} y={YB + 16} className="glyph" textAnchor="middle" fill="var(--dim)">
          {TREE.birth.toUpperCase()}
        </text>
        <text x={r2(tree.xNow)} y={YT - 10} className="glyph" textAnchor="middle" fill="var(--amber)">
          {TREE.now.toUpperCase()}
        </text>

        {marked.map((e, i) => (
          <g key={`n${i}`}>
            <g className="node" style={{ animationDelay: "120ms" }}>
              <circle
                cx={r2(tree.primeX[i])}
                cy={r2(levelY(i))}
                r={5.6}
                fill="none"
                stroke="var(--rule)"
                strokeWidth={0.9}
              />
              <circle cx={r2(tree.primeX[i])} cy={r2(levelY(i))} r={2.5} fill="var(--amber)" />
            </g>
            <text
              x={4}
              y={r2(levelY(i)) + 3.6}
              className="glyph fade"
              fill={e.year ? "var(--amber)" : "var(--faint)"}
              style={{ animationDelay: "300ms" }}
            >
              {e.year || TREE.undated}
            </text>
          </g>
        ))}

        {/* the legend draws at the chart's own stroke weights, in the chart's
            own coordinates, so the samples cannot drift out of agreement */}
        <line x1={4} x2={VW - 8} y1={RULE} y2={RULE} stroke="var(--rule)" strokeWidth={0.8} />
        <line
          x1={6}
          x2={30}
          y1={RULE + 15}
          y2={RULE + 15}
          stroke="var(--amber)"
          strokeWidth={WIDTH[0]}
          strokeLinecap="round"
          opacity={FADE[0]}
        />
        <text x={38} y={RULE + 18.5} className="glyph" fill="var(--dim)">
          {TREE.prime.toUpperCase()}
        </text>
        <line
          x1={6}
          x2={30}
          y1={RULE + 31}
          y2={RULE + 31}
          stroke="var(--dim)"
          strokeWidth={WIDTH[1]}
          strokeLinecap="round"
          opacity={FADE[1]}
        />
        <text x={38} y={RULE + 34.5} className="glyph" fill="var(--dim)">
          {TREE.diverged.toUpperCase()}
        </text>
      </svg>
      <p className="sr">{TREE.sr(n, LEVELS - 1)}</p>
    </>
  );
}
