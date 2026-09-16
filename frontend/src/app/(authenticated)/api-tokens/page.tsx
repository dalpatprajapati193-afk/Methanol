import PageGuard from "@/shared/components/PageGuard";
import { listApiTokens } from "./actions/Actions";
import { ApiTokensManager } from "./components/ApiTokensManager";

export default async function ApiTokensPage() {
  const tokens = await listApiTokens();

  return (
    <PageGuard resourceId="/api-tokens">
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="mb-1 text-2xl font-bold text-text-primary">API Tokens</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Personal tokens for programmatic access to the historian API. Send them
          as <code className="text-accent-blue">Authorization: Bearer &lt;token&gt;</code>.
        </p>
        <ApiTokensManager initialTokens={tokens} />
      </div>
    </PageGuard>
  );
}
