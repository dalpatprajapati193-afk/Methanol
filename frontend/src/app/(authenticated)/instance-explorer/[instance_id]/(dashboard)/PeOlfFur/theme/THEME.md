# Color & Shading Rule Book

The single rule book for **color, shading, and borders** across the app, plus the
small set of **structural/layout conventions** (see that section below) found to recur
alongside them during rollout. Scope: backgrounds, surfaces, borders, text colors,
accents, elevation (shadow), and those structural conventions. It does **not** govern
typography (see [`TYPOGRAPHY_ROLLOUT.md`](./TYPOGRAPHY_ROLLOUT.md)) or general
component content/behavior.

**Source of truth:** [`src/app/globals.css`](../../globals.css). Every value below
is defined there as a CSS custom property and exposed as a semantic Tailwind
token. Components must **only** consume the semantic tokens — never hardcode a
hex value, and never use a raw Tailwind color utility (`bg-slate-50`,
`text-gray-500`, …).

---

## The core principle (light mode)

Light mode is modeled on the **EG monitoring page** — the look we want:

> **grey PAGE  +  white CARDS  +  soft resting shadow  =  depth.**

A white page with near-white cards reads as flat and dull. Inverting it — a
cool grey page with pure-white cards that float on a soft shadow — is what makes
the UI feel crisp. The "pop" comes from this relationship, **not** from the
accent color (the Ingenero brand blue `#009FDF` is unchanged).

Concretely:
- **Page shells** use `bg-background` → the grey page.
- **Cards / panels / tiles** use `bg-surface` → white, and automatically receive
  the resting shadow `--shadow-card` (applied centrally in `globals.css`; you do
  not add a shadow utility per card).
- **Hover / nested fills** use `bg-surface-hover` (no resting shadow).

---

## Token reference

| Token (Tailwind utility)      | Light (EG recipe) | Dark (unchanged)  | Use for |
|-------------------------------|-------------------|-------------------|---------|
| `bg-background`               | `#f5f6fa`         | `#0d1117`         | the page / app shell |
| `bg-surface`                  | `#ffffff`         | `#161b22`         | cards, panels, tiles (gets `--shadow-card`) |
| `bg-surface-hover`            | `#f1f5f9`         | `#1c2330`         | hover states, nested fills, inert chips |
| `border-border`               | `#e2e8f0`         | `#30363d`         | all borders / dividers |
| `text-text-primary`           | `#1a1a2e`         | `#e6edf3`         | primary text |
| `text-text-secondary`         | `#64748b`         | `#8b949e`         | secondary / muted text |
| `text-accent-blue` / `bg-accent-blue`   | `#009FDF` | `#009FDF`     | primary accent (brand blue) |
| `text-accent-yellow`          | `#FFCD00`         | `#FFCD00`         | warnings / highlights |
| `text-accent-green`           | `#10b981`         | `#10b981`         | success / ok |
| `text-accent-orange`          | `#F9AD6F`         | `#F9AD6F`         | caution |
| `text-accent-red`             | `#ef4444`         | `#ef4444`         | errors / alarms |
| `text-accent-purple`          | `#a78bfa`         | `#a78bfa`         | categorical color-coding (e.g. "Feed B", a stream type) — not a state color |
| `text-accent-pink`            | `#f472b6`         | `#f472b6`         | categorical color-coding (e.g. a feed header) — not a state color |
| `text-accent-cyan`            | `#22d3ee`         | `#22d3ee`         | categorical color-coding (e.g. a feed header) — not a state color |
| `bg-table-header`              | `#dde3ea`         | `#1e2a3a`         | header band of a grouped row container |
| `bg-table-body`                | `#ebf0f3`         | `#182230`         | each row's fill inside that container |
| `bg-overlay`                   | `rgba(0,0,0,.4)`  | `rgba(0,0,0,.4)`  | modal / dialog scrim — theme-independent by design (`MODAL.overlay`) |
| `--shadow-card` (resting elevation) | `0 1px 4px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.04)` | `0 1px 3px rgba(0,0,0,.4)` | applied automatically to `bg-surface` |

