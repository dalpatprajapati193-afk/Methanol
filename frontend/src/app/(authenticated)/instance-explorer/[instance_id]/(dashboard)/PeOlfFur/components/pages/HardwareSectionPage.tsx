'use client';
import { useAtom } from 'jotai';
import { fmsStateAtom, activePageAtom, HwSection, ConvFields, RadFields } from '../../store/FmsAtoms';
import { hwTileState } from '../../store/FmsAtoms';
import { clsx } from 'clsx';
import styles from '../../Style.module.css';
import { Tile, badgeCls, type BadgeAccent } from '../../theme/Index';

export default function HardwareSectionPage() {
  const [fms, setFms] = useAtom(fmsStateAtom);
  const [, setActivePage] = useAtom(activePageAtom);

  const sec = fms.hwCurSec;
  if (!sec) { setActivePage('hwcfg'); return null; }

  const hwSec = sec === 'conv' ? fms.hwConv : fms.hwRad;
  const single = fms.furnaceCount === 1;
  const sameForAll = hwSec.sameForAll === 1 || single;

  const SEC_LABELS: Record<string, string> = {
    conv: 'Convection Section & Transfer Line Exchangers',
    rad:  'Radiation Zone',
  };

  function setSameForAll(val: 0 | 1) {
    if (single) return;
    setFms(prev => {
      const s = sec === 'conv' ? { ...prev.hwConv } : { ...prev.hwRad };
      s.sameForAll = val;
      if (val === 0) { s.applyMap = {}; s.applyDone = false; }
      return {
        ...prev,
        hwConv: sec === 'conv' ? s as HwSection<ConvFields> : prev.hwConv,
        hwRad:  sec === 'rad'  ? s as HwSection<RadFields>  : prev.hwRad,
      };
    });
  }

  const defState = hwTileState(hwSec);
  const appLocked = !hwSec.defineDone;
  const appState  = appLocked ? 'not_started' : hwTileState(hwSec);

  function tileLabel(state: string) {
    if (state === 'complete')   return '✓ Complete';
    if (state === 'faulty')     return 'Faulty data entry';
    if (state === 'incomplete') return 'Incomplete data entry';
    return 'Not started';
  }

  // Status now rides the shared badge (green/orange/red/yellow) instead of the
  // tile border — same language as the Hub / Hardware-Config tiles.
  function stateAccent(state: string): BadgeAccent {
    if (state === 'complete')   return 'green';
    if (state === 'faulty')     return 'red';
    if (state === 'incomplete') return 'orange';
    return 'yellow';
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-6 w-full max-w-lg">
        <div className={clsx(styles.mono, 'text-xs font-semibold tracking-[.14em] text-text-secondary uppercase text-center')}>
          {SEC_LABELS[sec]} — Hardware
        </div>

        {/* Same-for-all toggle */}
        <div className="bg-surface border border-border rounded px-4 py-3 flex items-center gap-3 w-full">
          <span className={clsx(styles.mono, 'text-[10px] text-text-secondary flex-1')}>
            Is the hardware setup the same across all furnaces?
          </span>
          <div className={styles.seg}>
            <button
              className={clsx(styles.segBtn, sameForAll ? styles.segBtnYes : styles.segBtnNeutral)}
              onClick={() => setSameForAll(1)}
              disabled={single}
            >YES</button>
            <button
              className={clsx(styles.segBtn, !sameForAll ? styles.segBtnNo : styles.segBtnNeutral)}
              onClick={() => setSameForAll(0)}
              disabled={single}
            >NO</button>
          </div>
          {single && (
            <span className={clsx(styles.mono, 'text-[8px] text-text-secondary')}>(auto — single furnace)</span>
          )}
        </div>

        {/* Action tiles */}
        <div className="flex gap-5 flex-wrap justify-center">
          {/* Define tile */}
          <Tile
            onClick={() => setActivePage('hwdefine')}
            status={defState === 'complete' ? 'done' : defState === 'incomplete' ? 'started' : 'todo'}
            icon={
              <svg viewBox="0 0 28 28" fill="none" stroke="var(--color-accent-blue)" strokeWidth="1.5" width="28" height="28">
                <rect x="4" y="4" width="20" height="20" rx="2"/>
                <line x1="9" y1="10" x2="19" y2="10"/><line x1="9" y1="14" x2="19" y2="14"/><line x1="9" y1="18" x2="15" y2="18"/>
                <circle cx="21" cy="21" r="4" fill="var(--color-surface)" stroke="currentColor"/>
                <line x1="19.5" y1="21" x2="22.5" y2="21" stroke="currentColor"/>
                <line x1="21" y1="19.5" x2="21" y2="22.5" stroke="currentColor"/>
              </svg>
            }
            title="Define Hardware"
            titleClassName={clsx(styles.mono, 'text-[11px] font-semibold text-text-primary')}
          >
            <div className={clsx(styles.mono, 'text-[9px] text-text-secondary text-center px-2')}>Create hardware templates for this section</div>
            <div className="flex-1" />
            <span className={clsx(styles.mono, 'text-[9px]', badgeCls(stateAccent(defState)))}>
              {tileLabel(defState)}
            </span>
          </Tile>

          {/* Apply tile — hidden when sameForAll */}
          {!sameForAll && (
            <Tile
              disabled={appLocked}
              onClick={() => setActivePage('hwapply')}
              status={appState === 'complete' ? 'done' : appState === 'incomplete' ? 'started' : 'todo'}
              icon={
                <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                  <rect x="3" y="8" width="6" height="14" rx="1"/>
                  <rect x="11" y="5" width="6" height="17" rx="1"/>
                  <rect x="19" y="11" width="6" height="11" rx="1"/>
                </svg>
              }
              title="Apply Hardware"
              titleClassName={clsx(styles.mono, 'text-[11px] font-semibold text-text-primary')}
            >
              <div className={clsx(styles.mono, 'text-[9px] text-text-secondary text-center px-2')}>Map templates to furnaces</div>
              <div className="flex-1" />
              {appLocked
                ? <span className={clsx(styles.mono, 'text-[9px] text-text-secondary')}>Locked</span>
                : <span className={clsx(styles.mono, 'text-[9px]', badgeCls(stateAccent(appState)))}>{tileLabel(appState)}</span>}
            </Tile>
          )}
        </div>
      </div>
    </div>
  );
}
