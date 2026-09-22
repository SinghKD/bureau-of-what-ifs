"use client";

/**
 * Consumes the SSE stream. `found` is simply how many lives have arrived, which
 * is what drives the sweep — the animation is a real progress indicator, not a
 * timer.
 */
import { useCallback, useRef, useState } from "react";
import type { Ev, Life, Profile } from "./types";

export type Phase = "idle" | "sweeping" | "mapped" | "done" | "error";

export function useGeneration() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lives, setLives] = useState<Life[]>([]);
  const [dropped, setDropped] = useState<{ role: string; reason: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    setPhase("idle");
    setLives([]);
    setDropped([]);
    setError(null);
  }, [cancel]);

  const run = useCallback(
    async (profile: Profile, events: Ev[]) => {
      cancel();
      const ac = new AbortController();
      abort.current = ac;

      setPhase("sweeping");
      setLives([]);
      setDropped([]);
      setError(null);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile, events }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          const msg = await res.json().catch(() => ({ error: "Request failed." }));
          throw new Error(msg.error ?? "Request failed.");
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          const frames = buf.split("\n\n");
          buf = frames.pop() ?? "";

          for (const frame of frames) {
            if (!frame.trim() || frame.startsWith(":")) continue;
            const ev = frame.match(/^event: (.+)$/m)?.[1];
            const raw = frame.match(/^data: (.+)$/m)?.[1];
            if (!ev || !raw) continue;

            let data: unknown;
            try {
              data = JSON.parse(raw);
            } catch {
              continue;
            }

            if (ev === "mapped") setPhase("mapped");
            else if (ev === "life") setLives((l) => [...l, data as Life]);
            else if (ev === "dropped") setDropped((d) => [...d, data as never]);
            else if (ev === "complete") setPhase("done");
            else if (ev === "error") {
              setError((data as { message: string }).message);
              setPhase("error");
            }
          }
        }

        setPhase((p) => (p === "error" ? p : "done"));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(String((e as Error).message ?? e));
        setPhase("error");
      } finally {
        abort.current = null;
      }
    },
    [cancel],
  );

  return { run, cancel, reset, phase, lives, dropped, error, found: lives.length };
}
