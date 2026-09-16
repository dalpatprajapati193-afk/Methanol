/**
 * ── Furnace Product App — Surface & component recipes (single source of truth) ──
 *
 * The third styling layer, sibling to the two that already exist:
 *   • COLOUR      → globals.css tokens + THEME.md    (bg-surface, border-border, accent-*)
 *   • TYPOGRAPHY  → TextTypes.ts (the 13 TEXT tokens)
 *   • STRUCTURE   → THIS FILE — the shape/scaffold of every recurring surface:
 *                   tiles, tables, capsule tabs, segmented toggles, inputs,
 *                   buttons, badges, modals, cards.
 *
 * A component never hand-rolls `rounded-2xl border-2 hover:-translate-y-0.5 …`
 * again; it references a recipe (`TILE.base`) and inherits the canonical shape.
 * Change a recipe here once → every consumer updates.
 *
 * The recipes are distilled verbatim from the KPI / Package Selection page
 * (`PkgSelectionPage.tsx`), which is the agreed reference for the light-mode look.
 *
 * RULES
 *  • Recipes carry STRUCTURE only — radius, border, elevation, hover, flex
 *    scaffold, and the semantic COLOUR tokens that are intrinsic to the shape
 *    (e.g. a tile's `bg-surface`, a tab's active `bg-accent-blue`). They never
 *    hardcode a hex or a raw Tailwind colour.
 *  • SIZE / POSITION generally stay on the element (same rule as TextTypes): a
 *    column's width, a button's `min-w-*` are layout and belong at the call site.
 *    THE EXCEPTION is the grid tile: its footprint is canonical (`TILE.size` /
 *    `TILE.pad`) so every tile in the app matches — callers must NOT hardcode a
 *    tile width/min-height. Override only for a deliberate, documented one-off.
 *  • Compose with the local `cn()` (clsx + tailwind-merge) so later classes win
 *    when a consumer needs a one-off override.
 *  • Class strings must be STATIC LITERALS (Tailwind can't see interpolated
 *    names). That's why the accent maps below are spelled out rather than
 *    built from a variable.
 */

// ── TILE ────────────────────────────────────────────────────────────────────
// The shared chassis for every clickable tile/card in a grid. Both tile
// families rest on the SAME neutral chassis (grey border → blue hover edge):
//   • "select"  — adds a persistent blue fill when chosen (package cards, landing)
//   • "status"  — the Hub's progress tiles; state is shown by a coloured BADGE
//                 inside the tile, not the border (see tileStatusCls).
// Size is canonical (TILE.size / TILE.pad) — every tile is identical app-wide.
export const TILE = {
  /** Chassis: shape, border, layout scaffold, hover-lift + resting 3D elevation
   *  (top inner sheen, a subtle dark ledge for depth, and a soft drop shadow —
   *  the same raised language as the action buttons). `transition-all` tweens it. */
  base: 'group rounded-2xl border-2 flex flex-col items-center text-center transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_2px_0_rgba(0,0,0,0.10),0_8px_18px_-6px_rgba(0,0,0,0.28)]',
  /** Canonical footprint — EVERY grid tile is EXACTLY this size so the whole
   *  app's tiles match across pages. Uses a FIXED height (not min-h): flex rows
   *  stretch tiles to the tallest sibling, so min-h only equalises within one
   *  page — a fixed height is what makes a sparse tile (e.g. package selection)
   *  and the richest tile (FFI: icon + title + 3 section rows + badge) identical
   *  everywhere. Height is sized to fit that richest tile; keep content within it.
   *  `<Tile>` defaults to this; callers don't pass size unless it's a deliberate,
   *  documented exception. */
  size: 'w-[264px] h-[248px]',
  /** Canonical inner padding + gap (pairs with `size`). */
  pad: 'px-5 pt-6 pb-6 gap-2.5',
  /** Enabled + clickable — lifts higher (deeper shadow) on hover, settles on press. */
  interactive: 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_0_rgba(0,0,0,0.12),0_16px_30px_-6px_rgba(0,0,0,0.40)] active:translate-y-0',
  /** Locked / disabled (both accent languages) — flat (no elevation). */
  locked: 'border-border opacity-60 cursor-not-allowed shadow-none',

  // — "select" accent (blue) —
  /** Chosen state (rides the chassis' resting elevation). */
  selected: 'border-accent-blue bg-accent-blue/10',
  /** Unchosen, hover reveals the blue edge. */
  unselected: 'border-border bg-surface hover:border-accent-blue',
} as const;

