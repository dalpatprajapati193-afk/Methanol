/**
 * CGC Configuration — page.tsx (Server Component)
 *
 * Location:
 *   src/app/(authenticated)/instance-explorer/[instance_id]/(dashboard)/PEOlfCgc/page.tsx
 *
 * Follows the central-team onboarding template exactly:
 *   - async Server Component, no 'use client'
 *   - params is Promise<{ instance_id: string }> (Next.js 15)
 *   - all interactive work delegated to CgcConfigClient
 */

import CgcConfigClient from './components/CgcConfigClient';

export const metadata = { title: 'CGC Configuration — Ingenero360' };

type Props = { params: Promise<{ instance_id: string }> };

export default async function CgcConfigurationPage({ params }: Props) {
  const { instance_id } = await params;
  return <CgcConfigClient instanceId={instance_id} />;
}
