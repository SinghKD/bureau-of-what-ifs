"use client";

/**
 * Never generates. Lives are persisted the moment they arrive, so a reload here
 * reads them back rather than spending another four model requests; with none
 * to show, it hands back to the last screen that can produce some.
 *
 * `?demo` is the exception: hand-written lives from lib/fixtures, so the results
 * UI can be worked on without a sweep and without going through the
 * questionnaire first. It is opt-in and never touches stored state, so it
 * cannot be reached by accident or leave anything behind.
 */
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Results } from "@/components/Results";
import { useJourney } from "@/components/Journey";
import { DEMO_LIVES, DEMO_PROFILE } from "@/lib/fixtures";

export function ResultsRoute() {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("earth");
  const raw = params.get("demo");
  // `?demo` on its own is the finished screen
  const demo = raw === "" ? "all" : raw;
  const { ready, lives: real, profile, gen, restart } = useJourney();

  /* all: the finished screen. partial: one in, two still sweeping — the dashed
     placeholder cards. error: the failure panel. */
  const demoing = demo !== null;
  const shown =
    demo === "partial" ? DEMO_LIVES.slice(0, 1) : demo === "error" ? [] : DEMO_LIVES;
  const lives = demoing ? shown : real;
  const pendingDemo = demo === "partial" ? 2 : 0;
  const error = demo === "error" ? "model 429: quota exhausted for this project" : gen.error;

  const nothing = ready && !demoing && real.length === 0 && gen.phase !== "sweeping";
  useEffect(() => {
    if (nothing && gen.phase !== "error") router.replace("/events");
  }, [nothing, gen.phase, router]);

  const keep = (to: string) => (demoing ? `${to}${to.includes("?") ? "&" : "?"}demo=${demo}` : to);

  if (!ready && !demoing) return null;

  if (error && lives.length === 0) {
    return (
      <div className="stage" style={{ maxWidth: "40rem" }}>
        <div className="err">{error}</div>
        <div style={{ marginTop: "2rem" }}>
          <button
            className="btn solid"
            onClick={() => {
              restart();
              router.push("/");
            }}
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  return (
    <Results
      lives={lives}
      profile={demoing ? DEMO_PROFILE : profile}
      pending={
        demoing
          ? pendingDemo
          : gen.phase === "done" || gen.phase === "error"
            ? 0
            : Math.max(0, 3 - real.length)
      }
      open={open}
      onOpen={(earth) => router.push(keep(earth === null ? "/results" : `/results?earth=${earth}`))}
      onRestart={() => {
        if (demoing) {
          router.push("/results?demo=all");
          return;
        }
        restart();
        router.push("/");
      }}
    />
  );
}
