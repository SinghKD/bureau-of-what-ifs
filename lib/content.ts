/** Everything the reader sees, in one place, so copy edits never touch layout. */
import type { Role } from "./types";

export const NAME = "Bureau of What Ifs";
export const HERO = "Out there in the multiverse, you're living all the lives you almost chose.";
export const SUB = "Check what your multiversal variants are up to.";
/** The register wall behind the landing, and the count above the wordmark. */
export const REGISTER = {
  /* every entry on the wall reads "EARTH #4471"; the number is seeded */
  entry: "Earth",
  label: "Worlds on file",
  /* where the count stands when the door opens. It climbs from here. */
  start: 4402119,
};

/** The card screen. */
export const RESULTS = {
  heading: (n: number) => `${n} variant${n === 1 ? "" : "s"} found across the multiverse`,
  hint: "Open one to read the life.",
  pending: "Still resolving",
};

/** The expanded single-life page. */
export const READING = {
  /* A matched pair: these two head facing columns, so they have to be the same
     shape of phrase. "In your timeline" beside "This timeline" reads as a
     caption next to a heading rather than as the other half of a comparison. */
  here: "This timeline",
  yours: "Your timeline",
  both: "The same in both",
  back: "Back to all variants",
  diverged: "Diverged",
  signal: "Signal",
  prose: "Prose",
  notes: "Notes",
  /** how loudly this variant comes through: five bars for close, one for distant */
  bars: { near: 5, parallel: 3, far: 1 } as Record<Role, number>,
  reach: (n: number) => `Signal strength ${n} of 5`,
};

/* Shares a line with Back and Next now, so it is the short form: the clause
   about nothing being compulsory was saying the same thing a second time. */
export const OPTIONAL_NOTE = "Answer as much or as little as you want.";

export const ROLE_LABEL: Record<Role, string> = {
  near: "Close",
  parallel: "Alongside",
  far: "Distant",
};

/** Muted, so none of them competes with amber. Amber means you. */
export const ACCENTS = ["#9e93c4", "#7fb0a3", "#c4879b"];

export type Field = { k: string; label: string; hint: string };
export type Screen = { key: string; title: string; note: string; fields: Field[] };

/**
 * Labels are short on purpose: they sit in a fixed-width mono column beside the
 * input, and anything that wraps breaks the row rhythm of the whole form. The
 * detail lives in the hint, where it costs nothing.
 */
export const SCREENS: Screen[] = [
  {
    key: "constants",
    title: "Who you are in this universe",
    note: "Some basic facts about you, to track your signature across the multiverse.",
    fields: [
      { k: "birth_year", label: "Birth year", hint: "1994" },
      { k: "gender", label: "Gender", hint: "however you'd put it" },
      { k: "grew_up", label: "Hometown", hint: "where you grew up" },
      { k: "family", label: "Family", hint: "parents, siblings" },
      { k: "friends_home", label: "Old friends", hint: "from growing up — first names" },
    ],
  },
  {
    key: "now",
    title: "Where you are now",
    note: "",
    fields: [
      { k: "living_now", label: "City", hint: "where you are these days" },
      { k: "household", label: "Household", hint: "alone, partner, family, flatmates" },
      { k: "partner", label: "Partner", hint: "name, how long, or leave it" },
    ],
  },
  {
    key: "doing",
    title: "What you do",
    note: "Plain words work better than job titles.",
    fields: [
      { k: "work", label: "Work", hint: "write software, teach, drive" },
      { k: "skills", label: "Skills", hint: "cook, argue, fix bikes" },
      { k: "hobbies", label: "Free time", hint: "where it goes" },
      { k: "friends_college", label: "College friends", hint: "first names" },
      { k: "friends_now", label: "Work friends", hint: "first names" },
    ],
  },
  {
    key: "leverage",
    title: "What else is in you",
    note: "Small and odd beats impressive.",
    fields: [
      { k: "young_talent", label: "Once good at", hint: "when younger, and stopped" },
      { k: "keepsake", label: "Keepsake", hint: "something you'd never throw out" },
      { k: "bad_habit", label: "Worst habit", hint: "" },
      { k: "never_been", label: "Never been", hint: "somewhere you meant to go" },
    ],
  },
];

/** The right-hand column of the onboarding. */
export const TRIANGULATION = {
  label: "Locating prime",
  located: "Prime located",
  /* a section with nothing in it never takes a bearing, and four bearings is
     what a fix needs — so this is a failure, and says so */
  unlocated: "Could not locate prime",
  short: "Not enough questions answered",
  region: "Region",
  /* under the lock: a place, not a readout — the percentage has done its work
     by the time the fix closes */
  place: "Your current location on the multiverse map",
  bearings: "bearings",
  timeline: "Timeline",
  searching: "No bearing yet. Answer anything to take the first",
  hint: "Each screen is a station. Skipped fields leave its corridor wide.",
  unresolved: "Unresolved — blank screens never acquired",
  locked: "Fix acquired",
  proceed: "Proceed",
};

export const EVENT_SCREEN = {
  key: "events",
  /* The header bar's right-hand slot. The questionnaire puts a counter there;
     the canon events are a separate record rather than a fifth section, so
     they name themselves instead of continuing the count. */
  eyebrow: "Canon events",
  title: "Your life's canon events",
  note: "Defining moments, turning points, or just something cool that happened to you. Oldest first. Don't think too hard.",
  /* Stated, not inferred: two inputs on one row are otherwise a guessing game. */
  colYear: "Year",
  colWhat: "What happened",
  yearHint: "YYYY",
  whatHint: "what happened",
  recorded: "recorded",
  order: "Put rows in year order",
  back: "\u2190 Back",
  /* Two notes, because the row they sit in is also what explains a sweep that
     cannot be run yet: below the floor it names the floor, above it there is
     nothing left to say but that the remaining rows are not owed. */
  minimum: "Two events is the minimum — the rest are optional.",
  optional: "The rest are optional.",
  /* what the button does, not where it goes */
  run: "Run multiversal sweep",
};

/** The divergence chart under the ledger. */
export const TREE = {
  birth: "Birth",
  now: "Now",
  prime: "Your current timeline",
  diverged: "Diverged timeline",
  undated: "\u2014",
  /* the chart is decorative; this is what a screen reader gets instead */
  sr: (n: number, of: number) => `${n} of ${of} events recorded`,
};
