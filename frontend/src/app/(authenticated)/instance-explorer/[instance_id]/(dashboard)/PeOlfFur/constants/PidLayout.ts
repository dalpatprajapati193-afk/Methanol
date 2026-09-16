// ── Dynamic P&ID layout engine (2D) ────────────────────────────────────────────
// VERTICAL: the diagram is laid out top-to-bottom from the set of ACTIVE lanes. A
// lane that is definitively inactive (exists === 0) is dropped and the lanes below
// reflow upward, shrinking the viewBox height.
// HORIZONTAL: the processing chain is laid out left-to-right from the set of present
// process STAGES. Boxes sit at a uniform pitch; mix/split nodes sit at the midpoint
// between surviving boxes. Stages whose feature is off collapse away and the chain
// re-flows leftward, shrinking the viewBox width:
//   - no general F+R header → drop 1ST SPLIT + RED F+R
//   - no cross-recycle      → drop CROSS RCY MIX + TOTAL FEED
//   - no general total feed → drop 2ND SPLIT + RED TF
//   - no spillover          → drop 3RD SPLIT/MIX
//   - FRESH, OWN RCY MIX, F+R HDR and GEN headers are always kept — except F+R HDR is
//     dropped when nothing survives between it and the GEN headers (they'd be redundant).
// Unresolved values (=== null, still being answered) keep their lane/stage visible so
// the user can resolve them. This module is purely derivational — it reads vars and
// never writes back to state.
import { PidVars } from '../store/FmsAtoms';

type Val = 0 | 1 | null;

export const ROW = 52;          // vertical pitch between pipe lines
const Y0 = 49;                  // y of the first (top) header line
const BOTTOM_PAD = 47;          // space under the last line for the column-label row

const BOX_PITCH = 260;                 // reference box-to-box pitch (base section = half)
export const BASE_Z = BOX_PITCH / 2;   // 130 — normal section/zone width
export const END_Z  = BASE_Z * 1.5;    // 195 — ONLY the first & last sections are 1.5× wider
export const BOX_HALF = 64;            // half-width of a normal (middle) box
export const END_HALF = 96;            // half-width of the wider first/last boxes (1.5×)
export const CONTENT_L = 1;            // x of the leftmost box edge
const FRESH_CX = CONTENT_L + END_Z / 2;        // centre of the incoming boxes
export const LANE_X0 = FRESH_CX + END_HALF;    // right edge of incoming boxes (lanes start here)
const MARGIN = 24;                     // symmetric dead space on each side of the content
// Full reference content width = all 11 columns present (2 end sections + 9 base sections).
export const FULL_WIDTH = 2 * END_Z + 9 * BASE_Z;   // = 1560
export const VIEW_X = CONTENT_L - MARGIN;     // viewBox x (symmetric margins)
export const VIEW_W = FULL_WIDTH + 2 * MARGIN;

export interface HBar { y: number; x1: number; x2: number; }
export type BoxKey = 'fresh' | 'fxr' | 'redfr' | 'total' | 'redtf' | 'gen';

export interface PidLayout {
  // ── vertical ──
  ethActive: boolean; proActive: boolean; butActive: boolean;
  gtfActive: boolean; gfrActive: boolean; napActive: boolean;
  ethY: number; proY: number; butY: number;
  gtfY: number; gfrY: number; napY: number;
  ethRcyY: number | null; proRcyY: number | null; butRcyY: number | null; napRcyY: number | null;
  height: number;
  hbars: HBar[];
  headerY: (feed: string) => number;
  // ── horizontal ──
  boxPresent: Record<BoxKey, boolean>;
  boxX: Partial<Record<BoxKey, number>>;
  genX: number;
  centerDx: number;   // horizontal shift to centre collapsed content in the fixed viewBox
  mn1X: number;   // own rcy mix node column (always present)
  sp1X: number;   // 1st split midpoint / gen-FR junction (0 when absent)
  xmixX: number;  // cross rcy mix midpoint (0 when absent)
  sp2X: number;   // 2nd split midpoint / gen-TF junction (0 when absent)
  sp3X: number;   // 3rd split/mix midpoint (0 when absent)
  crossOn: boolean; spillOn: boolean;
}

// Only ACTIVE (=== 1) lanes/stages/lines are shown. Anything not active (off or not
// yet answered) is hidden and collapsed away — there is no greyed/unresolved state.
const on = (x: Val) => x === 1;

