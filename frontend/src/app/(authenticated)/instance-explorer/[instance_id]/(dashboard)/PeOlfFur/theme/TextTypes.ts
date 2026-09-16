import { clsx } from 'clsx';
import styles from '../Style.module.css';

/**
 * ── Furnace Product App — Typography system (single source of truth) ──
 *
 * Every piece of UI text in the app belongs to exactly ONE of the 13 text
 * types below. A component never hard-codes `text-[9px] font-semibold ...`;
 * it references a token (`TEXT.tableHeader`) and automatically inherits that
 * type's font family, size, weight, colour, letter-spacing and transform.
 * Change a type here once → every consumer updates.
 *
 * RULES
 *  • All font sizes live within 10px–16px (inclusive). Nothing smaller, nothing
 *    larger. Size encodes importance; the scale is fixed at:
 *        16 → page title / numeric input
 *        14 → card title / section header
 *        12 → caption / eyebrow / table header / table cell / table row label / button
 *        11 → breadcrumb / badge
 *        10 → annotation / compact YES-NO toggle (.segBtn in Style.module.css)
 *  • Tokens carry TYPOGRAPHIC properties only (family, size, weight, colour,
 *    tracking, transform). Layout (alignment, padding, width) stays on the
 *    element. Colour is a sensible default — instances that need a different
 *    colour (e.g. feed-coloured table headers, state-coloured badges) override
 *    it via a local `cn()` (clsx + tailwind-merge) so the later class wins.
 *  • EXEMPTION: text rendered inside SVG (e.g. SvPanel, PID diagrams) is NOT governed by
 *    this system — it is sized in SVG user units that scale with the diagram,
 *    not screen pixels.
 *
 * Adding new text tomorrow? Pick the matching type below. If nothing fits, the
 * catalog — not the new string — is what needs a deliberate change.
 */
export const TEXT = {
  /** 1. Page / hero title — the single dominant heading on a page. */
  pageTitle: clsx(styles.mono, 'text-[16px] font-semibold text-text-primary tracking-wide'),

  /** 2. Card / tile title — heading of a card, tile or modal. */
  cardTitle: clsx(styles.mono, 'text-[14px] font-semibold text-text-primary tracking-wide'),

  /** 3. Section / panel header — heading of a section within a page. */
  sectionHeader: clsx(styles.mono, 'text-[14px] font-semibold text-text-primary'),

  /** 4. Eyebrow / group label — small ALL-CAPS label above/beside a group. */
  eyebrow: clsx(styles.mono, 'text-[12px] font-medium text-text-secondary uppercase tracking-wider'),

  /** 5. Table column header — heading cell of a table. Colour often overridden. */
  tableHeader: clsx(styles.mono, 'text-[12px] font-semibold text-text-primary'),

  /** 6. Table row label — the leading descriptive cell / question in a row. */
  tableRowLabel: clsx(styles.mono, 'text-[12px] text-text-secondary'),

  /** 7. Table cell content — values inside table body cells. */
  tableCell: clsx(styles.mono, 'text-[12px] text-text-primary'),

  /** 8. Caption / helper — supporting description, sub-line, footnote. */
  caption: clsx(styles.mono, 'text-[12px] text-text-secondary'),

  /** 9. Annotation — the smallest text: codes, hints, micro-labels. */
  annotation: clsx(styles.mono, 'text-[10px] text-text-secondary'),

  /** 10. Badge / status — pill or status text; colour set per state by consumer. */
  badge: clsx(styles.mono, 'text-[11px] font-semibold'),

  /** 11. Button label — text inside buttons and segmented controls. */
  button: clsx(styles.mono, 'text-[12px] font-medium tracking-wide'),

  /** 12. Breadcrumb / nav — wizard nav, top-bar and breadcrumb text. */
  breadcrumb: clsx(styles.mono, 'text-[11px] font-medium text-text-secondary'),

  /** 13. Numeric input value — large editable numeric fields. */
  numericInput: clsx(styles.mono, 'text-[16px] font-semibold text-text-primary'),
} as const;

export type TextType = keyof typeof TEXT;
