import { Suspense } from "react";
import { SweepRoute } from "./SweepRoute";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SweepRoute />
    </Suspense>
  );
}