// Per-feed split-node stagger (so the gen legs fan to a shared junction).
export const SP_OFF: Record<string, number> = { eth: -32.5, pro: 0, but: 32.5 };
// 3rd-split / mix node offsets within their shared column.
export const SP3_OFF = -39.6;
export const MN3_OFF = 39.6;
// Spillover fan endpoint offsets within the 3rd-split column.
export const SPILL_OFF1 = -34.1;
export const SPILL_OFF2 = 34.1;
// Cross-recycle drop offsets within the CROSS RCY MIX column, per source→target.
export const XRCY_OFF: Record<string, Record<string, number>> = {
  eth: { pro: -47.5, but: -29 },
  pro: { eth: -10.5, but: 8 },
  but: { eth: 26.5, pro: 45 },
};

const CROSS_KEYS = ['rcy_eth_to_pro','rcy_eth_to_but','rcy_pro_to_eth','rcy_pro_to_but','rcy_but_to_eth','rcy_but_to_pro'];
const SPILL_KEYS = ['eth_spill_pro','eth_spill_but','pro_spill_eth','pro_spill_but','but_spill_eth','but_spill_pro'];

export function computePidLayout(v: PidVars): PidLayout {
  // ── VERTICAL ──
  const ethActive = on(v['eth_exists'] as Val);
  const proActive = on(v['pro_exists'] as Val);
  const butActive = on(v['but_exists'] as Val);
  const gtfActive = on(v['gen_tf_exists'] as Val);
  const gfrActive = on(v['gen_fr_exists'] as Val);
  const napFresh  = on(v['nap_exists'] as Val);   // nap_exists mirrors ff_nap
  const napRcy    = on(v['rcy_nap'] as Val);
  const napActive = napFresh || napRcy;

  const ethRcy = ethActive && on(v['rcy_eth'] as Val);
  const proRcy = proActive && on(v['rcy_pro'] as Val);
  const butRcy = butActive && on(v['rcy_but'] as Val);

  let y = Y0;
  let ethY = 0, proY = 0, butY = 0, gtfY = 0, gfrY = 0, napY = 0;
  let ethRcyY: number | null = null, proRcyY: number | null = null,
      butRcyY: number | null = null, napRcyY: number | null = null;

  if (ethActive) { ethY = y; y += ROW; if (ethRcy) { ethRcyY = y; y += ROW; } }
  if (proActive) { proY = y; y += ROW; if (proRcy) { proRcyY = y; y += ROW; } }
  if (butActive) { butY = y; y += ROW; if (butRcy) { butRcyY = y; y += ROW; } }
  if (gtfActive) { gtfY = y; y += ROW; }
  if (gfrActive) { gfrY = y; y += ROW; }
  // Naphtha fresh/main on top (its master header then aligns one ROW below the last
  // general header — same pitch as the other lanes — instead of leaving an empty
  // right-side gap), with the recycle-liquid stub below it. Mirrors the eth/pro/but
  // convention where the master sits on the fresh row.
  if (napActive) { napY = y; y += ROW; if (napRcy) { napRcyY = y; y += ROW; } }

  const height = (y - ROW) + BOTTOM_PAD;

  // ── HORIZONTAL ──
  const crossOn = CROSS_KEYS.some(k => on(v[k] as Val));
  const spillOn = SPILL_KEYS.some(k => on(v[k] as Val));

  // Ordered chain of stations: process boxes alternate with transformation nodes. A
  // station is present per its feature.
  interface Station { key: string; box: boolean; present: boolean; }
  const chain: Station[] = [
    { key: 'fresh', box: true,  present: true },
    { key: 'mn1',   box: false, present: true },       // own rcy mix (always kept)
    { key: 'fxr',   box: true,  present: true },
    { key: 'sp1',   box: false, present: gfrActive },  // gen-FR split
    { key: 'redfr', box: true,  present: gfrActive },
    { key: 'xmix',  box: false, present: crossOn },    // cross rcy mix join
    { key: 'total', box: true,  present: crossOn },
    { key: 'sp2',   box: false, present: gtfActive },  // gen-TF split
    { key: 'redtf', box: true,  present: gtfActive },
    { key: 'sp3',   box: false, present: spillOn },    // 3rd split/mix
    { key: 'gen',   box: true,  present: true },
  ];
  const live = chain.filter(s => s.present);
  // Trailing-box collapse: a box immediately before the master with no node between
  // them is redundant (its state IS the master header) — drop it and shift the master
  // left into its place. Repeats; stops at the first node (own-mix always guards FRESH).
  // This subsumes the F+R-HDR-adjacent-to-master rule and extends it to TOTAL/RED TF/
  // RED F+R.
  for (;;) {
    const gi = live.findIndex(s => s.key === 'gen');
    const prev = live[gi - 1];
    if (prev && prev.box && prev.key !== 'fresh') live.splice(gi - 1, 1);
    else break;
  }

  // Columns laid out by ZONE width, left→right. The first & last sections (the visible
  // end boxes) get a 1.5× zone; every other section — including the mix/split node zones —
  // is the base width. Each column is centred in its own zone, so node spacing stays
  // uniform and only the ends are wider.
  const xOf: Record<string, number> = {};
  let cursor = CONTENT_L;
  live.forEach((s, i) => {
    const zw = (i === 0 || i === live.length - 1) ? END_Z : BASE_Z;
    xOf[s.key] = cursor + zw / 2;
    cursor += zw;
  });

  const has = (k: string) => k in xOf;
  const boxPresent: Record<BoxKey, boolean> = {
    fresh: has('fresh'), fxr: has('fxr'), redfr: has('redfr'),
    total: has('total'), redtf: has('redtf'), gen: has('gen'),
  };
  const boxX: Partial<Record<BoxKey, number>> = {};
  (['fresh','fxr','redfr','total','redtf','gen'] as BoxKey[]).forEach(k => { if (boxPresent[k]) boxX[k] = xOf[k]; });

  const genX = xOf['gen'];
  // Content spans the tiled zones (no reserved space beyond the last box). The viewBox
  // keeps a FIXED reference width (the full, all-sections layout) so the horizontal scale
  // never changes when stages collapse; a narrower chain is centred within it, which keeps
  // left/right dead space equal.
  const contentW = cursor - CONTENT_L;
  const centerDx = (FULL_WIDTH - contentW) / 2;

  const mn1X  = xOf['mn1'];
  const sp1X  = gfrActive ? xOf['sp1'] : 0;           // gen-FR junction
  const xmixX = crossOn   ? xOf['xmix'] : 0;          // cross rcy mix
  const sp2X  = gtfActive ? xOf['sp2'] : 0;           // gen-TF junction
  const sp3X  = spillOn   ? xOf['sp3'] : 0;           // 3rd split/mix

  // Horizontal bars that vertical drops must hop over — extents follow the layout.
  const HX_R  = genX;                                 // right end of the header lines

  // Real rightmost x reached by a feed's VISIBLE recycle horizontal line. The own-mix
  // loop reaches mn1X; cross-recycle trunks extend only to the farthest ACTIVE cross
  // target. Returns null when the row draws no horizontal pipe at all. Registering the
  // true extent (rather than a generous global band) stops vertical drops from hopping
  // over a recycle row at x-positions where that row has no pipe — the phantom-hop fix.
  const targetActive = (t: string) => t === 'eth' ? ethActive : t === 'pro' ? proActive : butActive;
  const rcyRightExtent = (f: 'eth' | 'pro' | 'but'): number | null => {
    if (!on(v['rcy_' + f] as Val)) return null;
    let ext = -Infinity;
    if (on(v[`rcy_${f}_to_${f}`] as Val)) ext = Math.max(ext, mn1X);   // own-mix self loop
    if (crossOn) {
      Object.keys(XRCY_OFF[f]).forEach(t => {
        if (on(v[`rcy_${f}_to_${t}`] as Val) && targetActive(t))
          ext = Math.max(ext, xmixX + XRCY_OFF[f][t]);
      });
    }
    return ext === -Infinity ? null : ext;
  };

  const hbars: HBar[] = [];
  const pushRcy = (y: number | null, f: 'eth' | 'pro' | 'but') => {
    if (y == null) return;
    const ext = rcyRightExtent(f);
    if (ext != null) hbars.push({ y, x1: LANE_X0, x2: ext });
  };
  if (ethActive)        hbars.push({ y: ethY,    x1: LANE_X0, x2: HX_R });
  pushRcy(ethRcyY, 'eth');
  if (proActive)        hbars.push({ y: proY,    x1: LANE_X0, x2: HX_R });
  pushRcy(proRcyY, 'pro');
  if (butActive)        hbars.push({ y: butY,    x1: LANE_X0, x2: HX_R });
  pushRcy(butRcyY, 'but');
  if (gtfActive)        hbars.push({ y: gtfY,    x1: sp2X, x2: HX_R });
  if (gfrActive)        hbars.push({ y: gfrY,    x1: sp1X, x2: HX_R });
  if (napActive)        hbars.push({ y: napY,    x1: LANE_X0, x2: HX_R });

  const headerY = (feed: string): number =>
    feed === 'eth' ? ethY : feed === 'pro' ? proY : feed === 'but' ? butY : 0;

  return {
    ethActive, proActive, butActive, gtfActive, gfrActive, napActive,
    ethY, proY, butY, gtfY, gfrY, napY,
    ethRcyY, proRcyY, butRcyY, napRcyY,
    height, hbars, headerY,
    boxPresent, boxX, genX, centerDx,
    mn1X, sp1X, xmixX, sp2X, sp3X, crossOn, spillOn,
  };
}

