# Bureau of What Ifs

Answer a handful of questions about your life; three alternate versions of it
come back.

## Running it

```bash
npm install
cp .env.example .env.local   # pick a provider, add a key
npm run dev
```

## Choosing a model provider

`.env.example` has working blocks for four. Swap by env vars alone — nothing in
the app knows which one is answering.

| | cost | card needed | notes |
|---|---|---|---|
| **Anthropic** | paid | yes | best prose; the default |
| **Google AI Studio** | free tier | no | free-tier inputs may train their models |
| **Groq** | free tier | no | fast, open models |
| **Ollama** | free | no key | fully local and private |

Prose quality *is* the product here, and the prompts lean on a long list of
prohibitions that smaller models struggle to hold. Free providers are fine for
proving the plumbing works. Judge the writing on a strong one.

One thing to weigh before pointing this at a free tier with real users: the
input is somebody's actual life — hometown, family, friends' names. Providers
that train on free-tier traffic are fine while you're testing on yourself and
not fine after that.

`npm test` runs the unit tests, `npm run typecheck` the types.

## How it works

`POST /api/generate` streams server-sent events:

| event | meaning |
|---|---|
| `status` | sent immediately, before any model call |
| `mapped` | the cartographer chose its three branches |
| `life` | one finished life — fires a lock in the sweep |
| `dropped` | one branch failed; the others continue |
| `complete` | all done |
| `error` | the run failed |

Two model calls deep:

1. **Cartographer** (Sonnet) — rolls nine operator combinations locally, writes a
   premise for each, and picks the best three: one *near*, one *far*, one
   *parallel*.
2. **Author** (Opus) — writes each chosen life. All three run in parallel and
   each streams out the moment it lands, so the first card is readable before the
   third has finished.

The first event goes out before any model call, which keeps the response inside
the platform's streaming window. Waiting on the model is I/O, not active CPU, so
a minute spent idle costs almost nothing.

## Why the prompts look like that

Each rule in `lib/prompts.ts` exists because the model broke something without
it:

- **Two zones** — anything before a divergence is the reader's real past.
  Inventing a detail there isn't a liberty, it's a factual error they'll catch.
- **Standing facts** — no family business, inheritance, or useful relative unless
  the profile named one. These are shortcuts that let a life look plausible
  without the divergence causing it.
- **The ledger** — negated events are listed explicitly in the payload, because
  long generations lose track of what they removed.
- **Arithmetic** — every age is precomputed in `lib/roll.ts`. The model is never
  asked to do date maths, because it gets it wrong.
- **No era labels** — naming a stretch of a life is interpreting it.
- **Incommensurable** — no life may be straightforwardly better or worse than the
  reader's. The one with the money is lonelier.

## Determinism

`seedFrom` hashes the normalised answers, so the same answers always produce the
same operator rolls. `lib/roll.ts` is pure and unit-tested; the model chooses
prose, never structure.

## Before this goes public

- `lib/rateLimit.ts` is in-memory, so it only holds within one warm instance.
  Move it to Upstash or equivalent.
- Nothing is stored — refreshing loses the lives. Storage is deliberately
  deferred.
- Vercel's Hobby plan is personal, non-commercial use only.
