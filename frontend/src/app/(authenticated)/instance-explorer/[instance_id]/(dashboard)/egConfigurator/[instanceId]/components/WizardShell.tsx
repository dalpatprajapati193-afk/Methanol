'use client';

/**
 * WizardShell — client component owning all wizard interactivity.
 *
 * Receives the initial context from the server page, initialises Jotai atoms
 * from saved configData, and renders the active step component.
 */

import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import WizardStepper from '../../components/WizardStepper';
import Step1PlantConfig from '../../components/steps/Step1PlantConfig';
import Step2KpiSelection from '../../components/steps/Step2KpiSelection';
import Step3InputMapping from '../../components/steps/Step3InputMapping';
import Step4Forecasting from '../../components/steps/Step4Forecasting';
import Step5Review from '../../components/steps/Step5Review';
import { type InstanceContext } from '../../actions/Actions';
import {
  currentStepAtom, step1Atom, step2Atom, step3Atom, step4Atom, STEP1_DEFAULTS,
  type KpiSelectionState, type AdditionalInputsState, type ForecastState,
} from '../../store/WizardAtoms';

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

interface WizardShellProps {
  initialContext: InstanceContext;
}

export default function WizardShell({ initialContext }: WizardShellProps) {
  const [currentStep, setCurrentStep] = useAtom(currentStepAtom);
  const [, setStep1] = useAtom(step1Atom);
  const [, setStep2] = useAtom(step2Atom);
  const [, setStep3] = useAtom(step3Atom);
  const [, setStep4] = useAtom(step4Atom);

  // Hydrate atoms from saved configData on first render
  useEffect(() => {
    setCurrentStep(initialContext.currentStep);
    if (initialContext.configData && Object.keys(initialContext.configData).length > 0) {
      setStep1({ ...STEP1_DEFAULTS, ...(initialContext.configData as object) });
      if (initialContext.configData.kpi_selections) {
        setStep2(initialContext.configData.kpi_selections as KpiSelectionState);
      }
      if (initialContext.configData.input_mapping) {
        setStep3(initialContext.configData.input_mapping as AdditionalInputsState);
      }
      if (initialContext.configData.forecast_config) {
        setStep4(initialContext.configData.forecast_config as ForecastState);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepComponents: Record<number, React.ReactNode> = {
    1: (
      <Step1PlantConfig
        instanceId={initialContext.instanceId}
        onNext={() => setCurrentStep(2)}
      />
    ),
    2: (
      <Step2KpiSelection
        instanceId={initialContext.instanceId}
        onNext={() => setCurrentStep(3)}
        onBack={() => setCurrentStep(1)}
      />
    ),
    3: (
      <Step3InputMapping
        instanceId={initialContext.instanceId}
        onNext={() => setCurrentStep(4)}
        onBack={() => setCurrentStep(2)}
      />
    ),
    4: (
      <Step4Forecasting
        instanceId={initialContext.instanceId}
        onNext={() => setCurrentStep(5)}
        onBack={() => setCurrentStep(3)}
      />
    ),
    5: (
      <Step5Review
        instanceId={initialContext.instanceId}
        initialContext={initialContext}
        onBack={() => setCurrentStep(4)}
      />
    ),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header bar */}
      <header className="bg-surface border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-text-secondary uppercase tracking-wide">
              EG Plant Configurator
            </p>
            <h1 className="text-lg font-bold text-text-primary">
              {initialContext.plantName}
            </h1>
          </div>
          <span
            className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full',
              initialContext.status === 'published'
                ? 'bg-accent-green/10 text-accent-green'
                : 'bg-accent-yellow/10 text-accent-yellow'
            )}
          >
            {initialContext.status === 'published' ? 'submitted' : initialContext.status}
          </span>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-surface border-b border-border px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <WizardStepper
            currentStep={currentStep}
            completedUpTo={initialContext.currentStep}
            onStepClick={(s) => setCurrentStep(s)}
          />
        </div>
      </div>

      {/* Step content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          {stepComponents[currentStep]}
        </div>
      </main>
    </div>
  );
}

// Placeholder for steps not yet built
function ComingSoon({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">🚧</div>
      <h2 className="text-xl font-bold text-text-primary">Step {step}: {label}</h2>
      <p className="text-text-secondary mt-2">Coming soon — building iteratively.</p>
    </div>
  );
}
