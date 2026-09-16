'use client';
import { clsx } from 'clsx';
import styles from '../../../Style.module.css';
import { BUTTON } from '../../../theme/Surfaces';

export interface TplItem { id: string; name: string; saved: boolean; }

interface Props {
  templates: TplItem[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  onRename: (idx: number, name: string) => void;
  sameForAll: boolean;
  furnaceCount: number;
  applyMap: Record<number, string>;
  isConv: boolean;
  /** When provided, renders the "All furnaces same?" YES/NO toggle above the repository. */
  onSameForAll?: (val: 0 | 1) => void;
  /** Save-state marker class for the active side of the "All furnaces same?" toggle. */
  sameForAllCls?: string;
  /** Save-state marker class per template-name input (new/renamed template = edit). */
  nameCls?: (i: number) => string;
  single?: boolean;
  /** Seamless side-tab look: the selected row turns black (bg-background) and drops its
      right divider so it merges into the workspace; the divider stays on every other row. */
  seamlessSelect?: boolean;
}

export default function HwTemplateList({ templates, selectedIdx, onSelect, onAdd, onRemove, onRename, sameForAll, furnaceCount, applyMap, isConv, onSameForAll, sameForAllCls, nameCls, single, seamlessSelect }: Props) {
  const assignedCount    = Object.keys(applyMap).length;
  const unassignedCount  = furnaceCount - assignedCount;
  const atMaxCap         = templates.length >= furnaceCount;
  const allAssigned      = isConv && unassignedCount < 1 && !atMaxCap; // already at cap takes priority msg

  const addDisabled = sameForAll || atMaxCap || allAssigned;
  const addTitle    = sameForAll      ? 'Disabled in same-for-all mode'
                    : atMaxCap        ? 'Max templates = number of furnaces'
                    : allAssigned     ? 'All furnaces already assigned — free a furnace first'
                    : undefined;

  const delDisabled = sameForAll || templates.length <= 1;

  return (
    <div className={clsx('w-48 flex-shrink-0 bg-surface flex flex-col overflow-hidden',
      // Seamless mode relocates the divider onto the header / unselected rows / filler so
      // it can be broken at the selected row; otherwise the whole sidebar carries it.
      !seamlessSelect && 'border-r border-border')}>
      {/* Header */}
      <div className={clsx('flex-shrink-0 flex flex-col gap-2 px-3 py-2 border-b border-border', seamlessSelect && 'border-r')}>
        {onSameForAll && (
          <div className="flex flex-col gap-1 pb-2 mb-1 border-b border-border">
            <span className={clsx(styles.mono, 'text-[9px] text-text-secondary')}>All furnaces same?</span>
            <div className="flex items-center gap-1.5">
              <div className={styles.seg}>
                <button className={clsx(styles.segBtn, sameForAll ? styles.segBtnYes : styles.segBtnNeutral)} onClick={() => onSameForAll(1)} disabled={single}><span className={clsx(sameForAll && sameForAllCls)}>YES</span></button>
                <button className={clsx(styles.segBtn, !sameForAll ? styles.segBtnNo : styles.segBtnNeutral)} onClick={() => onSameForAll(0)} disabled={single}><span className={clsx(!sameForAll && sameForAllCls)}>NO</span></button>
              </div>
              {single && <span className={clsx(styles.mono, 'text-[8px] text-text-secondary')}>(auto)</span>}
            </div>
          </div>
        )}
        <span className={clsx(styles.mono, 'text-[10px] text-text-secondary whitespace-nowrap text-center')}>Template Repository</span>
        <div className="flex gap-1.5">
          <button
            onClick={onAdd}
            disabled={addDisabled}
            title={addTitle}
            className={clsx(styles.mono, 'flex-1 flex items-center justify-center h-7 text-[9px] font-semibold bg-accent-green text-white rounded hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed', BUTTON.raised)}
          >+ Add</button>
          <button
            onClick={onRemove}
            disabled={delDisabled}
            title={delDisabled ? (sameForAll ? 'Disabled in same-for-all mode' : 'Must keep at least one template') : undefined}
            className={clsx(styles.mono, 'flex-1 flex items-center justify-center h-7 text-[9px] font-semibold bg-accent-red text-white rounded hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed', BUTTON.raised)}
          >− Del</button>
        </div>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto">
        <div className={clsx(seamlessSelect && 'min-h-full flex flex-col')}>
        {templates.map((t, i) => (
          <div
            key={t.id}
            onClick={() => onSelect(i)}
            className={clsx(
              'px-3 py-2 border-b border-border cursor-pointer transition',
              seamlessSelect
                // Selected row → black + no right border (merges into the workspace);
                // unselected rows keep the grey right divider.
                ? (i === selectedIdx
                    ? 'bg-background border-l-2 border-l-accent-blue'
                    : 'bg-surface border-r hover:bg-surface-hover')
                : (i === selectedIdx
                    ? 'bg-surface-hover border-l-2 border-l-accent-blue'
                    : 'hover:bg-surface-hover')
            )}
          >
            <input
              className={clsx(styles.mono, 'text-[10px] bg-transparent outline-none w-full cursor-pointer border-b border-transparent focus:border-accent-blue',
                i === selectedIdx ? 'text-accent-blue' : 'text-text-primary',
                nameCls?.(i)
              )}
              value={t.name}
              onChange={e => onRename(i, e.target.value)}
              onClick={ev => ev.stopPropagation()}
              onFocus={() => onSelect(i)}
            />
          </div>
        ))}
        {templates.length === 0 && (
          <div className={clsx(styles.mono, 'px-3 py-4 text-[9px] text-text-secondary text-center', seamlessSelect && 'border-r border-border')}>
            No templates yet.<br/>Click + Add to create one.
          </div>
        )}
        {/* Filler keeps the relocated divider running past the last row in seamless mode. */}
        {seamlessSelect && <div className="flex-1 border-r border-border" />}
        </div>
      </div>
    </div>
  );
}
