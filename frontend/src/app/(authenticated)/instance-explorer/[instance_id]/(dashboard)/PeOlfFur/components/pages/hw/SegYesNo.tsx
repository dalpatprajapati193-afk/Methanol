'use client';
import { clsx } from 'clsx';
import styles from '../../../Style.module.css';

interface Props {
  value: 0 | 1 | null;
  onYes?: () => void;
  onNo?: () => void;
  /** Auto-filled & fixed: the selected side renders in the BLUE auto-locked style
   *  (segBtnAuto*) instead of green/red, and the control is not editable.
   *  This is the app-wide convention for any value the user cannot change. */
  locked?: boolean;
  /** Greyed-out (e.g. an inactive section). Non-editable but keeps green/red. */
  disabled?: boolean;
  /** Save-state marker classes applied to the ACTIVE side (the shown value) — the
   *  per-entry indicator (yellow ring / fade). Empty string = no marker. */
  activeCls?: string;
}

/** Shared YES/NO segmented toggle. Auto-filled (locked) values are always BLUE. */
export default function SegYesNo({ value, onYes, onNo, locked = false, disabled = false, activeCls }: Props) {
  // Locked = auto-filled, no choice. Render a single full-width blue button
  // showing only the fixed value, centered — signals the user cannot change it.
  if (locked) {
    return (
      <div className={clsx(styles.seg, styles.segLocked)}>
        <button className={clsx(styles.segBtn, styles.segBtnLocked)} disabled aria-hidden>YES</button>
        <button className={clsx(styles.segBtn, styles.segBtnLocked)} disabled aria-hidden>NO</button>
        <span className={clsx(styles.segLockedLabel, activeCls)}>{value === 1 ? 'YES' : 'NO'}</span>
      </div>
    );
  }

  const yesCls = value === 1 ? styles.segBtnYes : styles.segBtnNeutral;
  const noCls  = value === 0 ? styles.segBtnNo  : styles.segBtnNeutral;
  // activeCls lands on the label span (not the button), so only the YES/NO text
  // fades — the green/red button fill stays put.
  return (
    <div className={styles.seg}>
      <button className={clsx(styles.segBtn, yesCls)} onClick={() => !disabled && onYes?.()} disabled={disabled}><span className={clsx(value === 1 && activeCls)}>YES</span></button>
      <button className={clsx(styles.segBtn, noCls)}  onClick={() => !disabled && onNo?.()}  disabled={disabled}><span className={clsx(value === 0 && activeCls)}>NO</span></button>
    </div>
  );
}
