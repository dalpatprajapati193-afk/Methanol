'use client';
import { useAtom } from 'jotai';
import { activePageAtom, fmsStateAtom, confirmedBaselineAtom, type PageKey } from '../../store/FmsAtoms';
import { fuelStateAtom } from '../../store/FuelAtoms';
import { isRecordedGreen } from '../../constants/ModulesStatus';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TEXT, Tile } from '../../theme/Index';

const cn = (...a: ClassValue[]) => twMerge(clsx(a));

interface Tile {
  key: PageKey;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const TILES: Tile[] = [
  {
    key: 'hub',
    title: 'Know Your Case',
    desc: 'Define your furnace fleet and hardware to build your case.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="34" height="34" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5 12 4l9 5.5" /><path d="M5 10.5V20h14v-9.5" /><path d="M9 20v-5h6v5" />
      </svg>
    ),
  },
  {
    key: 'packages',
    title: 'Packages / KPI',
    desc: 'Pick the optimization packages and KPIs that drive your analysis.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="34" height="34" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
        <line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
      </svg>
    ),
  },
];

export default function LandingPage() {
  const [, setActivePage] = useAtom(activePageAtom);
  const [fms] = useAtom(fmsStateAtom);
  const [fuel] = useAtom(fuelStateAtom);
  const [baseline] = useAtom(confirmedBaselineAtom);

  // The Packages/KPI tile unlocks only once the Configuration Modules are
  // complete AND confirmed with the current entries (green). A refresh resets the
  // session baseline, so the tile re-locks until the modules are confirmed again.
  const packagesUnlocked = isRecordedGreen(baseline, fms, fuel);

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-10 bg-background">
      <div className="flex flex-col items-center gap-10 w-full max-w-3xl">
        <div className="text-center">
          <div className={cn(TEXT.pageTitle, 'tracking-wide')}>
            Olefin Furnace Suite
          </div>
        </div>

        <div className="flex gap-6 flex-wrap justify-center w-full">
          {TILES.map(t => {
            const locked = t.key === 'packages' && !packagesUnlocked;
            return (
              <Tile
                key={t.key}
                locked={locked}
                onClick={() => !locked && setActivePage(t.key)}
                tooltip={locked ? 'Complete and confirm the Configuration Modules first' : undefined}
                icon={t.icon}
                title={t.title}
              >
                <div className={cn(TEXT.caption, 'leading-relaxed')}>{t.desc}</div>
              </Tile>
            );
          })}
        </div>
      </div>
    </div>
  );
}
