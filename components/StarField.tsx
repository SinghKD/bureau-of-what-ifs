"use client";

/**
 * Constants are fixed points, not divergences — so they light up rather than
 * branch. One star per answered field, with faint links between them.
 */
import { useMemo } from "react";
import { mulberry32 } from "@/lib/roll";

export function StarField({
  total,
  filled,
  seed = 91,
}: {
  total: number;
  filled: number;
  seed?: number;
}) {
  const pts = useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: total }, (_, i) => ({
      x: 34 + (i * 532) / Math.max(total - 1, 1) + (rnd() - 0.5) * 26,
      y: 24 + rnd() * 48,
    }));
  }, [total, seed]);

  return (
    <svg viewBox="0 0 600 96" height="96" width="100%" aria-hidden="true">
      {pts.slice(1).map((p, i) =>
        i + 1 < filled ? (
          <path
            key={`l${i}`}
            className="seg"
            pathLength="1"
            fill="none"
            stroke="var(--lilac)"
            strokeWidth="0.75"
            opacity="0.28"
            d={`M${pts[i].x} ${pts[i].y} Q${(pts[i].x + p.x) / 2} ${
              (pts[i].y + p.y) / 2 - 10
            } ${p.x} ${p.y}`}
          />
        ) : null,
      )}
      {pts.map((p, i) => (
        <g key={i}>
          {i < filled && (
            <circle cx={p.x} cy={p.y} r="7" fill="var(--amber)" opacity="0.1" className="fade" />
          )}
          <circle
            cx={p.x}
            cy={p.y}
            r={i < filled ? 2.6 : 1.4}
            fill={i < filled ? "var(--amber)" : "#3a3646"}
            style={{ transition: "fill 600ms ease, r 600ms ease" }}
          />
        </g>
      ))}
    </svg>
  );
}
