'use client';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

export const WIZARD_STEPS = [
  { number: 1, label: 'Plant Config',   description: 'Equipment & design parameters' },
  { number: 2, label: 'KPI Selection',  description: 'Choose applicable KPIs' },
  { number: 3, label: 'Input Mapping',  description: 'Map PI tags to KPI inputs' },
  { number: 4, label: 'Forecasting',    description: 'Soft sensor configuration' },
  { number: 5, label: 'Review',         description: 'Review & submit' },
];

interface WizardStepperProps {
  currentStep: number;
  completedUpTo: number;
  onStepClick?: (step: number) => void;
}

export default function WizardStepper({
  currentStep,
  completedUpTo,
  onStepClick,
}: WizardStepperProps) {
  return (
    <nav aria-label="Wizard steps" className="w-full">
      <ol className="flex items-center w-full">
        {WIZARD_STEPS.map((step, idx) => {
          const isCompleted = step.number < completedUpTo;
          const isCurrent  = step.number === currentStep;
          const isClickable = step.number <= completedUpTo && !!onStepClick;
          const isLast = idx === WIZARD_STEPS.length - 1;

          return (
            <li key={step.number} className={cn('flex items-center', !isLast && 'flex-1')}>
              {/* Step button */}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(step.number)}
                className={cn(
                  'flex flex-col items-center gap-1 group',
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                )}
              >
                {/* Circle */}
                <span
                  className={cn(
                    'flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-bold transition-all',
                    isCompleted && 'bg-accent-blue border-accent-blue text-white',
                    isCurrent  && 'bg-background border-accent-blue text-accent-blue scale-110 shadow-md',
                    !isCompleted && !isCurrent && 'bg-surface border-border text-text-secondary'
                  )}
                >
                  {isCompleted ? '✓' : step.number}
                </span>
                {/* Label — only visible on md+ */}
                <span
                  className={cn(
                    'hidden md:block text-xs font-medium transition-colors',
                    isCurrent  && 'text-accent-blue',
                    isCompleted && 'text-text-primary',
                    !isCompleted && !isCurrent && 'text-text-secondary'
                  )}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-2 h-0.5 rounded-full transition-all"
                  style={{
                    background: step.number < completedUpTo
                      ? 'var(--color-accent-blue)'
                      : 'var(--color-border)',
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
