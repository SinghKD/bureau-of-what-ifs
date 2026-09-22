"use client";

/**
 * The landing. Coming back here from inside the sequence — a Back press, or the
 * logo — must not replay seven seconds of animation at someone who has already
 * watched it, so the intro is handed straight to its final frame once the
 * journey has started.
 */
import { useRouter } from "next/navigation";
import { Intro } from "@/components/Intro";
import { useJourney } from "@/components/Journey";

export default function Landing() {
  const router = useRouter();
  const { ready, started, begin } = useJourney();

  return (
    <Intro
      skip={ready && started}
      onBegin={() => {
        begin();
        router.push("/questions?n=1");
      }}
    />
  );
}
