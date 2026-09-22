export type Role = "near" | "parallel" | "far";

export type Ev = { id: string; year: string; text: string };

export type Profile = Record<string, string>;

/** One alternate life, as returned by the author stage. */
export type Life = {
  earth: number;
  role: Role;
  divergence_year: number | null;
  divergence: string;
  /** where this variant's life stands now — what the card shows */
  now: string;
  paragraphs: string[];
  points: string[];
  /**
   * The rail. `dimension` is a profile key the reader actually filled in, so the
   * variant's version can be set against their own answer; `here` is this
   * branch's version of it.
   */
  attributes: { dimension: string; here: string }[];
  /** What is the same in this branch as in the source life. */
  carried_over: string[];
};

export type Premise = {
  id: string;
  role: Role;
  premise: string;
  register: string;
};
