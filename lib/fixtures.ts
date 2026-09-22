/**
 * Three lives, written by hand, for working on the results UI without spending
 * model requests — a sweep costs four of a twenty-a-day quota.
 *
 * They are built to the same rules the author prompt is held to, so the layout
 * is exercised against realistic content rather than lorem: three paragraphs of
 * 70-90 words, nine to eleven points, one or two sentences of `now`, one role
 * each, exactly one of them materially worse off, and no two in the same
 * register. Lengths deliberately differ — the shortest `now` is one line on a
 * card and the longest is five — so wrapping shows up here rather than in
 * production.
 *
 * They all diverge from one source life: born 1994 in Chandigarh, took a job
 * instead of a masters in 2013, moved to Bangalore in 2017, started writing
 * again in 2021, keeps a ticket stub.
 */
import type { Life, Profile } from "./types";

/**
 * The source life the three below diverge from. The reading page sets each
 * variant's attributes against these, so the rail needs a profile to compare to
 * — one left blank (household) so the "omit the row entirely" path is exercised
 * rather than only the happy one.
 */
export const DEMO_PROFILE: Profile = {
  birth_year: "1994",
  grew_up: "Chandigarh",
  living_now: "Bangalore, Koramangala",
  work: "write payments software",
  hobbies: "cycling, badly",
  household: "",
  keepsake: "a ticket stub",
};

/**
 * Where the sweep puts its lock marks in demo mode, in 0..1 of the frame — the
 * shape `survivors()` hands back, so the sweep is exercised with marks rather
 * than falling through to its fixed fallback positions.
 */
export const DEMO_MARKS = [
  { x: 0.36, y: 0.44 },
  { x: 0.61, y: 0.29 },
  { x: 0.47, y: 0.63 },
];

/** How the demo sweep fills up: one life at each of these, in ms. */
export const DEMO_ARRIVALS = [2200, 3400, 4600];
export const DEMO_HANDOFF = 5900;

