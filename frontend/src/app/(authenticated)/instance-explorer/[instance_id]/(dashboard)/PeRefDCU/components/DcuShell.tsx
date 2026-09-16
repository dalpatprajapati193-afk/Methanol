'use client'

import { useEffect, useRef, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  stepAtom, maxStepAtom, setStepAtom, viewAtom, dcuZoomAtom,
  buildSaveConfigPayloadAtom,
} from '../store/dcuAtoms'
import { hydrateBlueprintAtom } from '../store/dcuAtoms'
import { getBlueprintBundle, saveDraft } from '../actions/actions'
import Step1Dashboard from './steps/Step1_Dashboard'
import Step2Equipment from './steps/Step2_Equipment'
import Step3Models from './steps/Step3_Models'
import Step4TagMapping from './steps/Step4_TagMapping'
import StepSanityCheck from './steps/StepSanityCheck'
import Step6Review from './steps/Step6_Review'
import BlueprintManager from './admin/BlueprintManager'
import ModelBlueprintManager from './admin/ModelBlueprintManager'

const TOTAL_STEPS = 6
const NAV_STEPS = [1, 2, 3, 4, 6]
const ZOOM_MIN = 0.5
const ZOOM_MAX = 1.25
const ZOOM_STEP = 0.05
const SHOW_ADMIN_TOOLS = process.env.NEXT_PUBLIC_PEREFDCU_SHOW_ADMIN_TOOLS === 'true'

