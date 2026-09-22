"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Onboarding } from "@/components/Onboarding";
import { SCREENS } from "@/lib/content";

/**
 * `?n=` is the section, 1..4, or `lock` for the fix. It stays on one route so
 * the questionnaire is one component across the whole sequence — which is what
 * lets the map travel from the column to the centre without a remount.
 */
export function Questions() {
  const router = useRouter();
  const n = useSearchParams().get("n") ?? "1";
  const locked = n === "lock";
  const step = Math.min(Math.max(Number(n) || 1, 1), SCREENS.length) - 1;

  return (
    <Onboarding
      phase={locked ? "located" : "form"}
      step={step}
      go={(to) => router.push(to)}
    />
  );
}