export const DEMO_LIVES: Life[] = [
  {
    earth: 4417,
    role: "near",
    divergence_year: 2021,
    divergence:
      "In 2021 he did not start writing again. The notebook went into the drawer with the ticket stub and stayed there.",
    now: "He is four years into the same payments company in Bangalore, running a team of six, on a commute he could ride blindfolded.",
    paragraphs: [
      "In 2013 he took the job instead of the masters. In 2017 he moved to Bangalore, into a flat in Koramangala with a balcony too narrow to sit on. The work was payments, and mostly reconciliation — the slow unglamorous half of it. He turned out to be good at that. By 2019 he was reading everyone else's code on Friday afternoons. He bought a steel-framed bike from a shop on 100 Feet Road and rode it in every day for six years.",
      "What filled the evenings instead was other people's problems. A junior who could not stop rewriting things. An on-call rotation nobody wanted and he kept taking. A migration that ran eleven months and shipped on a Sunday afternoon, to no comment at all. He learned how to end a meeting. He learned which arguments were worth having and which ones cost more than they returned. The title changed twice. The work moved further from the code and closer to the calendar.",
      "He rides on Sunday mornings with a group that meets at six near Cubbon Park, and he is the one who knows the route. His parents come down in December and stay eleven days. The balcony still has nothing on it. There is a document he opens perhaps twice a year, three paragraphs long, that he has not added to since 2021 and has not deleted either. It is titled with a year and nothing else.",
    ],
    points: [
      "Took the job in 2013, moved to Bangalore in 2017.",
      "Payments. Reconciliation, mostly.",
      "Same company for nine years.",
      "Six people report to him.",
      "Steel-framed bike, bought on 100 Feet Road.",
      "Rides Sundays at six, near Cubbon Park.",
      "Knows the route better than anyone in the group.",
      "Eleven-month migration, shipped on a Sunday.",
      "Parents visit every December.",
      "A three-paragraph document, untouched since 2021.",
      "The ticket stub is in the drawer with it.",
    ],
    attributes: [
      { dimension: "living_now", here: "the same flat in Koramangala, nine years in" },
      { dimension: "work", here: "running six people who write payments software" },
      { dimension: "hobbies", here: "Sunday mornings on the bike, leading the group" },
      { dimension: "household", here: "alone, and the balcony is still empty" },
    ],
    carried_over: ["the ticket stub", "the steel-framed bike", "December with his parents"],
  },
  {
    earth: 8102,
    role: "parallel",
    divergence_year: 2013,
    divergence: "In 2013 he turned the job down and took the masters instead.",
    now: "He teaches two undergraduate courses in Pune and consults for a logistics firm three days a month. He owns more books than furniture.",
    paragraphs: [
      "The masters took two years and the first eighteen months of them were a mistake he could not afford to admit. He read badly and slept late. Then a professor handed him a problem about routing that nobody in the department cared about, and he cared about it, and that was the whole turn. He wrote four papers. Two were ignored. One was cited by a company in Rotterdam that later tried to hire him and could not match what Pune was paying.",
      "He stayed in the department because the department let him keep the problem. The teaching came as a condition and then stopped being one. He is unhurried in front of a room in a way he is not anywhere else. Twice a year he takes the train to Chandigarh and comes back with a bag of things his mother has decided he needs. The consulting pays for the books. The books have taken the second bedroom entirely.",
      "He cycles, badly, on a hybrid he has never maintained. There is a student from his 2019 cohort who mails him every few months from Berlin with questions he has to look up. The routing problem is still open. He has a folder of approaches that did not work, forty-one of them, numbered, and he can tell you what is wrong with each one without opening it.",
    ],
    points: [
      "Turned down the job in 2013. Took the masters.",
      "Eighteen months of it wasted, by his own account.",
      "A routing problem nobody in the department wanted.",
      "Four papers. Two ignored.",
      "One cited by a company in Rotterdam.",
      "They tried to hire him. Pune paid better.",
      "Teaches two undergraduate courses.",
      "Consults three days a month, which buys the books.",
      "The books have taken the second bedroom.",
      "Forty-one failed approaches, numbered, in a folder.",
    ],
    attributes: [
      { dimension: "living_now", here: "two rooms in Pune, one of them all books" },
      { dimension: "work", here: "teaching, and a routing problem nobody asked for" },
      { dimension: "hobbies", here: "a hybrid he has never once maintained" },
    ],
    carried_over: ["the train to Chandigarh", "a bicycle he does not look after"],
  },
  {
    earth: 2960,
    role: "far",
    divergence_year: 2013,
    divergence:
      "In 2013 he took neither the job nor the masters. He stayed in Chandigarh and the year went by.",
    now: "He repairs and resells bicycles out of a rented unit in Sector 22, mostly alone, and knows every frame builder within two hundred kilometres by their welds.",
    paragraphs: [
      "The year he did not decide anything turned into three. He did the kind of work that is arranged by phone: a cousin's shop for a while, then a cyber cafe that closed, then eight months at a printing press where he learned to read a job by its margins. Money came in small and went out the same way. He was twenty-two, then twenty-five. Nobody in Chandigarh asked him what he was doing, which was the difficulty and also the relief.",
      "The bicycles started as a way of not being in the house. Someone left a frame outside the press and he took it apart on the floor to see how it went together. He was better at it than at anything he had been paid for. The unit in Sector 22 came in 2016, eleven thousand a month, with a shutter that has never closed straight. He does not advertise. The work arrives because someone told someone.",
      "He knows the welders in Ludhiana by name and they know what he will and will not accept. There is a wall of frames waiting for parts that may not come. He earns less than he would have anywhere else and he is not quiet about that. On Thursdays four or five people end up in the unit for no reason connected to bicycles, and stay until the shutter comes down.",
    ],
    points: [
      "Stayed in Chandigarh. Never left.",
      "Three years of work arranged by phone.",
      "A cousin's shop, a cyber cafe, eight months at a press.",
      "Learned to read a print job by its margins.",
      "Took apart a frame someone left outside the press.",
      "The unit in Sector 22 since 2016, eleven thousand a month.",
      "The shutter has never closed straight.",
      "No advertising. Work arrives by word of mouth.",
      "Knows the Ludhiana welders by name.",
      "Earns less than he would have anywhere else, and says so.",
      "Thursdays, four or five people, until the shutter comes down.",
    ],
    attributes: [
      { dimension: "living_now", here: "Chandigarh, and he never left it" },
      { dimension: "work", here: "a rented unit in Sector 22, bicycles, alone" },
      { dimension: "hobbies", here: "the bicycles are the work and the rest of it" },
    ],
    carried_over: ["Chandigarh", "Thursdays with four or five people"],
  },
];
