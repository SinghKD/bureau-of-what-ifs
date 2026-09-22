import { Suspense } from "react";
import { ResultsRoute } from "./ResultsRoute";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResultsRoute />
    </Suspense>
  );
}