export type TileStatus = 'locked' | 'done' | 'started' | 'todo';

/**
 * Status-tile chassis, layered on `TILE.base` + `bg-surface`.
 *
 * Status tiles (the Hub / Configuration-Module progress cards) rest on the SAME
 * neutral chassis as the select-variant package/KPI tiles — a grey
 * `border-border` that reveals the blue edge on hover — so both families read as
 * one visual language. Progress (done / started / todo) is carried by the
 * coloured BADGE inside the tile, not by the border. `locked` still dims.
 */
export function tileStatusCls(status: TileStatus): string {
  return status === 'locked'
    ? 'border-border opacity-60'
    : 'border-border hover:border-accent-blue';
}

// ── CARD ──────────────────────────────────────────────────────────────────────
// A static (non-tile) panel: hero cards, forms, editor shells. `bg-surface`
// already carries the resting `--shadow-card`; add `shadow-xl` only for a
// deliberately elevated hero.
export const CARD = {
  base: 'bg-surface border border-border rounded-2xl',
} as const;

// ── TABLE / grid environment ────────────────────────────────────────────────
// The bordered "table home" from THEME.md, in recipe form. Header band +
// divided rows on the table-* tokens.
export const TABLE = {
  /** Outer wrapper (add `overflow-hidden` when there's a header band — included). */
  wrap: 'border border-border rounded-lg overflow-hidden bg-surface',
  /** Header band. */
  header: 'bg-table-header border-b border-border',
  /** A body row. */
  row: 'bg-table-body hover:bg-surface-hover transition',
  /** Between-row dividers (put on the rows' flex/tbody container). */
  divide: 'divide-y divide-border',
} as const;

// ── SEGMENT — capsule tabs & segmented toggles ────────────────────────────────
// One pill group covers both the page's capsule tabs and its inline triple
// toggles (KPI data source). `group` sits on a surface; `groupInset` is the
// bg-background variant for a toggle nested INSIDE a bg-surface row.
export const SEGMENT = {
  group: 'inline-flex items-center gap-1 p-1 bg-surface border border-border rounded-full',
  groupInset: 'inline-flex items-center gap-1 p-1 bg-background border border-border rounded-full',
  /** Page-level tab bar. Wrap the SEGMENT.group in this: it keeps the pill tabs
   *  PINNED to the top of the scroll area while content scrolls beneath (theme
   *  rule — page tabs never scroll away). Opaque bg-background covers whatever
   *  scrolls under it. Use on the tab-bar wrapper that is a child of the page's
   *  overflow-y-auto container (or a flex-shrink-0 sibling above it — sticky is
   *  then a harmless no-op, still fixed). */
  bar: 'sticky top-0 z-20 shrink-0 w-full flex justify-center bg-background pt-4 pb-3',
  /** Each button (add flex-1 / min-width at the call site). */
  item: 'px-4 py-1.5 text-center rounded-full transition disabled:cursor-not-allowed',
  active: 'bg-accent-blue text-white shadow-sm',
  inactive: 'text-text-secondary hover:text-text-primary',
} as const;

// ── FIELD — text / number inputs & selects ────────────────────────────────────
export const FIELD = {
  input: 'bg-surface border border-border rounded px-3 py-1.5 text-text-primary outline-none focus:border-accent-blue transition',
} as const;

// ── BUTTON ──────────────────────────────────────────────────────────────────
// `confirm` is the big status pill (pair with confirmVisual's bg/fg via inline
// style). `ghost` is the neutral secondary (Retry / Close / Cancel). `raised`
// is the shared 3D affordance — apply it to any solid action button.
//
// `raised`: a colour-AGNOSTIC 3D look that works over any fill (blue/green/red/…)
// — a top inner highlight (convex sheen), a dark bottom "ledge" that reads as
// depth, and a soft drop shadow. Lifts on hover, presses flush on click. The
// element's own `transition` (which Tailwind extends to transform + box-shadow)
// drives the tween, so pair `raised` with `transition`.
const RAISED_3D =
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_0_rgba(0,0,0,0.22),0_6px_12px_-3px_rgba(0,0,0,0.32)] ' +
  'hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_0_rgba(0,0,0,0.22),0_10px_18px_-3px_rgba(0,0,0,0.38)] ' +
  'active:translate-y-[2px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_0_rgba(0,0,0,0.22),0_2px_5px_rgba(0,0,0,0.30)]';

