'use client';
import { useAtom } from 'jotai';
import { fmsStateAtom, activePageAtom, HwSection, ConvFields, RadFields } from '../../store/FmsAtoms';
import SvPanel from '../SvPanel';
import { usePanelRows } from '../usePanelRows';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from '../../Style.module.css';
import { TABLE, FIELD, BUTTON } from '../../theme/Index';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

function furnaceName(fms: { furnaceInfo: { name: string }[] }, fi: number) {
  const n = fms.furnaceInfo[fi]?.name?.trim();
  return n ? `Furnace ${n}` : `Furnace ${fi + 1}`;
}

export default function HardwareApplyPage() {
  const [fms, setFms] = useAtom(fmsStateAtom);
  const [, setActivePage] = useAtom(activePageAtom);

  const sec = fms.hwCurSec;
  if (!sec) { setActivePage('hwcfg'); return null; }

  const hwSec = sec === 'conv' ? fms.hwConv as HwSection<ConvFields>
              :                  fms.hwRad  as HwSection<RadFields>;

  function patchSec(patch: Partial<typeof hwSec>) {
    setFms(prev => {
      const s = { ...(sec==='conv'?prev.hwConv:prev.hwRad), ...patch };
      return {
        ...prev,
        hwConv: sec==='conv' ? s as HwSection<ConvFields> : prev.hwConv,
        hwRad:  sec==='rad'  ? s as HwSection<RadFields>  : prev.hwRad,
      };
    });
  }

  function setApply(fi: number, tplId: string) {
    const newMap = { ...hwSec.applyMap, [fi]: tplId };
    const allAssigned = Array.from({ length: fms.furnaceCount }, (_, i) => i).every(i => !!newMap[i]);
    const allTplUsed  = hwSec.templates.every(t => Object.values(newMap).includes(t.id));
    patchSec({ applyMap: newMap, applyDone: allAssigned && allTplUsed });
  }

  function save() {
    const allAssigned = Array.from({ length: fms.furnaceCount }, (_, i) => i).every(i => !!hwSec.applyMap[i]);
    const allTplUsed  = hwSec.templates.every(t => Object.values(hwSec.applyMap).includes(t.id));
    patchSec({ applyDone: allAssigned && allTplUsed });
    setActivePage('hwcfg');
  }

  const statusText = (() => {
    const assigned = Array.from({ length: fms.furnaceCount }, (_, i) => i).filter(i => !!hwSec.applyMap[i]).length;
    if (hwSec.applyDone) return '✓ All furnaces assigned';
    if (assigned > 0) return `${assigned} / ${fms.furnaceCount} furnaces assigned`;
    return '—';
  })();

  const hwPanelSection =
    sec === 'conv' ? ['Hardware › Convection', 'Hardware › TLE'] as string[] :
                     'Hardware › Radiation';
  const svRows = usePanelRows(hwPanelSection);

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
      <SvPanel rows={svRows} />
      <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-2.5 bg-surface border-b border-border">
        <div className={clsx(styles.mono, 'text-xs font-semibold text-text-primary')}>Apply Hardware</div>
        <div className={clsx(styles.mono, 'text-[8px] text-text-secondary')}>Map hardware templates to furnaces</div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className={TABLE.wrap}>
        <table className="w-full border-collapse">
          <thead>
            <tr className={TABLE.header}>
              <th className={clsx(styles.mono, 'text-[9px] font-semibold text-text-secondary px-3 py-2 text-center min-w-[130px]')}>Furnace</th>
              <th className={clsx(styles.mono, 'text-[9px] font-semibold text-text-secondary px-3 py-2 text-center')}>Hardware Template</th>
            </tr>
          </thead>
          <tbody className={TABLE.divide}>
            {Array.from({ length: fms.furnaceCount }, (_, fi) => {
              return (
              <tr key={fi} className={TABLE.row}>
                <td className={clsx(styles.mono, 'px-3 py-2 text-[10px] text-text-primary text-left')}>
                  {furnaceName(fms, fi)}
                </td>
                <td className="px-3 py-2 text-center">
                  <select
                    value={hwSec.applyMap[fi] || ''}
                    onChange={e => setApply(fi, e.target.value)}
                    className={cn(
                      styles.mono, styles.fiSel,
                      FIELD.input,
                      'w-full max-w-xs text-[10px]',
                      !hwSec.applyMap[fi] && 'text-text-secondary'
                    )}
                  >
                    <option value="">Select template…</option>
                    {hwSec.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-border bg-surface">
        <span className={clsx(styles.mono, 'text-[9px]', hwSec.applyDone ? 'text-accent-green' : 'text-text-secondary')}>{statusText}</span>
        <div className="flex gap-2">
          <button onClick={() => setActivePage('hwcfg')} className={cn(styles.mono, BUTTON.ghost, 'text-[9px]')}>Save &amp; Exit</button>
          <button onClick={save} className={clsx(styles.mono, 'px-4 py-1.5 bg-accent-blue border border-accent-blue rounded text-[9px] text-white hover:opacity-90 transition')}>Save</button>
        </div>
      </div>
      </div>
    </div>
  );
}
