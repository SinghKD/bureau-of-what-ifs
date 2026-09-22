import { Suspense } from "react";
import { Questions } from "./Questions";

// useSearchParams needs a boundary for this page to prerender
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Questions />
    </Suspense>
  );
}
