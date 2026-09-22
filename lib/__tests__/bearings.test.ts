import { describe, expect, it } from "vitest";
import { SCREENS } from "../content";
import { liveStations, regionPercent } from "../../components/Triangulation";
import type { Profile } from "../types";

const fill = (screen: number, n: number): Profile =>
  Object.fromEntries(SCREENS[screen].fields.slice(0, n).map((f) => [f.k, "x"]));

describe("triangulation corridors", () => {
  it("narrows the corridor on every single answer", () => {
    SCREENS.forEach((sc, i) => {
      let prev = Infinity;
      for (let n = 1; n <= sc.fields.length; n++) {
        const h = liveStations(fill(i, n)).find((_, k) => k === 0)!.h;
        expect(h, `screen ${i + 1}, answer ${n} did not move the beam`).toBeLessThan(prev);
        prev = h;
      }
    });
  });

  it("never lets more information produce a worse fix", () => {
    const keys = SCREENS.flatMap((s) => s.fields.map((f) => f.k));
    const p: Profile = {};
    let prev = regionPercent(p);
    for (const k of keys) {
      p[k] = "x";
      const now = regionPercent(p);
      expect(now, `answering ${k} widened the region`).toBeLessThanOrEqual(prev + 1e-9);
      prev = now;
    }
    expect(prev).toBeLessThan(5);
  });
});
