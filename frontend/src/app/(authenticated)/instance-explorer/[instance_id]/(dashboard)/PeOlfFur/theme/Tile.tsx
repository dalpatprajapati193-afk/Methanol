'use client';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TILE, tileStatusCls, type TileStatus } from './Surfaces';
import { TEXT } from './TextTypes';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

/**
 * The one clickable-tile component for the whole app. Every tile rides the
 * shared `TILE` chassis and rests on the SAME neutral surface (grey border →
 * blue hover edge), so the two families read as one visual language:
 *   • select-variant  — pass `selected` for a persistent blue fill (package
 *                        cards, landing, hardware define/apply)
 *   • status-variant  — pass `status`; progress (done/started/todo) is shown by
 *                        the coloured BADGE in `children`, not the border. Hub
 *                        modules.
 *
 * Global tile behaviours (no opt-in — they come from the theme):
 *   • the icon lights blue on hover (and stays blue when `selected`);
 *   • a small corner padlock shows the lock state (open = unlocked, closed =
 *     locked); when `locked`, the border and icon do NOT light up.
 *
 * Size and padding are layout → passed by the caller. Rich inner content
 * (progress sections, badges) goes in `children`, rendered under the title.
 */
export interface TileProps {
  /** Footprint override. LEAVE UNSET — tiles default to the canonical `TILE.size` so every tile matches. Override only for a documented one-off. */
  size?: string;
  /** Inner padding + gap override. Defaults to the canonical `TILE.pad`. */
  padding?: string;
  /** Vertically center the content (package cards) vs top-align (landing / hub). */
  center?: boolean;
  /** select-variant chosen state. Ignored when `status` is set. */
  selected?: boolean;
  /** Marks a status/progress tile. Shares the neutral chassis; show state via a badge in `children`. Takes precedence over `selected`. */
  status?: TileStatus;
  locked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  title?: React.ReactNode;
  /** Override the title typography/colour (defaults to TEXT.cardTitle). */
  titleClassName?: string;
  /** Native hover tooltip (the HTML `title` attribute). */
  tooltip?: string;
  className?: string;
  children?: React.ReactNode;
}

/** Corner padlock: closed when the tile is locked, open otherwise. Neutral only
 *  (no red / yellow) — the shape carries the meaning. */
function LockGlyph({ locked }: { locked: boolean }) {
  return (
    <span className={cn('absolute top-2.5 right-2.5', locked ? 'text-text-primary' : 'text-text-secondary')}>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        {locked
          ? <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          : <path d="M8 11V7a4 4 0 0 1 7.5-1.5" />}
      </svg>
    </span>
  );
}

export function Tile({
  size = TILE.size,
  padding = TILE.pad,
  center,
  selected,
  status,
  locked,
  disabled,
  onClick,
  icon,
  title,
  titleClassName,
  tooltip,
  className,
  children,
}: TileProps) {
  const isStatus = status !== undefined;
  const inert = locked || disabled;

  // Every tile rests on the neutral chassis. Status tiles layer it via
  // tileStatusCls (which only dims when locked — their state shows as a badge);
  // select tiles add the persistent blue fill when `selected`.
  const accent = isStatus
    ? cn('bg-surface', tileStatusCls(inert ? 'locked' : status!))
    : inert
      ? 'border-border bg-surface'
      : selected
        ? TILE.selected
        : TILE.unselected;

  // The icon (which must use `currentColor`) lights blue on hover, or stays blue
  // when selected. A locked/disabled tile is static — no blue lift on the icon.
  const iconCls = inert
    ? 'text-text-secondary'
    : selected
      ? 'text-accent-blue'
      : 'text-text-secondary group-hover:text-accent-blue';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={inert}
      title={tooltip}
      className={cn(
        TILE.base,
        'relative overflow-hidden',
        center ? 'justify-center' : '',
        size,
        padding,
        inert ? TILE.locked : TILE.interactive,
        accent,
        className,
      )}
    >
      <LockGlyph locked={!!inert} />
      {icon && (
        <span className={cn('transition-colors', iconCls)}>{icon}</span>
      )}
      {title && (
        <div className={cn(titleClassName ?? cn(TEXT.cardTitle, 'tracking-wide'))}>{title}</div>
      )}
      {children}
    </button>
  );
}
