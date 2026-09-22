"use client";

/**
 * A sea of candidate worlds, panned through as if by hand. Three parallax layers
 * on a canvas; the drift eases off as each signal locks, so the animation
 * resolves into stillness rather than being cut off by the scene change.
 *
 * `found` is driven by lives actually arriving over the stream, not by a timer.
 */
import { useEffect, useRef } from "react";
import { mulberry32 } from "@/lib/roll";
import { ACCENTS } from "@/lib/content";

const LOCKS = [
  { left: "23%", top: "31%" },
  { left: "69%", top: "57%" },
  { left: "43%", top: "74%" },
];

export function Sweep({
  found,
  labels = [],
  marks = [],
}: {
  found: number;
  labels?: number[];
  /** Survivors from the triangulation, in 0..1 of the frame. */
  marks?: { x: number; y: number }[];
}) {
  const spots = (marks.length ? marks.slice(0, LOCKS.length) : []).map((m) => ({
    left: `${(m.x * 100).toFixed(2)}%`,
    top: `${(m.y * 100).toFixed(2)}%`,
  }));
  const at = spots.length ? [...spots, ...LOCKS].slice(0, LOCKS.length) : LOCKS;

  const ref = useRef<HTMLCanvasElement>(null);
  const foundRef = useRef(found);
  foundRef.current = found;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rnd = mulberry32(3312);

    const layers = [
      { n: 260, speed: 0.01, size: [0.35, 0.9], alpha: 0.2 },
      { n: 150, speed: 0.024, size: [0.7, 1.5], alpha: 0.34 },
      { n: 70, speed: 0.046, size: [1.2, 2.4], alpha: 0.55 },
    ].map((L) => ({
      ...L,
      stars: Array.from({ length: L.n }, () => ({
        x: rnd(),
        y: rnd(),
        r: L.size[0] + rnd() * (L.size[1] - L.size[0]),
        a: L.alpha * (0.45 + rnd() * 0.55),
        tw: rnd() * Math.PI * 2,
      })),
    }));

    let raf = 0;
    let W = 0;
    let H = 0;

    const resize = () => {
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const settle = 1 - foundRef.current * 0.3;
      ctx.clearRect(0, 0, W, H);

      for (const L of layers) {
        const ox = (t * L.speed * settle + Math.sin(t * 0.11) * 0.012) % 1;
        const oy = (t * L.speed * 0.34 * settle + Math.cos(t * 0.08) * 0.016) % 1;
        for (const s of L.stars) {
          const x = (((s.x - ox) % 1) + 1) % 1;
          const y = (((s.y - oy) % 1) + 1) % 1;
          const tw = reduced ? 1 : 0.72 + 0.28 * Math.sin(t * 0.9 + s.tw);
          ctx.beginPath();
          ctx.arc(x * W, y * H, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(158,147,196,${(s.a * tw).toFixed(3)})`;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <canvas
        ref={ref}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {at.slice(0, found).map((l, i) => (
        <div key={i} className="lockmark pop" style={{ left: l.left, top: l.top }}>
          <span className="ping" style={{ borderColor: ACCENTS[i] }} />
          <span className="ring" style={{ borderColor: ACCENTS[i] }} />
          <span className="dot" style={{ background: ACCENTS[i] }} />
          <span className="label" style={{ color: ACCENTS[i] }}>
            {labels[i] ? `Earth #${labels[i]}` : "Signal"}
          </span>
        </div>
      ))}
    </div>
  );
}
