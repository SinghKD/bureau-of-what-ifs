"use client";

import { useRouter } from "next/navigation";
import { Onboarding } from "@/components/Onboarding";

export default function EventsPage() {
  const router = useRouter();
  return <Onboarding phase="events" step={0} go={(to) => router.push(to)} />;
}
