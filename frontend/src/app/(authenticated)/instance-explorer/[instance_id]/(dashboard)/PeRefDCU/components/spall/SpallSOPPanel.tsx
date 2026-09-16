'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  tagEntriesAtom,
  setTagEntryAtom,
  wizardQuestionsAtom,
  DEFAULT_TAG_ENTRY,
  getTagEntry,
} from '../../store/dcuAtoms'
import type { TagEntry } from '../../types'

const SPALL_MODEL_ID = 5

export function SpallSOPPanel({ onNext, onBack }: {
  onNext: () => void
  onBack: () => void
}) {
  const tagEntries = useAtomValue(tagEntriesAtom)
  const setTagEntry = useSetAtom(setTagEntryAtom)
  const wizardQuestions = useAtomValue(wizardQuestionsAtom)

  const questions = useMemo(
    () => wizardQuestions.filter(q => q.model_ids.includes(SPALL_MODEL_ID)).sort((a, b) => a.order - b.order),
    [wizardQuestions]
  )
  const targetStepsQuestion = questions.find(q => q.input_type === 'target_steps')

  const [answers, setAnswers] = useState<Record<string, string>>({})
  // key = child.attribute_prefix → array of N string values (one per step)
  const [stepChildValues, setStepChildValues] = useState<Record<string, string[]>>({})

  // Pre-populate from existing tag entries on mount
  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const q of questions) {
      const entry = getTagEntry(tagEntries, q.node_id, q.attribute)
      if (entry?.tag_type === 'constant') initial[q.id] = entry.constant_value || ''
    }
    setAnswers(initial)

    if (targetStepsQuestion) {
      const stepsEntry = getTagEntry(tagEntries, targetStepsQuestion.node_id, targetStepsQuestion.attribute)
      const steps = stepsEntry?.tag_type === 'constant' ? Number(stepsEntry.constant_value || 0) : 0
      if (steps > 0) {
        const childInit: Record<string, string[]> = {}
        for (const child of targetStepsQuestion.child_questions ?? []) {
          const vals: string[] = []
          for (let i = 1; i <= steps; i++) {
            const e = getTagEntry(tagEntries, targetStepsQuestion.node_id, `${child.attribute_prefix}_${i}`)
            vals.push(e?.tag_type === 'constant' ? (e.constant_value || '') : '')
          }
          childInit[child.attribute_prefix] = vals
        }
        setStepChildValues(childInit)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-populate when tagEntries loads (handles race condition on page refresh)
  useEffect(() => {
    if (!targetStepsQuestion) return
    const systemEntries = tagEntries[targetStepsQuestion.node_id]
    if (!systemEntries || Object.keys(systemEntries).length === 0) return

    const newAnswers: Record<string, string> = { ...answers }
    for (const q of questions) {
      const entry = systemEntries[q.attribute]
      if (entry?.tag_type === 'constant') newAnswers[q.id] = entry.constant_value || ''
    }
    setAnswers(newAnswers)

    const stepEntry = systemEntries[targetStepsQuestion.attribute]
    const steps = stepEntry?.tag_type === 'constant' ? Number(stepEntry.constant_value || 0) : 0
    if (steps > 0) {
      const childInit: Record<string, string[]> = {}
      for (const child of targetStepsQuestion.child_questions ?? []) {
        const vals: string[] = []
        for (let i = 1; i <= steps; i++) {
          const e = systemEntries[`${child.attribute_prefix}_${i}`]
          vals.push(e?.tag_type === 'constant' ? (e.constant_value || '') : '')
        }
        childInit[child.attribute_prefix] = vals
      }
      setStepChildValues(childInit)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagEntries])

  // Sync child-value arrays length when step count changes
  useEffect(() => {
    if (!targetStepsQuestion) return
    const n = Number(answers[targetStepsQuestion.id] || 0)
    if (n > 0) {
      setStepChildValues(prev => {
        const next: Record<string, string[]> = {}
        for (const child of targetStepsQuestion.child_questions ?? []) {
          const existing = prev[child.attribute_prefix] ?? []
          const arr = [...existing]
          while (arr.length < n) arr.push('')
          next[child.attribute_prefix] = arr.slice(0, n)
        }
        return next
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetStepsQuestion && answers[targetStepsQuestion.id]])

  const handleAnswerChange = (id: string, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  const handleChildValueChange = (prefix: string, idx: number, value: string) => {
    setStepChildValues(prev => {
      const arr = [...(prev[prefix] ?? [])]
      arr[idx] = value
      return { ...prev, [prefix]: arr }
    })
  }

  const handleNext = () => {
    // Save all non-target_steps answers
    for (const q of questions) {
      if (q.input_type === 'target_steps') continue
      const existing = getTagEntry(tagEntries, q.node_id, q.attribute)
      const entry: TagEntry = {
        ...DEFAULT_TAG_ENTRY,
        ...existing,
        tag_type: 'constant',
        constant_value: answers[q.id] || '',
      }
      setTagEntry(q.node_id, q.attribute, entry)
    }

    // Save target_steps answer and child values
    if (targetStepsQuestion) {
      const existing = getTagEntry(tagEntries, targetStepsQuestion.node_id, targetStepsQuestion.attribute)
      const entry: TagEntry = {
        ...DEFAULT_TAG_ENTRY,
        ...existing,
        tag_type: 'constant',
        constant_value: answers[targetStepsQuestion.id] || '',
      }
      setTagEntry(targetStepsQuestion.node_id, targetStepsQuestion.attribute, entry)

      for (const child of targetStepsQuestion.child_questions ?? []) {
        const vals = stepChildValues[child.attribute_prefix] ?? []
        // Sort ascending if this is a temperature-like attribute
        const isTemp = child.attribute_prefix === 'hold_temp'
        const sorted = isTemp
          ? [...vals].map(Number).filter(v => !isNaN(v)).sort((a, b) => a - b).map(String)
          : vals

        sorted.forEach((val, i) => {
          const childExisting = getTagEntry(tagEntries, targetStepsQuestion.node_id, `${child.attribute_prefix}_${i + 1}`)
          const childEntry: TagEntry = {
            ...DEFAULT_TAG_ENTRY,
            ...childExisting,
            tag_type: 'constant',
            constant_value: val,
          }
          setTagEntry(targetStepsQuestion.node_id, `${child.attribute_prefix}_${i + 1}`, childEntry)
        })
      }
    }

    onNext()
  }

  // Build dynamic row counter
  const stepCount = targetStepsQuestion ? Number(answers[targetStepsQuestion.id] || 0) : 0
  const staticQuestions = questions.filter(q => q.input_type !== 'target_steps')
  const targetStepsRow = targetStepsQuestion ? 1 : 0
  const baseCount = staticQuestions.length + targetStepsRow

  return (
    <div className="flex flex-col flex-1 min-h-0">

      <div className="flex gap-[18px] flex-1 min-h-0 items-stretch">

        {/* Left: configuration */}
        <div className="flex-[2] min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="bg-accent-blue px-4 py-[9px]">
                <span className="text-[11px] font-bold text-white uppercase tracking-[0.6px]">
                  Spall Operation Guidelines
                </span>
              </div>

              <div className="p-4">
                <table className="w-full text-[12px] border-collapse mb-5">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left pb-2 pr-3 text-[10px] font-bold text-text-secondary uppercase tracking-wide w-[40px]">#</th>
                      <th className="text-left pb-2 pr-3 text-[10px] font-bold text-text-secondary uppercase tracking-wide">Question</th>
                      <th className="text-left pb-2 text-[10px] font-bold text-text-secondary uppercase tracking-wide w-[220px]">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Static questions (select + number) */}
                    {staticQuestions.map((q, idx) => (
                      <tr key={q.id} className="border-b border-border/50">
                        <td className="pt-2.5 pb-2.5 pr-3 text-text-secondary font-medium">{idx + 1}</td>
                        <td className="pt-2.5 pb-2.5 pr-3 text-text-primary">{q.label}</td>
                        <td className="pt-2.5 pb-2.5">
                          {q.input_type === 'select' ? (
                            <select
                              value={answers[q.id] || ''}
                              onChange={e => handleAnswerChange(q.id, e.target.value)}
                              className="w-full px-2 py-1.5 text-[11px] border border-border rounded bg-background text-text-primary font-[inherit] cursor-pointer box-border"
                            >
                              <option value="">— Select —</option>
                              {q.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <input
                              type="number"
                              value={answers[q.id] || ''}
                              onChange={e => handleAnswerChange(q.id, e.target.value)}
                              placeholder="Enter value"
                              className="w-full px-2 py-1.5 text-[11px] border border-border rounded bg-background text-text-primary font-[inherit] box-border"
                            />
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* target_steps question */}
                    {targetStepsQuestion && (
                      <tr className="border-b border-border/50">
                        <td className="pt-2.5 pb-2.5 pr-3 text-text-secondary font-medium">{staticQuestions.length + 1}</td>
                        <td className="pt-2.5 pb-2.5 pr-3 text-text-primary">{targetStepsQuestion.label}</td>
                        <td className="pt-2.5 pb-2.5">
                          <select
                            value={answers[targetStepsQuestion.id] || ''}
                            onChange={e => handleAnswerChange(targetStepsQuestion.id, e.target.value)}
                            className="w-full px-2 py-1.5 text-[11px] border border-border rounded bg-background text-text-primary font-[inherit] cursor-pointer box-border"
                          >
                            <option value="">— Select —</option>
                            {targetStepsQuestion.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </td>
                      </tr>
                    )}

                    {/* Dynamic child rows per step, interleaved by child type */}
                    {targetStepsQuestion && stepCount > 0 && Array.from({ length: stepCount }, (_, stepIdx) => (
                      (targetStepsQuestion.child_questions ?? []).map((child, childIdx) => {
                        const globalIdx = baseCount + stepIdx * (targetStepsQuestion.child_questions?.length ?? 0) + childIdx
                        const label = child.label_template.replace('{n}', String(stepIdx + 1))
                        const val = (stepChildValues[child.attribute_prefix] ?? [])[stepIdx] ?? ''
                        return (
                          <tr key={`${child.attribute_prefix}-${stepIdx}`} className="border-b border-border/50">
                            <td className="pt-2.5 pb-2.5 pr-3 text-text-secondary font-medium">{globalIdx + 1}</td>
                            <td className="pt-2.5 pb-2.5 pr-3 text-text-primary">{label}</td>
                            <td className="pt-2.5 pb-2.5">
                              <input
                                type="number"
                                value={val}
                                onChange={e => handleChildValueChange(child.attribute_prefix, stepIdx, e.target.value)}
                                placeholder="Enter value"
                                className="w-full px-2 py-1.5 text-[11px] border border-border rounded bg-background text-text-primary font-[inherit] box-border"
                              />
                            </td>
                          </tr>
                        )
                      })
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right: info sidebar */}
        <div className="flex-1 min-w-[200px] flex flex-col gap-3 overflow-y-auto">
          <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-xl p-[14px_16px]">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-2 h-2 rounded-full bg-accent-blue shrink-0" />
              <span className="text-[13px] font-bold text-text-primary">Operation Guidelines</span>
            </div>
            <p className="text-[11px] text-text-secondary leading-[1.55] mb-3">
              Define plant-specific spall SOP parameters — instrumentation type, steam rates, and hold temperature targets used to build the spall detection baseline.
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Category', value: 'Furnace' },
                { label: 'Step', value: '3 of 3' },
                { label: 'Fields', value: String(questions.length) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[11px] text-text-secondary">{label}</span>
                  <span className="text-[11px] font-bold text-text-primary">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-[12px_14px]">
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5 text-accent-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[11px] font-bold text-accent-blue">Configuration tips</span>
            </div>
            <ul className="m-0 pl-4 text-[11px] text-accent-blue leading-[1.7]">
              <li>Hold temperature steps are automatically sorted ascending on save.</li>
              <li>Run frequency controls how often spall detection re-evaluates predictions.</li>
              <li>Leave optional fields blank to use defaults defined in the model schema.</li>
            </ul>
          </div>
        </div>

      </div>

      <div className="shrink-0 flex justify-between pt-3.5 border-t border-border">
        <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary shadow-sm hover:text-text-primary" onClick={onBack}>← Back</button>
        <button className="inline-flex items-center gap-2 rounded-md bg-accent-blue px-4 py-2.5 text-[13px] font-bold text-white shadow-lg" onClick={handleNext}>
          Next: Tag Mapping →
        </button>
      </div>

    </div>
  )
}