`white-on-accent` button labels (`text-white` on `bg-accent-blue`) are
intentional and correct — they are not a theme violation. The same goes for a fixed
near-black label (`#1a1a1a`) on a light accent (e.g. `bg-accent-orange`/`bg-accent-yellow`)
where white text wouldn't have enough contrast — see `ModulesStatus.ts`'s `fg` values.
Both are legibility-driven exceptions paired with an accent *background*, not a
freestanding hardcoded color — don't extend this exception to standalone text/border
colors that aren't sitting on a matching accent fill.

---

## Theme switching

The active theme is toggled by adding/removing the `dark` class on
`document.documentElement` (see `TopBar.tsx`). Light is the default (`:root`).
Tokens re-resolve automatically; components never branch on theme.

**Persisted across refresh.** `TopBar.toggleTheme` writes the choice to
`localStorage` (key `THEME_KEY` in `constants/Theme.ts`), and `page.tsx` runs a
tiny inline script **during HTML parse — before hydration** that re-applies the
`dark` class from that key, so a refresh keeps the theme with no flash of the
default. (The restore lives in the mini-app's own `page.tsx`, not the root
`layout.tsx`, to stay within the folder boundary.)

`ING` light/dark variants also exist in `globals.css` (warm cream / orange
accent). They are **out of scope** for this rule book and were intentionally
left as-is.

---

## Table / grid environment

Any cluster of config controls presented as a list of rows — dropdowns, toggles,
inputs, drag-reorderable items — must be wrapped in a bordered container, **never**
floating directly on `bg-background` or `bg-surface` with no grouping. The container
gives the rows a visible "table" home:

- Outer wrapper: `border border-border rounded` (add `overflow-hidden` if it has a
  header band).
- Optional header band: `bg-table-header` (e.g. a section label row).
- Each row: `bg-table-body`, with `border-b border-border` between rows (omit on the
  last row).

Reference implementation: the Step-3 bank-assignment rows in `ConvEditor.tsx`
(`components/pages/hw/ConvEditor.tsx`) use `bg-table-body` rows inside a `border-border`
wrapper instead of floating on bare `bg-background`. The `TleEditor.tsx` parameter grid
(`components/pages/hw/TleEditor.tsx`) uses `bg-table-header` for its `<thead>` and
`bg-table-body` for its `<tbody>` rows.

## SVG / diagram zones

SVG/diagram regions (e.g. the Convection-bank flow diagram in `ConvBankSvg.tsx`) are
**permanently theme-locked** — they render with the same dark palette in both light and
dark mode and never branch on theme. Because these are built as static SVG strings (not
JSX consuming Tailwind classes), their palette lives as named JS constants inside the
component file rather than CSS custom properties — but those constants are mirrored 1:1
as `--svg-*` custom properties in `globals.css` purely for documentation/single-source-
of-truth. If you add a new color to an SVG zone, name the JS constant to match a
`--svg-*` entry (add the entry if it doesn't exist) instead of inlining a bare hex.

The SVG itself only paints its equipment shapes — it does **not** fill its own
background — so the element that **hosts** the SVG (the wrapping `<div>`) must set
`backgroundColor: SVG_BG` (and `border: 1px solid ${SVG_PANEL_BORDER}`) directly as an
inline style, not a theme token. Otherwise the empty canvas area shows the page's
`bg-background` underneath and the zone appears to "change color" with the theme even
though the drawn shapes don't. See `ConvBankSvg.tsx`'s default-export wrapper.

Known gap (not fixed in this pass): some status badges (e.g. "✓ Completed" in
`HubPage.tsx` / `HardwareConfigPage.tsx`) use raw inline hex instead of `text-accent-*`
tokens. Flagged for a future cleanup pass, not part of this rule book's initial rollout.

## Structural / layout conventions

Color isn't the only thing that needs to stay consistent across pages — these are the
recurring layout/content conventions discovered while rolling this rule book out tile by
tile. They live here (not in `TYPOGRAPHY_ROLLOUT.md`) because they were found alongside
color fixes and apply to the same "table environment" containers above.

- **No redundant chrome.** Don't wrap a tab's content in a bordered box with a header
  label that just restates the tab's own name (e.g. a "Transfer Line Exchangers (TLE)"
  title bar inside the already-selected "Transfer Line Exchangers" tab). If the
  surrounding tab/section already names the content, the content doesn't need its own
  title bar repeating it. See `TleEditor.tsx` — the outer bordered wrapper + header label
  were removed; the content renders directly under the tab.