// ── Vertical drop with semicircular hops over crossed horizontal bars ───────────
export const HOP_R = 7;

export function vdrop(x: number, yStart: number, yEnd: number, hbars: HBar[]): string {
  const down = yEnd > yStart;
  const lo = Math.min(yStart, yEnd), hi = Math.max(yStart, yEnd);
  const cs = hbars
    .filter(b => x > b.x1 && x < b.x2 && b.y > lo + HOP_R && b.y < hi - HOP_R)
    .map(b => b.y)
    .sort((a, b) => (down ? a - b : b - a));
  let d = `M ${x} ${yStart}`;
  for (const c of cs) {
    if (down) d += ` L ${x} ${c - HOP_R} A ${HOP_R} ${HOP_R} 0 0 0 ${x} ${c + HOP_R}`;
    else      d += ` L ${x} ${c + HOP_R} A ${HOP_R} ${HOP_R} 0 0 1 ${x} ${c - HOP_R}`;
  }
  d += ` L ${x} ${yEnd}`;
  return d;
}

// ── Inclined spillover hops (3rd-split crossover fan) ───────────────────────────
export interface Seg { id: string; x1: number; y1: number; x2: number; y2: number; }

function segCross(a: Seg, b: Seg): { x: number; y: number } | null {
  const rx = a.x2 - a.x1, ry = a.y2 - a.y1, sx = b.x2 - b.x1, sy = b.y2 - b.y1;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const qx = b.x1 - a.x1, qy = b.y1 - a.y1;
  const t = (qx * sy - qy * sx) / denom, u = (qx * ry - qy * rx) / denom, e = 1e-6;
  if (t > e && t < 1 - e && u > e && u < 1 - e) return { x: a.x1 + t * rx, y: a.y1 + t * ry };
  return null;
}

