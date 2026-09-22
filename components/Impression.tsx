"use client";

/**
 * The subject impression: a contour mesh of a head that builds as the profile is
 * answered, and dissolves into the branch tree when the subject moves on to
 * their canon events.
 *
 * Two things shape the design:
 *
 * - It is derived state. Nothing here is stored; the lit set is recomputed from
 *   `profile` on every render, so the mesh cannot drift out of step with the
 *   answers. A blank field simply never lights its vertices, and because nothing
 *   backfills at the end, the gaps are permanent. The completeness of the head
 *   *is* the feedback about how much has been given.
 *
 * - It is a drawing, not a scan. Points converging on a face is the visual
 *   grammar of biometrics, which is the wrong register for this product — so the
 *   eye sockets stay open loops, there is no reticle or bounding box, the
 *   spacing is deliberately uneven, and the head is turned a little off-axis.
 *   Dead-on symmetry reads as a mask; a slight turn reads as a person.
 */
import { SCREENS } from "@/lib/content";
import { mulberry32 } from "@/lib/roll";
import type { Profile } from "@/lib/types";

const VB_W = 300;
const VB_H = 380;
const CX = 150;
const YAW = 0.30; // the three-quarter turn, in radians
const SPREAD = 0.95; // how far across the face the landmark parameter u sweeps
const SEED = 4242;

type Ring = { key: string; y: number; rx: number; rz: number; xOff: number; zOff: number; flat: number; n: number };

/**
 * Crown to chin. The radii carry the silhouette — widest at the temple and
 * cheekbone, closing to the chin — and xOff drifts the axis so the head leans
 * instead of standing to attention. Ring resolution varies so the mesh is not
 * machined-looking, and so each screen's share comes out near 8 vertices a field.
 */
const RINGS: Ring[] = [
  { key: "crown", y: 52, rx: 70, rz: 82, xOff: 0, zOff: 0, flat: 0.05, n: 6 },
  { key: "upperSkull", y: 82, rx: 94, rz: 112, xOff: 0, zOff: 0, flat: 0.08, n: 10 },
  { key: "temple", y: 114, rx: 101, rz: 121, xOff: 1, zOff: 0, flat: 0.14, n: 12 },
  { key: "brow", y: 140, rx: 102, rz: 122, xOff: 1, zOff: 3, flat: 0.22, n: 14 },
  { key: "eyeLine", y: 172, rx: 100, rz: 120, xOff: 2, zOff: 5, flat: 0.24, n: 14 },
  { key: "cheekbone", y: 206, rx: 94, rz: 110, xOff: 2, zOff: 9, flat: 0.22, n: 14 },
  { key: "noseBase", y: 240, rx: 80, rz: 92, xOff: 3, zOff: 15, flat: 0.18, n: 12 },
  { key: "mouth", y: 268, rx: 70, rz: 78, xOff: 3, zOff: 21, flat: 0.14, n: 12 },
  { key: "jaw", y: 296, rx: 50, rz: 54, xOff: 3, zOff: 30, flat: 0.10, n: 10 },
  { key: "chin", y: 322, rx: 24, rz: 22, xOff: 3, zOff: 40, flat: 0.05, n: 6 },
];

/**
 * Which groups each screen owns. Screen 01 takes the whole silhouette — cranium
 * and jaw — so that one screen in, the shape already reads as a head rather than
 * as scattered marks.
 */
const SCREEN_GROUPS: string[][] = [
  ["crown", "upperSkull", "temple", "jaw", "chin"],
  ["brow", "browLine"],
  ["eyeLine", "cheekbone", "eyeSocket"],
  ["noseBase", "mouth", "noseBridge", "mouthLine"],
];

type Vert = { x: number; y: number; z: number; group: string; owner: number };
type Edge = { a: number; b: number; d: number };
type Quad = { v: number[]; d: number };

function project(rx: number, rz: number, xOff: number, y: number, t: number, zOff = 0, flat = 0) {
  const front = Math.max(0, -Math.sin(t)); // 1 on the face, 0 at the back of the skull
  const x3 = rx * Math.cos(t);
  const z3 = rz * (1 - flat * front) * Math.sin(t) - zOff;
  return {
    x: CX + xOff + x3 * Math.cos(YAW) + z3 * Math.sin(YAW),
    y,
    z: -x3 * Math.sin(YAW) + z3 * Math.cos(YAW),
  };
}

