# Typography Rollout — Convention (single source of truth for the rollout)

Goal: every user-facing string in `furnaceProductApp` routes through a `TEXT.*`
token from [`theme/TextTypes.ts`](./TextTypes.ts). No component hard-codes
`text-[Npx]`, `font-*`, `tracking-*`, `uppercase`, or a text colour as part of
the *type*. Layout (padding, width, flex, alignment) stays on the element.

This file is the **locked convention** for the multi-file rollout. Convert one
file per pass against this table; do not invent new rules mid-rollout. If a
string genuinely fits nothing here, that is a signal to change the catalog
deliberately — raise it, don't improvise.

---

## The mechanism (copy this into every file you convert)

At the top of the file:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TEXT } from '../../theme/TextTypes';   // adjust depth: pages/ = ../../, pages/hw/ = ../../../

const cn = (...a: ClassValue[]) => twMerge(clsx(a));
```

(If the file already imports `clsx`/`styles`, keep those; just add `twMerge`,
`ClassValue`, `TEXT`, and the local `cn`.)

Then each text element becomes:

```tsx
className={cn(TEXT.someToken, 'layout + colour-override classes')}
```

`cn` (tailwind-merge) guarantees the later class wins, so a colour override
placed *after* the token replaces the token's default colour. Example — a
feed-coloured table header:

```tsx
className={cn(TEXT.tableHeader, 'text-accent-blue px-3 py-2 border-b border-border')}
```

**Drop** `styles.mono` from the element — every TEXT token already includes it.
Keep `styles.numInput`, `styles.fiSel`, `styles.segBtn`, etc. (those are layout/
behaviour, not typography).

---

## Size scale (fixed) — what each token renders at

| px | tokens |
|----|--------|
| 16 | `pageTitle`, `numericInput` |
| 14 | `cardTitle`, `sectionHeader` |
| 12 | `eyebrow`, `tableHeader`, `tableRowLabel`, `tableCell`, `caption`, `button` |
| 11 | `badge`, `breadcrumb` |
| 10 | `annotation` |

Nothing below 10 or above 16 may remain.

---

## Token selection by role

| If the string is… | Use |
|---|---|
| the one dominant heading of a page (hero) | `pageTitle` |
| a card / tile / modal-dialog title | `cardTitle` |
| a section/panel header inside a page (e.g. topbar "… Configuration") | `sectionHeader` |
| a small ALL-CAPS group/eyebrow label (e.g. `INGENERO360AI`, `Configuration Modules`, "Same for all furnaces") | `eyebrow` |
| a table column header (`<th>`) | `tableHeader` |
| the leading descriptive cell / question in a table row | `tableRowLabel` |
| a value inside a table body cell, incl. `<input>`/`<select>` text in cells | `tableCell` |
| supporting description / sub-line / helper / footnote (e.g. "Define component…") | `caption` |
| the smallest micro-text: codes, hints, row indices (F1), counts ("3 of 5 selected") | `annotation` |
| a status/state pill or badge ("✓ Completed", "Started", "🔒 Locked", "max 12") | `badge` |
| a button / segmented-control label | `button` |
| breadcrumb / wizard-nav / top-bar nav text | `breadcrumb` |
| a large editable numeric field | `numericInput` |

---

## Sub-10px → scale (DECISION: bump up, do not keep <10px)

| Was | Becomes | Rationale |
|---|---|---|
| `text-[7px]` / `text-[8px]` micro-labels, row indices | `annotation` (10) | smallest tier |
| `text-[7px]`/`text-[9px]` status pills ("Locked", "Completed", "Started") | `badge` (11) | they're status pills |
| `text-[9px]` helper / sub-line / count text | `annotation` (10) or `caption` (12) — `annotation` for terse micro-counts, `caption` for sentences | |
| `text-[9px]` button/segmented label | `button` (12) | |
| `text-[9px]` topbar/breadcrumb/nav | `breadcrumb` (11) | |

## Above-scale → scale

| Was | Becomes |
|---|---|
| `text-xl` (20) page hero title | `pageTitle` (16) |
| `text-lg` (18) | `pageTitle` or `cardTitle` by role |

## Tailwind preset sizes already in range

| Was | Treat as | Pick token by role |
|---|---|---|
| `text-xs` (12) | 12 tier | usually `caption`, `tableCell`, `tableRowLabel`, or `button` |
| `text-sm` (14) | 14 tier | `sectionHeader` or `cardTitle` |
| `text-base` (16) | 16 tier | `pageTitle` / `numericInput` |

---

## Flagged judgement calls surfaced by the exemplars (review these)

1. **Module tile label** (`HubPage`, was `text-[11px] font-medium`): the scale has
   no 11px title token, so it maps to **`cardTitle` (14px)** — a deliberate visual
   bump. If 14px crowds the 210px tile, the fix is a catalog change, not a one-off.
2. **Tile status pills / "Locked" / section status rows** (were `text-[7px]`–`[9px]`):
   mapped to **`badge` (11px)**, colour kept via override (`style=` or
   `text-accent-*`). These grow noticeably on dense tiles — expected under
   "bump to scale".
3. **Confirm button subtext** (`text-[9px]`): → **`annotation` (10px)**.
4. **`INGENERO360AI` eyebrow**: `eyebrow` token + override `text-accent-blue
   tracking-[.22em]` (keeps the wider tracking; token's own tracking is replaced).

---

## Exempt — do NOT touch

- Text rendered **inside `<svg>`** (`SvPanel`, `FlowMap`, inline `<text>`): sized in
  SVG user units. Leave as-is.
- `.segBtn` sizing already lives in `Style.module.css` (10px) — that's the system.
- **Icon glyphs** that rely on a CSS-module font (e.g. the drag handle `⠿` with
  `styles.dragHandle` in `ConvEditor`): leave their `text-[Npx]` as-is. A TEXT
  token would inject `styles.mono` and fight the glyph's own font-family. Treat
  them like SVG. (These are the only `text-[Npx]` allowed to remain.)
- Non-text utilities (icon `width`/`height`, `w-`, `h-`, `gap-`, `px-`, `py-`).

---

## Per-file checklist

- [ ] Added `twMerge` + `ClassValue` + `TEXT` imports + local `cn`.
- [ ] Every `text-[Npx]` / `text-xs|sm|base|lg|xl` on a text element replaced by a token.
- [ ] `styles.mono` removed wherever a token now supplies it.
- [ ] Colours that differ from the token default re-applied AFTER the token.
- [ ] SVG `<text>` left untouched.
- [ ] No remaining sub-10 / above-16 sizes (`grep text-\[` shows only SVG/layout).
</content>
</invoke>
