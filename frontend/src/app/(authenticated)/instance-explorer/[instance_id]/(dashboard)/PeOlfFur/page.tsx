import { z } from 'zod';
import prisma from '@/shared/libs/Prisma';
import JotaiProvider from './components/JotaiProvider';
import FurnaceApp from './components/FurnaceApp';

export const metadata = { title: 'Furnace Product App — Ingenero360' };

// instance_id arrives via the dynamic route segment ([instance_id]) — see
// documentation/02_instance_id_and_routing.md. It is user-editable and
// URL-sourced, so this async Server Component parses + validates it (positive int)
// and confirms the instance exists BEFORE rendering the app. An invalid id or an
// unknown instance renders the platform "Configuration Missing" guard instead of
// the mini-app. The interactive client shell still reads instance_id via
// useParams(); this page adds the server-side validation the contract requires.
const InstanceIdSchema = z.coerce.number().int().positive();

type Props = { params: Promise<{ instance_id: string }> };

function ConfigurationMissing({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-lg rounded-lg border border-border bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold text-text-primary">
          Configuration Missing — contact admin.
        </h1>
        <p className="mt-4 text-sm text-text-secondary">{message}</p>
      </div>
    </div>
  );
}

export default async function FurnaceProductAppPage({ params }: Props) {
  const { instance_id } = await params;

  const parsed = InstanceIdSchema.safeParse(instance_id);
  if (!parsed.success) {
    return <ConfigurationMissing message={`Invalid instance id "${instance_id}" in the URL.`} />;
  }

  // Server-rendered first paint (no extra round trip): confirm the instance exists.
  const info = await prisma.instance.findUnique({ where: { instanceId: parsed.data } });
  if (!info) {
    return <ConfigurationMissing message={`No instance #${instance_id} found for this capability.`} />;
  }

  return (
    <JotaiProvider>
      <div style={{ height: '100vh', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <FurnaceApp />
      </div>
    </JotaiProvider>
  );
}