/** A point on the front of the face, `u` sweeping left to right across it. */
function face(
  r: { y: number; rx: number; rz: number; xOff: number; zOff?: number; flat?: number },
  u: number,
  inset = 0.96,
) {
  return project(r.rx * inset, r.rz * inset, r.xOff, r.y, -Math.PI / 2 + u * SPREAD, r.zOff ?? 0, r.flat ?? 0);
}

function buildMesh() {
  const rnd = mulberry32(SEED);
  const verts: Vert[] = [];
  const ringIdx: Record<string, number[]> = {};
  const chains: number[][] = [];

  // every vertex is nudged: a machined mesh reads as a scan, a hand-made one
  // reads as a sketch
  const push = (p: { x: number; y: number; z: number }, group: string) => {
    verts.push({
      x: p.x + (rnd() - 0.5) * 2.6,
      y: p.y + (rnd() - 0.5) * 2.6,
      z: p.z,
      group,
      owner: -1,
    });
    return verts.length - 1;
  };

  for (const r of RINGS) {
    ringIdx[r.key] = Array.from({ length: r.n }, (_, i) =>
      push(project(r.rx, r.rz, r.xOff, r.y, (i / r.n) * Math.PI * 2, r.zOff, r.flat), r.key),
    );
  }

  // ---- landmarks, all sitting on (or just proud of) the face surface
  const BROW = { y: 156, rx: 101, rz: 121, xOff: 1.5, zOff: 4, flat: 0.23 };
  const EYE = { y: 176, rx: 100, rz: 120, xOff: 2, zOff: 6, flat: 0.24 };
  const MOUTH = { y: 272, rx: 64, rz: 74, xOff: 3, zOff: 21, flat: 0.13 };

  for (const [u0, u1] of [
    [-0.64, -0.20],
    [0.20, 0.64],
  ]) {
    chains.push(
      Array.from({ length: 4 }, (_, i) => {
        const u = u0 + ((u1 - u0) * i) / 3;
        const lift = Math.sin((i / 3) * Math.PI) * 3;
        return push(face({ ...BROW, y: BROW.y - lift }, u), "browLine");
      }),
    );
  }

  // open loops, deliberately: a closed ring with anything inside it starts to
  // read as an iris
  for (const u0 of [-0.38, 0.38]) {
    chains.push(
      Array.from({ length: 5 }, (_, i) => {
        const a = 0.30 * Math.PI + (1.5 * Math.PI * i) / 4;
        const u = u0 + Math.cos(a) * 0.22;
        return push(face({ ...EYE, y: EYE.y + Math.sin(a) * 8.5 }, u, 0.965), "eyeSocket");
      }),
    );
  }

  chains.push(
    [156, 184, 212, 240].map((y, i) => {
      const k = i / 3;
      return push(
        face({ y, rx: 101 - 21 * k, rz: 121 - 29 * k, xOff: 1.5 + 1.5 * k, zOff: 4 + 11 * k, flat: 0.22 }, 0.02, 1.03),
        "noseBridge",
      );
    }),
  );

  chains.push(
    Array.from({ length: 5 }, (_, i) => {
      const u = -0.30 + (0.6 * i) / 4;
      return push(face({ ...MOUTH, y: MOUTH.y + Math.abs(u) * 5 }, u), "mouthLine");
    }),
  );

  // ---- ownership: each screen's groups split across that screen's fields
  let fieldBase = 0;
  SCREENS.forEach((screen, s) => {
    const groups = SCREEN_GROUPS[s] ?? [];
    const mine: number[] = [];
    verts.forEach((v, i) => {
      if (groups.includes(v.group)) mine.push(i);
    });
    const n = screen.fields.length;
    mine.forEach((vi, k) => {
      verts[vi].owner = fieldBase + Math.min(n - 1, Math.floor((k * n) / mine.length));
    });
    fieldBase += n;
  });

  // ---- edges
  const edges: Edge[] = [];
  const depth = (a: number, b: number) => (verts[a].z + verts[b].z) / 2;

  for (const r of RINGS) {
    const idx = ringIdx[r.key];
    for (let i = 0; i < idx.length; i++) {
      const a = idx[i], b = idx[(i + 1) % idx.length];
      edges.push({ a, b, d: depth(a, b) });
    }
  }
  for (let k = 0; k + 1 < RINGS.length; k++) {
    const A = ringIdx[RINGS[k].key], B = ringIdx[RINGS[k + 1].key];
    for (let i = 0; i < A.length; i++) {
      const a = A[i], b = B[Math.round((i * B.length) / A.length) % B.length];
      edges.push({ a, b, d: depth(a, b) });
    }
  }
  for (const chain of chains) {
    for (let i = 0; i + 1 < chain.length; i++) {
      edges.push({ a: chain[i], b: chain[i + 1], d: depth(chain[i], chain[i + 1]) });
    }
  }

  // ---- quads: the faint fill that turns a wireframe into a surface
  const quads: Quad[] = [];
  for (let k = 0; k + 1 < RINGS.length; k++) {
    const A = ringIdx[RINGS[k].key], B = ringIdx[RINGS[k + 1].key];
    for (let i = 0; i < A.length; i++) {
      const i2 = (i + 1) % A.length;
      const j = Math.round((i * B.length) / A.length) % B.length;
      const j2 = Math.round((i2 * B.length) / A.length) % B.length;
      const v = [A[i], A[i2], B[j2], B[j]];
      quads.push({ v, d: (verts[v[0]].z + verts[v[2]].z) / 2 });
    }
  }

  const maxZ = Math.max(...verts.map((v) => Math.abs(v.z))) || 1;
  return { verts, edges, quads, maxZ };
}