export function spillPath(L: Seg, segs: Seg[]): string {
  const up = L.y2 < L.y1;
  if (!up) return `M ${L.x1} ${L.y1} L ${L.x2} ${L.y2}`;
  const len = Math.hypot(L.x2 - L.x1, L.y2 - L.y1);
  const ux = (L.x2 - L.x1) / len, uy = (L.y2 - L.y1) / len;
  const cs = segs
    .filter(M => M.id !== L.id && M.y2 > M.y1)
    .map(M => segCross(L, M))
    .filter((p): p is { x: number; y: number } => !!p)
    .map(p => ({ p, dist: (p.x - L.x1) * ux + (p.y - L.y1) * uy }))
    .sort((a, b) => a.dist - b.dist)
    .map(o => o.p);
  let d = `M ${L.x1} ${L.y1}`;
  for (const p of cs) {
    const ax = (p.x - HOP_R * ux).toFixed(2), ay = (p.y - HOP_R * uy).toFixed(2);
    const bx = (p.x + HOP_R * ux).toFixed(2), by = (p.y + HOP_R * uy).toFixed(2);
    d += ` L ${ax} ${ay} A ${HOP_R} ${HOP_R} 0 0 0 ${bx} ${by}`;
  }
  d += ` L ${L.x2} ${L.y2}`;
  return d;
}

// Builds the active spill segments from the active feeds' header Ys (at the 3rd-split
// column), then returns each spill id → path (with hops computed among the active set).
export function buildSpillPaths(layout: PidLayout, isActive: (id: string) => boolean): Record<string, string> {
  if (!layout.spillOn) return {};
  const x1 = layout.sp3X + SPILL_OFF1, x2 = layout.sp3X + SPILL_OFF2;
  const feeds = (['eth', 'pro', 'but'] as const).filter(f =>
    f === 'eth' ? layout.ethActive : f === 'pro' ? layout.proActive : layout.butActive);
  // Only ACTIVE spills are built, so the jump-over hops are computed against real
  // crossings only — an active spill never hops over an inactive (invisible) one.
  const segs: Seg[] = [];
  for (const a of feeds) for (const b of feeds) {
    if (a === b) continue;
    const id = `s-${a}-spill-${b}`;
    if (isActive(id)) segs.push({ id, x1, y1: layout.headerY(a), x2, y2: layout.headerY(b) });
  }
  const out: Record<string, string> = {};
  for (const s of segs) out[s.id] = spillPath(s, segs);
  return out;
}
