'use client'

import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { clientIdAtom, equipmentAtom, hydrateConfigAtom } from '../../store/dcuAtoms'
import { loadSubmittedConfigFromDb } from '../../actions/actions'

interface Props {
  onNext: () => void
  instanceId: string
  instanceName: string
}

export default function Step1Dashboard({ onNext, instanceId, instanceName }: Props) {
  const setClientId = useSetAtom(clientIdAtom)
  const equipment = useAtomValue(equipmentAtom)
  const hydrateConfig = useSetAtom(hydrateConfigAtom)

  useEffect(() => {
    setClientId(instanceId)

    // Auto-load the last submitted DB config once per session — skip if
    // equipment is already loaded (previous mount already hydrated it, or
    // Step 2 has been visited), so this never clobbers live in-session edits.
    const isEqLoaded = equipment.furnaces.length > 0 || equipment.drumTrains.length > 0 || equipment.fractionators.length > 0
    if (!isEqLoaded) {
      loadSubmittedConfigFromDb(instanceId).then((res) => {
        if (res.success && res.data?.config) {
          hydrateConfig(res.data.config)
        }
      }).catch(() => { /* silently ignore — wizard still usable without a hydrated config */ })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId])

  return (
    <div className="w-full">
      <div className="flex flex-col items-center justify-center text-center py-16">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Welcome to {instanceName}</h2>
        <p className="max-w-md text-sm text-text-secondary mb-1">
          This wizard captures your plant&apos;s equipment layout and PI sensor mappings — the data our
          models use to calculate KPIs and power your live Process Efficiency dashboard.
        </p>
        <p className="max-w-md text-xs text-text-secondary">
          A few steps: Equipment → Models → Tag Mapping → Review.
        </p>
      </div>

      <div className="fixed bottom-6 right-8 z-[100]">
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg"
        >
          Start Configuration →
        </button>
      </div>
    </div>
  )
}
