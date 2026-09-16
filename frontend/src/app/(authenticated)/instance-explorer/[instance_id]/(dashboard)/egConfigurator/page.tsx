/**
 * egConfigurator — entry point
 *
 * LOCAL (USE_MOCK_DATA=true):
 *   Shows a list of mock plant instances so developers can click into the wizard.
 *   Simulates what the main product UI does in integrated mode.
 *
 * INTEGRATED (USE_MOCK_DATA=false):
 *   This route is never visited in normal flow — the main product UI navigates
 *   directly to /egConfigurator/[instanceId].
 *   Shows a gate message in case someone lands here by accident.
 */

import Link from 'next/link';
import { getMockInstances } from './actions/Actions';

const IS_MOCK = process.env.USE_MOCK_DATA === 'true';

export default async function EgConfiguratorIndexPage() {
  if (!IS_MOCK) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="bg-surface border border-border rounded-xl p-10 max-w-md text-center">
          <div className="text-4xl mb-4">🏭</div>
          <h1 className="text-xl font-bold text-text-primary mb-2">
            EG Plant Configurator
          </h1>
          <p className="text-text-secondary text-sm">
            This tool is launched from the main product dashboard for a specific
            plant instance. Please navigate here from the product UI.
          </p>
        </div>
      </div>
    );
  }

  // Local dev — show mock instance launcher
  const instances = await getMockInstances();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 rounded-full px-3 py-1 text-xs font-semibold mb-4">
            LOCAL DEV MODE
          </div>
          <h1 className="text-3xl font-bold text-text-primary">
            EG Plant Configurator
          </h1>
          <p className="text-text-secondary mt-1">
            Select a mock plant instance to open the wizard. In production, this
            page is not used — the main product UI launches the wizard directly.
          </p>
        </div>

        {/* Instance list */}
        <div className="flex flex-col gap-3">
          {instances.map((instance) => (
            <Link
              key={instance.instanceId}
              href={`egConfigurator/${instance.instanceId}`}
              className="group block bg-surface border border-border rounded-xl p-5 hover:bg-surface-hover hover:border-accent-blue transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-text-primary group-hover:text-accent-blue transition-colors">
                    {instance.plantName}
                  </p>
                  <p className="text-sm text-text-secondary mt-0.5">
                    {instance.plantType} · Instance ID:{' '}
                    <span className="font-mono">{instance.instanceId}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${instance.status === 'published'
                      ? 'bg-accent-green/10 text-accent-green'
                      : 'bg-accent-yellow/10 text-accent-yellow'
                      }`}
                  >
                    {instance.status === 'published' ? 'submitted' : instance.status}
                  </span>
                  <span className="text-text-secondary group-hover:text-accent-blue transition-colors">
                    →
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-blue rounded-full transition-all"
                    style={{
                      width: `${Math.round(((instance.currentStep - 1) / 4) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  Step {instance.currentStep} of 5
                </p>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-xs text-text-secondary mt-6 text-center">
          These instances are defined in{' '}
          <code className="font-mono">src/app/egConfigurator/mock/MockData.ts</code>
        </p>
      </div>
    </div>
  );
}