- **Consolidate tightly-related controls onto one line.** A label+dropdown and a small
  set of related yes/no toggles that all belong to the same decision (e.g. "where is the
  reference pressure tag" + the four continuity toggles in `TleEditor.tsx`) belong in one
  flex row, not stacked as separate blocks — stacking single-purpose rows wastes vertical
  space and visually implies they're unrelated.
- **Table content alignment.** In a `<table>`, header cells (`<th>`) are always
  **center-aligned**, including the first/label column header. Body cells are
  **center-aligned** too, **except** the first/label column's body cells, which are
  **left-aligned** (only the header for that column stays centered). See the parameter
  grid in `TleEditor.tsx`.
- **Uniform control sizing within a column.** When a table/grid column holds the same
  *kind* of control across rows (e.g. a UOM unit dropdown that's sometimes a `<select>`
  and sometimes static text), give every instance in that column the same fixed
  width/height (wrap in a sized container, e.g. `w-20 h-7`) so the column doesn't jitter
  in width row to row. See the UOM column in `TleEditor.tsx`.
- **Every table/grid container has curved edges.** Any `<table>` (or CSS-grid
  table-environment container) gets an outer `border border-border rounded
  overflow-hidden` wrapper, matching the rounded look every other tile/card/container
  uses — a table is not exempt from the general rounded-corner convention just because
  it's tabular. Drop the last row's `border-b` so the bottom border doesn't double up
  against the wrapper's own border. See the parameter grid in `TleEditor.tsx` (the
  `<table>` sits inside its own `border border-border rounded overflow-hidden` div,
  separate from the outer `overflow-x-auto` scroll container).
- **Don't restate locked/disabled state as inline commentary.** If a control is already
  visibly locked (e.g. a disabled toggle), don't also add a small caption explaining why
  underneath it — that's redundant once the rest of the rule book makes locked controls
  visually obvious. Removed from the FPH-series toggle in `ConvEditor.tsx`.

## Component recipes (`Surfaces.ts`)

Colour and typography were centralized long before component *shape* was. The
result was that every page hand-rolled its own tile radius, border width,
hover-lift, table wrapper, tab pill, input and badge — so the "same" tile looked
different on the Hub, the Landing page and the KPI/Package selector. `Surfaces.ts`
closes that gap: it is the **structure** layer, sibling to the colour tokens
(this file) and the typography tokens (`TextTypes.ts`).

A component references a recipe instead of re-deriving the shape:

```tsx
import { TILE, TABLE, SEGMENT, FIELD, BUTTON, BADGE, MODAL, CARD, Tile } from '../../theme/Index';
```

