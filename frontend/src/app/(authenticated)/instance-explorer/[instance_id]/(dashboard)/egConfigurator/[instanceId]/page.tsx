/**
 * Wizard page — server component.
 *
 * Fetches the instance context (plant name, current step, saved config) then
 * hands off to the client-side WizardShell which owns the interactive state.
 *
 * This page is the ONLY entry point in integrated mode — the main product UI
 * navigates here directly with the correct instanceId.
 *
 * Query params accepted:
 *   ?plantName=Yansab%20EG%20Plant   — display name shown in the wizard header.
 *                                       The main product should always pass this.
 *                                       Falls back to the raw instanceId if omitted.
 */

import { notFound } from 'next/navigation';
import { getInstanceContext } from '../actions/Actions';
import WizardShell from './components/WizardShell';

interface PageProps {
  params: Promise<{ instanceId: string }>;
  searchParams: Promise<{ plantName?: string }>;
}

export default async function WizardPage({ params, searchParams }: PageProps) {
  const { instanceId } = await params;
  const { plantName } = await searchParams;

  const result = await getInstanceContext(instanceId);

  if (!result.success || !result.data) {
    notFound();
  }

  // Allow the calling product to pass the human-readable plant name as a
  // query param. This avoids a second DB lookup and keeps the action stateless.
  const context = plantName
    ? { ...result.data, plantName: decodeURIComponent(plantName) }
    : result.data;

  return <WizardShell initialContext={context} />;
}
