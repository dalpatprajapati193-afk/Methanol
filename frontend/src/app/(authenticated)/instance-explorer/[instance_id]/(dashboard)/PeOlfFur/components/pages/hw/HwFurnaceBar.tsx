'use client';
import { clsx } from 'clsx';
import styles from '../../../Style.module.css';

interface Props {
  furnaceCount: number;
  furnaceNames: string[];
  applyMap: Record<number, string>;
  currentTplId: string | null;
  totalTemplates: number;
  onToggle: (fi: number) => void;
  sameForAll: boolean;
  /** Save-state marker class per furnace chip (assignment changed vs the draft). */
  assignCls?: (fi: number) => string;
}

export default function HwFurnaceBar({ furnaceCount, furnaceNames, applyMap, currentTplId, totalTemplates, onToggle, sameForAll, assignCls }: Props) {
  if (sameForAll || furnaceCount === 1) return null;

  const furnacesOnThis = Object.values(applyMap).filter(id => id === currentTplId).length;
  const maxForThis = furnaceCount - totalTemplates + 1;

  return (
    <div className="border border-border rounded p-3 mb-3">
      <div className={clsx(styles.mono, 'text-[9px] text-text-secondary mb-2')}>
        Assign setting to the following furnaces
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: furnaceCount }, (_, fi) => {
          const assignedTo     = applyMap[fi];
          const isAssignedHere = assignedTo === currentTplId;
          const isElsewhere    = assignedTo && !isAssignedHere;
          const wouldExceed    = !isAssignedHere && furnacesOnThis >= maxForThis;

          let cls = clsx(styles.mono, 'px-2.5 py-1 rounded text-[9px] border transition');
          let disabled = false;
          let title = '';

          if (isAssignedHere) {
            cls += ' bg-accent-blue border-accent-blue text-white';
            title = `Click to unassign ${furnaceNames[fi]}`;
          } else if (isElsewhere) {
            cls += ' bg-surface border-border text-text-secondary opacity-50 cursor-not-allowed';
            disabled = true; title = `Assigned to another template`;
          } else if (wouldExceed) {
            cls += ' bg-surface border-border text-text-secondary opacity-50 cursor-not-allowed';
            disabled = true; title = `Cannot assign all furnaces to one template`;
          } else {
            cls += ' bg-surface border-border text-text-secondary hover:border-accent-blue hover:text-accent-blue cursor-pointer';
            title = `Click to assign ${furnaceNames[fi]}`;
          }

          return (
            <button
              key={fi}
              className={cls}
              title={title}
              disabled={disabled}
              onClick={() => !disabled && onToggle(fi)}
            >
              <span className={clsx(assignCls?.(fi))}>{furnaceNames[fi]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
