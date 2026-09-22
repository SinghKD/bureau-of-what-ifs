"use client";

/**
 * Everything the reader has said, and everything that came back, held above the
 * routes so it survives a navigation and a reload.
 *
 * Two rules make the rest of it work:
 *
 * - `ready` gates every redirect. sessionStorage cannot be read while
 *   rendering — the server has no such thing, and reading it during render
 *   would mismatch the first client paint — so it is restored in an effect, one
 *   tick after mount. A page that redirects before that tick would bounce
 *   someone off /results the instant they refreshed it, which is the whole
 *   problem this is here to solve.
 *
 * - The generation is never restarted from stored state. Lives are persisted,
 *   so returning to /results reads them; only /sweep ever calls the model, and
 *   a sweep costs four model requests.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { seedFrom } from "@/lib/roll";
import { useGeneration } from "@/lib/useGeneration";
import type { Ev, Life, Profile } from "@/lib/types";

const KEY = "bureau.journey.v1";

export type Mark = { x: number; y: number };

export const blankEvents = (): Ev[] =>
  Array.from({ length: 5 }, (_, i) => ({ id: `e${i + 1}`, year: "", text: "" }));

type Saved = {
  started: boolean;
  profile: Profile;
  events: Ev[];
  committed: Ev[];
  lives: Life[];
  marks: Mark[];
};

const empty = (): Saved => ({
  started: false,
  profile: {},
  events: blankEvents(),
  committed: blankEvents(),
  lives: [],
  marks: [],
});

type Ctx = {
  ready: boolean;
  started: boolean;
  begin: () => void;
  profile: Profile;
  setField: (k: string, v: string) => void;
  events: Ev[];
  setEvents: (f: (e: Ev[]) => Ev[]) => void;
  committed: Ev[];
  commit: () => void;
  lives: Life[];
  marks: Mark[];
  setMarks: (m: Mark[]) => void;
  seed: number;
  settleSeed: () => void;
  gen: ReturnType<typeof useGeneration>;
  restart: () => void;
};

const JourneyContext = createContext<Ctx | null>(null);

export function useJourney() {
  const c = useContext(JourneyContext);
  if (!c) throw new Error("useJourney must be used inside <Journey>");
  return c;
}

export function Journey({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Saved>(empty);
  const [ready, setReady] = useState(false);
  const [seed, setSeed] = useState(() => seedFrom({}, blankEvents()));
  const gen = useGeneration();

  // restore once, after mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setState({ ...empty(), ...(JSON.parse(raw) as Saved) });
    } catch {
      // a private window, or storage turned off: start fresh rather than fail
    }
    setReady(true);
  }, []);

  // lives arrive on the stream; fold them in so a reload on /results has them
  const arrived = gen.lives;
  useEffect(() => {
    if (arrived.length) setState((s) => ({ ...s, lives: arrived }));
  }, [arrived]);

  const first = useRef(true);
  useEffect(() => {
    if (!ready) return;
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // over quota or blocked — the session still works, it just will not survive
    }
  }, [state, ready]);

  const setField = useCallback((k: string, v: string) => {
    setState((s) => ({ ...s, profile: { ...s.profile, [k]: v } }));
  }, []);

  const setEvents = useCallback((f: (e: Ev[]) => Ev[]) => {
    setState((s) => ({ ...s, events: f(s.events) }));
  }, []);

  const commit = useCallback(() => {
    setState((s) => ({ ...s, committed: s.events.map((e) => ({ ...e })) }));
  }, []);

  const begin = useCallback(() => setState((s) => ({ ...s, started: true })), []);
  const setMarks = useCallback((m: Mark[]) => setState((s) => ({ ...s, marks: m })), []);

  const settleSeed = useCallback(() => {
    setState((s) => {
      setSeed(seedFrom(s.profile, s.events));
      return s;
    });
  }, []);

  const restart = useCallback(() => {
    gen.reset();
    setState(empty());
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  }, [gen]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      started: state.started,
      begin,
      profile: state.profile,
      setField,
      events: state.events,
      setEvents,
      committed: state.committed,
      commit,
      // whatever is streaming in wins; otherwise what was stored
      lives: gen.lives.length ? gen.lives : state.lives,
      marks: state.marks,
      setMarks,
      seed,
      settleSeed,
      gen,
      restart,
    }),
    [ready, state, begin, setField, setEvents, commit, setMarks, seed, settleSeed, gen, restart],
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}
