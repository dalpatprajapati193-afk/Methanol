'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAtomValue } from 'jotai';
import { tooltipsAtom } from '../store/TooltipAtoms';
import { TOOLTIP } from './Surfaces';
import { TEXT } from './TextTypes';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

const TIP_GAP = 10;  // px between the icon and the panel
const TIP_EDGE = 8;  // min gap the panel keeps from the viewport edges

/**
 * The one hover-tooltip component for the whole app: a small circled "i" that
 * reveals a floating copy box on hover (TOOLTIP recipe in Surfaces.ts).
 *
 * Copy is NOT passed as a prop — it is looked up by `id` in tooltipsAtom,
 * which FurnaceApp.tsx fills on app open from the user-editable Tooltips.xlsx
 * (see constants/TooltipRegistry.ts for the add-a-tooltip workflow). An id
 * with no row, a blanked Tooltip_Text, or Status = Inactive renders nothing at
 * all — no icon (the read step drops those, so no entry reaches this map).
 */
export interface InfoTipProps {
  /** Key into Tooltips.xlsx (Tooltip_ID column) — register it in TooltipRegistry.ts. */
  id: string;
  /** Box placement relative to the icon. Use 'bottom' when the icon sits against an overflow-clipping top edge (e.g. a table header). */
  side?: 'top' | 'bottom';
  /** Extra classes for the wrapper (layout only — margins, alignment). */
  className?: string;
}

export function InfoTip({ id, side = 'top', className }: InfoTipProps) {
  const tooltips = useAtomValue(tooltipsAtom);
  const entry = tooltips[id];

  const iconRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Final on-screen geometry, computed after the panel has real dimensions.
  const [box, setBox] = useState<{ left: number; top: number; placement: 'top' | 'bottom'; caret: number } | null>(null);

  // Position the fixed panel against the icon's viewport rect: pick the side
  // (flipping if there isn't room), then clamp horizontally so it never runs
  // off-screen. The caret keeps pointing at the icon centre even after clamping.
  const place = useCallback(() => {
    const icon = iconRef.current, panel = panelRef.current;
    if (!icon || !panel) return;
    const r = icon.getBoundingClientRect();
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    const iconCx = r.left + r.width / 2;

    let placement = side;
    if (side === 'top' && r.top - TIP_GAP - ph < TIP_EDGE) placement = 'bottom';
    else if (side === 'bottom' && r.bottom + TIP_GAP + ph > window.innerHeight - TIP_EDGE) placement = 'top';

    const left = Math.max(TIP_EDGE, Math.min(iconCx - pw / 2, window.innerWidth - TIP_EDGE - pw));
    const top = placement === 'top' ? r.top - TIP_GAP - ph : r.bottom + TIP_GAP;
    setBox({ left, top, placement, caret: iconCx - left });
  }, [side]);

  useEffect(() => {
    if (!open) { setBox(null); return; }
    place();
    // Keep the panel anchored while the page scrolls or resizes under it.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  if (!entry?.active) return null;

  return (
    <span
      ref={iconRef}
      className={cn(TOOLTIP.wrap, className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        aria-label="More information"
        className={cn(TOOLTIP.icon, 'italic font-bold text-[8px] leading-none')}
        style={{ fontFamily: 'Georgia, "Times New Roman", serif', textTransform: 'lowercase' }}
      >i</span>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          role="tooltip"
          className={TOOLTIP.panel}
          style={{
            left: box ? box.left : -9999,
            top: box ? box.top : -9999,
            opacity: box ? 1 : 0,
          }}
        >
          {entry.title && (
            <span className={cn(TEXT.caption, 'block font-semibold text-text-primary mb-0.5')}>{entry.title}</span>
          )}
          <span className={cn(TEXT.caption, 'block leading-relaxed')}>{entry.text}</span>
          {box && (
            <span
              className={box.placement === 'top' ? TOOLTIP.caretTop : TOOLTIP.caretBottom}
              style={{ left: box.caret }}
            />
          )}
        </div>,
        document.body,
      )}
    </span>
  );
}

/**
 * A UI label whose text is driven by the tooltip's Title cell, with the
 * <InfoTip> icon appended. Editing the Title in Tooltips.xlsx renames the
 * control on screen (and updates the tooltip heading) — one source of truth.
 * `fallback` is the code default shown until the Excel loads, or when the row
 * has no Title. The label follows Title even while the icon is hidden
 * (Status=Inactive / blank text), so renaming and icon-visibility are
 * independent.
 */
export interface InfoLabelProps extends InfoTipProps {
  /** Label text used until/unless the Title cell supplies one. */
  fallback: string;
}

export function InfoLabel({ id, fallback, side = 'top', className }: InfoLabelProps) {
  const tooltips = useAtomValue(tooltipsAtom);
  const label = tooltips[id]?.title?.trim() || fallback;
  return (
    <>
      {label}
      <InfoTip id={id} side={side} className={className} />
    </>
  );
}
