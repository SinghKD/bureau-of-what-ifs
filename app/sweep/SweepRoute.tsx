"use client";

/**
 * The only route that spends model requests. It runs once per arrival and
 * replaces itself with /results, so Back from the results skips over a sweep
 * that has already happened rather than landing on a dead progress screen.
 *
 * `?demo` runs the same screen off a timer instead of the model, which is what
 * makes the hand-off into /results workable on without a quota. It never calls
 * generate and never reads or writes stored state.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sweep } from "@/components/Sweep";
import { useJourney } from "@/components/Journey";
import { DEMO_ARRIVALS, DEMO_HANDOFF, DEMO_LIVES, DEMO_MARKS } from "@/lib/fixtures";

export function SweepRoute() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("demo");
  const demo = raw === "" ? "all" : raw;
  const demoing = demo !== null;
  /* a bare number pins the screen at that many found, for working on one frame
     of it; anything else plays the sequence through to the results */
  const pinned = demo !== null && /^[0-3]$/.test(demo) ? Number(demo) : null;

  const { ready, profile, events, marks, gen } = useJourney();
  const fired = useRef(false);
  const [arrived, setArrived] = useState(0);

  const filled = events.filter((e) => e.text.trim());

  useEffect(() => {
    if (demoing || !ready || fired.current) return;
    if (filled.length < 2) {
      router.replace("/events");
      return;
    }
    fired.current = true;
    gen.run(profile, events);
  }, [demoing, ready, filled.length, profile, events, gen, router]);

  useEffect(() => {
    if (demoing) return;
    if (gen.phase === "done" || gen.phase === "error") router.replace("/results");
  }, [demoing, gen.phase, router]);

  // the demo sequence: lives land one at a time, then it hands over
  useEffect(() => {
    if (!demoing || pinned !== null || demo === "error") return;
    const t = [
      ...DEMO_ARRIVALS.map((ms, i) => setTimeout(() => setArrived(i + 1), ms)),
      setTimeout(() => router.replace("/results?demo=all"), DEMO_HANDOFF),
    ];
    return () => t.forEach(clearTimeout);
  }, [demoing, pinned, demo, router]);

  useEffect(() => {
    if (demo !== "error") return;
    const t = setTimeout(() => router.replace("/results?demo=error"), DEMO_HANDOFF);
    return () => clearTimeout(t);
  }, [demo, router]);

  const found = demoing ? (pinned ?? arrived) : gen.found;
  const failed = demoing ? demo === "error" : !!gen.error;
  const labels = demoing
    ? DEMO_LIVES.slice(0, found).map((l) => l.earth)
    : gen.lives.map((l) => l.earth);

  return (
    <div style={{ position: "relative", minHeight: "100dvh", overflow: "hidden" }}>
      <Sweep found={found} labels={labels} marks={demoing ? DEMO_MARKS : marks} />
      <div
        className="eyebrow"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "12vh",
          transform: "translateX(-50%)",
          zIndex: 2,
          textAlign: "center",
        }}
      >
        {failed
          ? "The sweep failed"
          : found === 0
            ? "Sweeping the register"
            : found === 1
              ? "One signal holding"
              : found === 2
                ? "Two signals holding"
                : "Three found"}
      </div>
    </div>
  );
}