export const BUTTON = {
  confirm: `flex flex-col items-center justify-center min-h-[54px] px-6 rounded-full font-semibold transition ${RAISED_3D}`,
  ghost: 'px-4 py-1.5 border border-border rounded text-text-secondary hover:border-accent-blue hover:text-text-primary transition shadow-sm hover:-translate-y-px hover:shadow active:translate-y-0',
  /** Shared 3D affordance for any solid action button not built on `confirm`. */
  raised: RAISED_3D,
} as const;

// ── BADGE — status chips ──────────────────────────────────────────────────────
// Base shape + a spelled-out accent map (literals, for Tailwind's static scan).
// Pair with TEXT.badge for typography.
const BADGE_ACCENT = {
  blue:   'text-accent-blue border-accent-blue',
  green:  'text-accent-green border-accent-green',
  orange: 'text-accent-orange border-accent-orange',
  yellow: 'text-accent-yellow border-accent-yellow',
  red:    'text-accent-red border-accent-red',
} as const;

export type BadgeAccent = keyof typeof BADGE_ACCENT;

export const BADGE = {
  base: 'px-2 py-0.5 rounded border',
  accent: BADGE_ACCENT,
} as const;

/** Convenience: full badge class for an accent (shape + colour). */
export function badgeCls(accent: BadgeAccent): string {
  return `${BADGE.base} ${BADGE_ACCENT[accent]}`;
}

// ── TOOLTIP — the hover info box behind <InfoTip> ────────────────────────────
// A small "i" trigger that reveals a floating copy box on hover. Pure CSS
// (named group `group/tip`, so it nests safely inside other `group` surfaces
// like tiles). The panel is w-max + max-w so it sizes to its content: one
// short line stays a snug pill, long copy wraps at 280px. `normal-case
// tracking-normal` shields it from styled hosts (e.g. uppercase table
// headers). Copy comes from Tooltips.xlsx via tooltipsAtom — see
// constants/TooltipRegistry.ts.
export const TOOLTIP = {
  /** Trigger wrapper (hosts the hover group + anchors the panel). */
  wrap: 'group/tip relative inline-flex',
  /** The circled-i glyph: a solid accent-filled disc with a white "i" (the
   *  italic-serif face is applied at the InfoTip call site). Dims slightly on
   *  hover as the affordance. Fill is the theme accent, so it's blue in the blue
   *  themes and orange in ING — white reads on both. */
  icon: 'w-3 h-3 rounded-full bg-accent-blue text-white inline-flex items-center justify-center cursor-help select-none transition-opacity hover:opacity-80',
  /** Floating box: content-sized, wraps at max-w. Portal-rendered with
   *  position:fixed by <InfoTip>, so it is NEVER clipped by an ancestor's
   *  overflow (tables, scroll areas, cards). Its left/top are set inline from
   *  the icon's on-screen rect; horizontal position is clamped into the
   *  viewport. */
  panel: 'pointer-events-none fixed z-[10000] w-max max-w-[280px] rounded-lg border border-border bg-surface px-3 py-2 shadow-lg text-left normal-case tracking-normal whitespace-normal transition-opacity duration-150',
  /** Caret pointing down at the icon (panel sits ABOVE the icon). Its `left` is
   *  set inline to the icon centre so it still points at the icon after the
   *  panel is clamped. */
  caretTop: 'absolute top-full -translate-x-1/2 -mt-[5px] w-2.5 h-2.5 rotate-45 border-b border-r border-border bg-surface',
  /** Caret pointing up at the icon (panel sits BELOW the icon). */
  caretBottom: 'absolute bottom-full -translate-x-1/2 -mb-[5px] w-2.5 h-2.5 rotate-45 border-t border-l border-border bg-surface',
} as const;

// ── MODAL — overlay dialogs ───────────────────────────────────────────────────
export const MODAL = {
  overlay: 'absolute inset-0 z-50 flex items-center justify-center bg-overlay p-6',
  panel: 'bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden',
  header: 'px-5 py-3 border-b border-border',
  footer: 'px-5 py-3 border-t border-border flex items-center justify-end gap-3',
} as const;
