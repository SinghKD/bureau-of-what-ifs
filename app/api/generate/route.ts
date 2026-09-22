/**
 * Streams the pipeline as server-sent events.
 *
 * The first event goes out before any model call, which keeps the response
 * inside the platform's streaming window. Everything after that is idle time
 * waiting on the model, which does not count as active CPU.
 */
import { z } from "zod";
import { CARTOGRAPHER, AUTHOR } from "@/lib/prompts";
import { callJSON } from "@/lib/model";
import { seedFrom, rollBranches, factsFor, describeBranch } from "@/lib/roll";
import { allow, ipFrom } from "@/lib/rateLimit";
import type { Life, Premise } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  profile: z.record(z.string(), z.string().max(300)).default({}),
  events: z
    .array(
      z.object({
        id: z.string(),
        year: z.string().regex(/^\d{0,4}$/),
        text: z.string().max(400),
      }),
    )
    .max(5),
});

export async function POST(req: Request) {
  const ip = ipFrom(req);
  const gate = allow(ip);
  if (!gate.ok) {
    return Response.json(
      { error: "Too many sweeps from this address. Try again later." },
      { status: 429, headers: { "retry-after": String(gate.retryAfter) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const { profile } = parsed.data;
  const events = parsed.data.events.filter((e) => e.text.trim());
  if (events.length < 2) {
    return Response.json({ error: "Give us at least two events." }, { status: 400 });
  }

  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (!open) return;
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      // keeps intermediaries from buffering the connection shut while we wait
      const ping = setInterval(() => {
        if (open) controller.enqueue(enc.encode(": ping\n\n"));
      }, 15000);

      try {
        send("status", { phase: "sweeping" });

        const seed = seedFrom(profile, events);
        const facts = factsFor(profile, events);
        const branches = rollBranches(events, seed).map((b) => describeBranch(b, events));

        const map = await callJSON<{ chosen: Premise[] }>(
          "map",
          CARTOGRAPHER,
          JSON.stringify({ profile, facts, events, branches }),
          req.signal,
        );

        const chosen = (map.chosen ?? []).slice(0, 3);
        if (chosen.length === 0) throw new Error("nothing came back from the map stage");
        send("mapped", { count: chosen.length });

        // author all three at once; emit each the moment it lands
        await Promise.all(
          chosen.map(async (c) => {
            const branch = branches.find((b) => b.id === c.id);
            try {
              const life = await callJSON<Omit<Life, "role" | "divergence_year">>(
                "author",
                AUTHOR,
                JSON.stringify({
                  profile,
                  facts,
                  events,
                  branch: { ...branch, premise: c.premise, register: c.register },
                  divergence_year: branch?.divergence_year ?? null,
                  siblings: chosen.filter((s) => s.id !== c.id).map((s) => s.premise),
                }),
                req.signal,
              );
              // the derived year wins: what the card shows and what the prose
              // says then come from one number, not two guesses at it
              send("life", {
                ...life,
                role: c.role,
                divergence_year: branch?.divergence_year ?? null,
              });
            } catch (err) {
              // one failure should cost one life, not the whole sweep
              send("dropped", { role: c.role, reason: String((err as Error).message) });
            }
          }),
        );

        send("complete", { seed });
      } catch (err) {
        send("error", { message: String((err as Error).message ?? err) });
      } finally {
        clearInterval(ping);
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