const MESH = buildMesh();

/**
 * Everything that reaches an attribute is rounded first. Math.sin and Math.cos
 * are not required to be correctly rounded, so Node and the browser can disagree
 * in the last bit — which is invisible on screen but is a hydration mismatch,
 * and React will not patch attributes up.
 */
const r1 = (n: number) => n.toFixed(1);
const r3 = (n: number) => +n.toFixed(3);
const FIELDS = SCREENS.flatMap((s) => s.fields);

/** Front of the head reads stronger than the back, which is what gives it volume. */
const facing = (d: number) => 0.5 - d / (2 * MESH.maxZ);

export function Impression({
  profile,
  dissolving = false,
}: {
  profile: Profile;
  dissolving?: boolean;
}) {
  const answered = FIELDS.map((f) => (profile[f.k] ?? "").trim() !== "");
  const lit = (i: number) => {
    const o = MESH.verts[i].owner;
    return o >= 0 && answered[o];
  };

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <g
        style={{
          transformBox: "view-box",
          transformOrigin: `${CX}px 190px`,
          transform: dissolving ? "scale(1.55)" : "none",
          opacity: dissolving ? 0 : 1,
          transition: "transform 800ms var(--ease), opacity 800ms ease",
        }}
      >
        {MESH.quads.map((q, i) =>
          q.v.every(lit) ? (
            <polygon
              key={`q${i}`}
              className="fade"
              points={q.v.map((v) => `${r1(MESH.verts[v].x)},${r1(MESH.verts[v].y)}`).join(" ")}
              fill="var(--lilac)"
              fillOpacity={0.04}
            />
          ) : null,
        )}

        {MESH.edges.map((e, i) =>
          lit(e.a) && lit(e.b) ? (
            <path
              key={`e${i}`}
              className="seg"
              pathLength="1"
              fill="none"
              stroke="var(--lilac)"
              strokeWidth={0.6}
              strokeLinecap="round"
              strokeOpacity={r3(0.26 + 0.24 * facing(e.d))}
              style={{ animationDuration: "600ms" }}
              d={`M${r1(MESH.verts[e.a].x)} ${r1(MESH.verts[e.a].y)} L${r1(MESH.verts[e.b].x)} ${r1(
                MESH.verts[e.b].y,
              )}`}
            />
          ) : null,
        )}

        {MESH.verts.map((v, i) =>
          lit(i) ? (
            <circle
              key={`v${i}`}
              className="fade"
              cx={r1(v.x)}
              cy={r1(v.y)}
              r={1.6}
              fill="var(--amber)"
              fillOpacity={r3(0.55 + 0.45 * facing(v.z))}
            />
          ) : null,
        )}
      </g>
    </svg>
  );
}
