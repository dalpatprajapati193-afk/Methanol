'use client';
import { useAtom } from 'jotai';
import { fmsStateAtom, activePageAtom, enterHwSection, hwTileState, hwSectionPct } from '../../store/FmsAtoms';
import { clsx } from 'clsx';
import styles from '../../Style.module.css';
import { Tile, badgeCls, type TileStatus } from '../../theme/Index';

export default function HardwareConfigPage() {
  const [fms, setFms] = useAtom(fmsStateAtom);
  const [, setActivePage] = useAtom(activePageAtom);

  const single = fms.furnaceCount === 1;

  function navHwSection(sec: 'conv' | 'rad') {
    setFms(prev => enterHwSection(prev, sec));
    setActivePage('hwdefine');
  }

  const convPct  = hwSectionPct(fms.hwConv, single);
  const radPct   = hwSectionPct(fms.hwRad,  single);
  const avgPct   = Math.round((convPct + radPct) / 2);

  const SECTIONS = [
    {
      key: 'conv' as const, label: 'Convection Section & Transfer Line Exchangers',
      pct: convPct, sec: fms.hwConv,
      color: 'var(--color-accent-orange)',
      icon: (
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
          <rect x="3" y="4" width="20" height="6" rx="1"/>
          <rect x="3" y="12" width="20" height="6" rx="1"/>
          <line x1="6" y1="10" x2="6" y2="12"/><line x1="13" y1="10" x2="13" y2="12"/><line x1="20" y1="10" x2="20" y2="12"/>
        </svg>
      ),
    },
    {
      key: 'rad' as const, label: 'Radiation Zone',
      pct: radPct, sec: fms.hwRad,
      color: 'var(--color-accent-red)',
      icon: (
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
          <circle cx="13" cy="13" r="4"/>
          <line x1="13" y1="3" x2="13" y2="7"/><line x1="13" y1="19" x2="13" y2="23"/>
          <line x1="3" y1="13" x2="7" y2="13"/><line x1="19" y1="13" x2="23" y2="13"/>
          <line x1="6" y1="6" x2="9" y2="9"/><line x1="17" y1="17" x2="20" y2="20"/>
          <line x1="20" y1="6" x2="17" y2="9"/><line x1="9" y1="17" x2="6" y2="20"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
      <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-8">
        <div className={clsx(styles.mono, 'text-xs font-semibold tracking-[.14em] text-text-secondary uppercase text-center')}>
          Furnace Hardware Configuration
        </div>

        <div className="flex gap-5 flex-wrap justify-center">
          {SECTIONS.map(s => {
            const tileState = hwTileState(s.sec);
            const status: TileStatus = tileState === 'complete' ? 'done'
              : tileState === 'incomplete' ? 'started'
              : 'todo';
            return (
              <Tile
                key={s.key}
                status={status}
                onClick={() => navHwSection(s.key)}
                icon={<div className="w-8 h-8 flex items-center justify-center">{s.icon}</div>}
                title={s.label}
                titleClassName={clsx(styles.mono, 'text-[11px] font-medium text-text-primary text-center px-3 leading-snug')}
              >
                <div className="flex-1" />
                {tileState === 'complete'
                  ? <span className={clsx(styles.mono, 'text-[9px]', badgeCls('green'))}>✓ Completed</span>
                  : tileState === 'incomplete'
                  ? <span className={clsx(styles.mono, 'text-[9px]', badgeCls('orange'))}>Started</span>
                  : <span className={clsx(styles.mono, 'text-[9px]', badgeCls('yellow'))}>Not Started</span>
                }
              </Tile>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
