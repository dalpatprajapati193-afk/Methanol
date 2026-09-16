'use client';
import { useAtom, useAtomValue } from 'jotai';
import { activePageAtom, type PageKey } from '../../store/FmsAtoms';
import { pkgSelectionAtom, pkgKpiBaselineAtom } from '../../store/PkgSelectionAtoms';
import { isPackageKpiGreen } from '../../constants/PkgSelectionStatus';
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
    key: 'pkgSelection',
    title: 'KPI / Package Selection',
    desc: 'Select optimization packages and define the key performance indicators to track.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="34" height="34" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" />
        <path d="M7 7h.01M17 17h.01" />
      </svg>
    ),
  },
  {
    key: 'inputSheet',
    title: 'Input Sheet',
    desc: 'Capture and review the input data required to run the selected packages.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="34" height="34" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M10.4 12.6a2 2 0 0 1 3 3L8 21l-4 1 1-4 5.4-5.4z" />
      </svg>
    ),
  },
];

export default function PackagesPage() {
  const [, setActivePage] = useAtom(activePageAtom);
  const selection = useAtomValue(pkgSelectionAtom);
  const baseline = useAtomValue(pkgKpiBaselineAtom);

  // The Input Sheet tile unlocks only once the KPI / Package selection is
  // complete AND confirmed with the current selection (green). Otherwise it
  // stays locked — mirrors how the Landing page gates the Packages/KPI tile.
  const inputSheetUnlocked = isPackageKpiGreen(baseline, selection);

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-10 bg-background">
      <div className="flex flex-col items-center gap-10 w-full max-w-3xl">
        <div className="text-center">
          <div className={cn(TEXT.pageTitle, 'tracking-wide')}>
            Packages / KPI
          </div>
        </div>

        <div className="flex gap-6 flex-wrap justify-center w-full">
          {TILES.map(t => {
            const locked = t.key === 'inputSheet' && !inputSheetUnlocked;
            return (
              <Tile
                key={t.key}
                locked={locked}
                onClick={() => !locked && setActivePage(t.key)}
                tooltip={locked ? 'Confirm the KPI / Package selection first' : undefined}
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