const STEP_META = [
  { short: 'Welcome', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { short: 'Equipment', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { short: 'Models', icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18' },
  { short: 'Tag Mapping', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
  { short: 'Review', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
]

export function DcuShell({ instanceId, instanceName }: { instanceId: string; instanceName: string }) {
  const [step, setStepRaw] = useAtom(stepAtom)
  const maxStep = useAtomValue(maxStepAtom)
  const setStep = useSetAtom(setStepAtom)
  const [view, setView] = useAtom(viewAtom)
  const [zoom, setZoom] = useAtom(dcuZoomAtom)
  const hydrateBlueprint = useSetAtom(hydrateBlueprintAtom)
  const currentConfig = useAtomValue(buildSaveConfigPayloadAtom)
  const [loadingBlueprint, setLoadingBlueprint] = useState(true)
  const [blueprintError, setBlueprintError] = useState<string | null>(null)
  const isHydrated = useRef(false)

  useEffect(() => {
    let cancelled = false
    getBlueprintBundle().then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        hydrateBlueprint(res.data)
      } else {
        setBlueprintError(res.error ?? 'Failed to load blueprint reference data')
      }
      setLoadingBlueprint(false)
      isHydrated.current = true
    })
    return () => { cancelled = true }
  }, [hydrateBlueprint])

  // Autosave draft on step change (after initial hydration)
  useEffect(() => {
    if (!isHydrated.current) return
    saveDraft(instanceId, currentConfig, step)
  }, [step])

  // Flush draft when user hides the tab
  useEffect(() => {
    const handleHide = () => {
      if (document.hidden && isHydrated.current) {
        saveDraft(instanceId, currentConfig, step)
      }
    }
    document.addEventListener('visibilitychange', handleHide)
    return () => document.removeEventListener('visibilitychange', handleHide)
  }, [instanceId, currentConfig, step])

  const next = () => setStep(Math.min(step + 1, TOTAL_STEPS))
  const back = () => setStep(Math.max(step - 1, 1))
  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))
  const zoomIn = () => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))

  if (loadingBlueprint) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-sm text-text-secondary">Loading blueprint reference data…</p>
      </div>
    )
  }

  if (blueprintError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-sm text-accent-red">{blueprintError}</p>
      </div>
    )
  }

  return (
    <div
      className="absolute top-0 left-0 flex flex-col overflow-hidden bg-background"
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        width: `${100 / zoom}%`,
        height: `${100 / zoom}%`,
      }}
    >
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="flex w-48 shrink-0 flex-col overflow-hidden border-r border-border bg-surface">
          <nav className="flex-1 overflow-y-auto py-1.5">
            <button
              onClick={() => setView('wizard')}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[11px] font-bold transition-colors ${
                view === 'wizard' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              WIZARD
            </button>

            {view === 'wizard' && (
              <div className="py-1">
                {STEP_META.map((meta, i) => {
                  const s = NAV_STEPS[i]
                  const isDone = s < maxStep
                  const isActive = s === step
                  const canClick = s <= maxStep

                  return (
                    <div key={s}>
                      <div
                        onClick={() => canClick && setStepRaw(s)}
                        className={`flex items-center gap-2.5 border-l-[3px] py-1.5 pl-2 pr-2.5 transition-colors ${
                          isActive ? 'border-accent-blue bg-accent-blue/10' : 'border-transparent'
                        } ${canClick ? 'cursor-pointer hover:bg-surface-hover' : 'cursor-default'}`}
                      >
                        <div
                          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border ${
                            isDone
                              ? 'border-accent-blue/40 bg-accent-blue/15'
                              : isActive
                                ? 'border-accent-blue bg-accent-blue text-white'
                                : 'border-border bg-background'
                          }`}
                        >
                          {isDone ? (
                            <svg className="h-2.5 w-2.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-text-secondary'}`}>{s}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-[11px] leading-tight ${isActive ? 'font-bold text-text-primary' : isDone ? 'font-semibold text-text-primary' : 'font-semibold text-text-secondary/50'}`}>
                            {meta.short}
                          </div>
                          <div className={`mt-0.5 text-[9px] font-semibold ${isDone ? 'text-accent-green' : isActive ? 'text-accent-blue' : 'text-text-secondary/40'}`}>
                            {isDone ? 'Done' : isActive ? 'Active' : 'Locked'}
                          </div>
                        </div>
                      </div>
                      {i < STEP_META.length - 1 && (
                        <div className={`ml-[19px] h-1.5 w-px ${isDone ? 'bg-accent-blue/30' : 'bg-border'}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {SHOW_ADMIN_TOOLS && (
              <>
                <div className="mx-2.5 my-1 h-px bg-border" />

                <button
                  onClick={() => setView('blueprint-manager')}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[11px] font-bold transition-colors ${
                    view === 'blueprint-manager' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2m6-2v2M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2m0 0V3m0 2V3m0 14h2m-6 0h4m0 0v2m0-2v-4m-6 4v2m0-2v-4" />
                  </svg>
                  BLUEPRINT MGR
                </button>

                <button
                  onClick={() => setView('model-blueprint')}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[11px] font-bold transition-colors ${
                    view === 'model-blueprint' ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  MODEL MGR
                </button>
              </>
            )}
          </nav>

          <div className="mt-auto border-t border-border px-3.5 py-2 flex items-center justify-between">
            <span className="text-[10px] text-text-secondary">DCU FURNACE</span>
            <div className="flex items-center gap-1 rounded-md border border-border px-1 py-0.5">
              <button
                onClick={zoomOut}
                title="Zoom out"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-xs font-bold text-text-secondary hover:bg-surface-hover"
              >
                −
              </button>
              <span className="w-7 text-center text-[10px] font-bold text-text-secondary">{Math.round(zoom * 100)}%</span>
              <button
                onClick={zoomIn}
                title="Zoom in"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-xs font-bold text-text-secondary hover:bg-surface-hover"
              >
                +
              </button>
            </div>
          </div>
        </aside>

        <main className="flex flex-1 min-h-0 flex-col self-stretch overflow-hidden">
          {SHOW_ADMIN_TOOLS && view === 'model-blueprint' ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-5">
              <ModelBlueprintManager instanceId={instanceId} />
            </div>
          ) : SHOW_ADMIN_TOOLS && view === 'blueprint-manager' ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-5">
              <BlueprintManager instanceId={instanceId} />
            </div>
          ) : step === 2 ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-5">
              <Step2Equipment onNext={next} onBack={back} />
            </div>
          ) : step === 3 ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-5">
              <Step3Models onNext={next} onBack={back} />
            </div>
          ) : step === 4 ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-5">
              <Step4TagMapping onNext={next} onBack={back} />
            </div>
          ) : step === 5 ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-5">
              <StepSanityCheck onNext={next} onBack={back} />
            </div>
          ) : step === 6 ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-5">
              <Step6Review onBack={back} instanceId={instanceId} />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden p-5">
              {step === 1 && <Step1Dashboard onNext={next} instanceId={instanceId} instanceName={instanceName} />}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