| Recipe | Covers | Reference |
|---|---|---|
| `TILE` + `<Tile>` + `tileStatusCls` | every clickable grid tile on one neutral chassis (`rounded-2xl border-2`, grey border → blue hover edge, raised 3D elevation that deepens on `hover:-translate-y-0.5`, flat when locked) — *select* tiles add a persistent blue fill when chosen; *status* tiles show progress via a coloured badge, not the border | package cards |
| `CARD` | static panels / hero cards / editor shells (`rounded-2xl`) | Home / UOM card |
| `TABLE` | the bordered "table home" — `wrap` / `header` / `row` / `divide` on the `table-*` tokens | KPI table |
| `SEGMENT` | capsule tabs **and** inline segmented toggles (`rounded-full` pill group). `group` = the pill capsule; **`bar`** = the sticky wrapper for a **page-level tab bar** — pill tabs are always PINNED to the top of the scroll area and never scroll away (wrap the `group` in `SEGMENT.bar`, don't hand-roll `flex justify-center`) | Selection tabs / KPI source toggle |
| `FIELD` | text / number inputs & selects | KPI search input |
| `BUTTON` | `confirm` (big status pill, pair with `confirmVisual`), `ghost` (neutral secondary), and **`raised`** — the shared colour-agnostic **3D affordance** (top inner sheen + dark bottom ledge + soft drop shadow; lifts on hover, presses on `active`). `raised` is baked into `confirm`; add it to any other solid action button (wizard Prev/Next, Add/Del). Buttons are never flat | Confirm / Revert bar; wizard Prev/Next |
| `BADGE` + `badgeCls` | status chips (shape + spelled-out accent map) | Hub status badges |
| `MODAL` | overlay dialogs — `overlay` / `panel` / `header` / `footer` | progress modal |
| `TOOLTIP` + `<InfoTip>` / `<InfoLabel>` | the hover info box: solid accent-filled i-disc + content-sized floating panel (`w-max max-w-[280px]`, caret). The panel is **portal-rendered with `position:fixed`**, so it is NEVER clipped by an ancestor's `overflow` (tables, scroll areas, cards) and is clamped into the viewport. Copy is NOT hardcoded — the `id` is looked up in the user-editable `Tooltips.xlsx`; `<InfoLabel>` additionally renders the field's on-screen label from the Title cell. See the "Tooltips" subsection below + `constants/TooltipRegistry.ts` | Fleet Record column headers |

**Structure only.** Recipes carry radius, border, elevation, hover and the
colour tokens intrinsic to the shape. **Size and position stay on the element**
(a tile's `w-[220px]`, a column width, a button's `min-w-*`) — same split as
`TextTypes.ts`. Compose with the local `cn()` so a one-off override still wins.
When you need a new recurring surface, add a recipe here — don't inline a new
variant of an existing one.

### Tooltips (`TOOLTIP` recipe + `<InfoTip>` / `<InfoLabel>`)

The hover-help affordance is a small solid accent-filled disc with a white
italic serif **i** that reveals a content-sized floating copy box on hover
(pure CSS via the named group `group/tip`, so it nests safely inside a tile's
`group`). The disc uses `bg-accent-blue`, so it's blue in the blue themes and
orange in ING — white reads on both. The box sizes to its content (`w-max
max-w-[280px]`), fades/slides in, and carries a caret; `side="bottom"` drops it
below the icon for triggers against an overflow-clipping top edge (e.g. a table
header). Place the icon as a superscript with `align-super` at the call site.

**Copy is data, not code.** `<InfoTip id="…">` / `<InfoLabel id="…">` never take
the text as a prop — they look it up by `id` in `tooltipsAtom`, which
`FurnaceApp.tsx` fills on app open from the **user-editable Excel**
`src/app/furnaceProductApp/Tooltips.xlsx`. Columns:
`Tooltip_ID | Location | Title | Tooltip_Text | Status`.

- **`Tooltip_ID`** — the code link (matches the component's `id`). Never edit it.
- **`Location`** — human note of where it appears (code ignores it).
- **`Title`** — the field's name. It is the tooltip's bold heading **and**, where
  the field is rendered with `<InfoLabel>`, the on-screen label itself — edit
  Title to rename the control.
- **`Tooltip_Text`** — the body copy.
- **`Status`** — `Active` (case-insensitive) shows the icon; `Inactive` removes
  it. A blank `Tooltip_Text` also hides it. The rename via `Title` still applies
  while the icon is hidden (icon-visibility and rename are independent).

**Editing** wording/label/visibility = edit the Excel, refresh. **Adding** a
tooltip is a code change: drop `<InfoTip>`/`<InfoLabel>` next to the element and
register the id + defaults in `constants/TooltipRegistry.ts`. On next app open
`readTooltips` (`actions/tooltipActions.ts`) self-heals the Excel — appends any
missing registered id and back-fills new columns — **without touching existing
rows** (user edits always win).

### Save-state indicator (`constants/SaveState.ts` + `.fieldTextFade`)

A per-entry marker that shows, on an editable control's **text only**, whether its
value is confirmed / saved-to-draft / unsaved. It is the app-wide way to signal
draft state (see the draft/Save system in `CLAUDE.md` and `Learnings.md`).

- **Value-driven, per entry.** Each control compares its live value to the
  confirmed + draft snapshots: `== confirmed` → **normal text**; `== draft`
  (≠ confirmed) → **steady `text-accent-yellow`**; ≠ both → **yellow text that
  fades** out and reappears.
- **Text only — never the box.** The fade is `.fieldTextFade` in `Style.module.css`,
  which sets **`color`** (never `opacity`). So a select/input's border and a YES/NO
  button's green/red fill stay solid; only the glyphs fade. On a segmented toggle the
  class goes on a `<span>` wrapping the active label (`SegYesNo activeCls`, the FMS
  `SegBtn`), never the button.
- **One shared clock (fields stay in sync).** The fade is NOT a per-element CSS
  animation — those restart at each field's own edit time, so fields edited moments
  apart drift out of phase. Instead `useFieldFadeClock()` (`SaveState.ts`, mounted once
  in `FurnaceApp`) runs a single `requestAnimationFrame` loop writing the shared
  `--fieldFadeColor` custom property (a theme-adaptive `color-mix` of accent-yellow at
  a varying alpha), and every `.fieldTextFade` just reads it — so all unsaved fields
  fade as one. The cycle is deliberately **asymmetric: slow fade-out (`FADE_OUT_FRAC`
  = 0.8 of the `FADE_PERIOD_MS` = 2 s cycle) then a fast reappear.** Honours
  `prefers-reduced-motion` (holds steady yellow).
- **Call site is one line.** `const save = useFmsSave()` (or `useFuelSave()`, or
  `usePkgSave()` on the KPI/Package page), then `className={cn(base, save(cur, s => …))}`.
  Put `save(...)` **last** in `cn` so `twMerge` keeps the yellow over any base
  text-colour. On a control whose own text colour is set by a bundled token (e.g. the
  KPI toggle's `SEGMENT.active` = `text-white`, or a blue tile label), put the marker on
  an **inner `<span>`** wrapping the label so the span's colour beats the inherited one
  (same trick as `SegYesNo`). Already-yellow controls (bank-alias input) still work.
- **Snapshots** live in `confirmed/draftFmsAtom` + `confirmed/draftFuelAtom` (and
  `confirmed/draftPkgSelectionAtom` for the KPI/Package page), set at four sync points
  (auto-fill, Save, Confirm, Revert). The indicator is inert until a snapshot exists, so
  a brand-new setup shows nothing; a **new hardware template** inside an existing setup
  reads as all-unsaved via the `snapshotsActive` gate.
- **Rolled out to the KPI/Package page too.** `PkgSelectionPage` now mirrors the Hub's
  draft model: a per-page SAVE button (writes only the draft — `Package_KPI_Selection
  .draft.json` + the draft workbook sheet), auto-fill from draft on open, Confirm writes
  both, Revert rewrites draft = confirmed, and `usePkgSave()` marks the KPI data-source
  toggle + each package tile's "Selected" label. See `Learnings.md` "Draft / Save system".
- **Don't** reach for a ring/badge/box highlight or an `opacity` pulse — the user
  rejected both. Text colour + text-only fade is the whole vocabulary.

## Rules

1. **Only semantic tokens.** No hex literals, no raw Tailwind colors in
   components. If you need a color that isn't a token, add a token to
   `globals.css` (and this table) — don't inline it.
2. **Page = `bg-background`, card = `bg-surface`.** Keep the grey-page /
   white-card relationship intact; it is the whole effect.
3. **Don't add resting shadows by hand.** `bg-surface` already carries
   `--shadow-card`. Hover lift (`hover:shadow-xl`, etc.) is fine on top.
4. **Borders** always use `border-border`.
5. **Rows of controls live in a table environment** (`bg-table-header` /
   `bg-table-body`) — see above. Don't let config rows float orphaned.
6. **SVG zones stay theme-locked** — see above. Don't wire them to theme tokens, and
   always give the SVG's host element its own `SVG_BG` background.
7. **The theme toggle uses the View Transitions API — and nothing else animates it.**
   The toggle in `TopBar.tsx` wraps the `dark`-class change in
   `document.startViewTransition(...)` (with a `flushSync` so the new themed state is
   committed in one pass), and `globals.css` sets the `::view-transition-old/new(root)`
   crossfade duration, gated on `prefers-reduced-motion`. This crossfades a snapshot of
   the **whole viewport** — SVG zones, native `<select>` widgets, the `color-scheme` flip,
   box-shadows, everything — as one uniform fade. **Do NOT add a global per-element color
   transition (a `*` rule) alongside it.** We tried that (first a class allowlist, then a
   universal `*` transition); besides not covering native controls/shadows, the `*` rule
   actively *fights* VT — VT snapshots the new state right after the class flip, catching
   every element mid-CSS-transition, so the crossfade lands on a half-themed frame while
   the real DOM keeps animating underneath. On this heavy DOM (large animated SVG) that
   double animation is what made the toggle lag/stutter. The only non-VT fallback is the
   small `body` background/color transition in the base styles — keep it minimal.
8. **Apply the structural/layout conventions above** wherever they recur — they're part
   of this rule book even though they aren't color rules.
9. **State accents vs. categorical accents — both are tokens, don't conflate them.**
   `accent-blue/yellow/green/orange/red` mean something (brand/warn/success/caution/
   error) — never repurpose one of those for "just a different color" unrelated to that
   meaning. `accent-purple/pink/cyan` exist specifically for categorical color-coding
   (e.g. "Feed A vs Feed B", or a feed-header palette in `FeedManagementPage.tsx`/
   `FeedFurnaceInteractionPage.tsx`) where the color carries no success/warning meaning —
   use those, not a state accent, when adding a new "which one" color distinction. A
   tinted box/badge (e.g. an active-state button) should use the existing accent at
   reduced opacity (`bg-accent-green/15 border-accent-green`) rather than hand-picking a
   second hex to pair with the token — that was the single most common violation found
   when rolling this rule book out (the same `bg-[#12472a] border-[#2ea55e]` pair
   hardcoded next to `text-accent-green` in ~8 different files).
10. **Check shared className constants, not just inline className strings.** Several
   files (notably `RadEditor.tsx`'s `rzThLblCls`/`rzThColCls`/`rzTdLblCls`/`rzTdCellCls`)
   define one shared class string reused across dozens of `<th>`/`<td>` call sites. The
   first rollout pass grepped for hardcoded hex and fixed every individual call site, but
   missed that these *shared constants themselves* never had `bg-table-header`/
   `bg-table-body` baked in — so every table built from them rendered with zero
   header/body distinction even though no literal violation showed up in a hex grep. When
   auditing a file, find these `const xCls = cn(...)` / `const xCls = '...'` definitions
   first and check them directly — don't assume "no hardcoded hex nearby" means
   "compliant." Same applies to the `FeedManagementPage.tsx` "Feed Components" table,
   which was a structural duplicate of the already-fixed `FuelComponentsSection.tsx` table
   that got missed simply because it lives in a different file the audit didn't re-check
   for the same pattern — when one table in a pair/duplicate is fixed, immediately check
   its sibling(s) in the same pass, don't treat them as separate findings.
11. Changes to values happen in `globals.css` only, then are recorded here.
12. **Use the component recipes for shape.** Tiles, tables, tabs/toggles, inputs,
   buttons, badges and modals reference `Surfaces.ts` (`TILE`/`TABLE`/`SEGMENT`/
   `FIELD`/`BUTTON`/`BADGE`/`MODAL`/`CARD`/`TOOLTIP` or the `<Tile>`/`<InfoTip>` components) — don't
   re-derive `rounded-*`/`border-2`/`hover:-translate-*` inline. New recurring
   surface → new recipe, not a new inline variant. See "Component recipes" above.
