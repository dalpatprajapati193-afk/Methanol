"use client";

import { useState, useTransition } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  createApiToken,
  revokeApiToken,
  type ApiTokenSummary,
} from "../actions/Actions";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EXPIRY_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

function statusOf(t: ApiTokenSummary): { label: string; className: string } {
  if (t.revokedAt) return { label: "Revoked", className: "text-accent-red" };
  if (t.expiresAt && new Date(t.expiresAt) <= new Date())
    return { label: "Expired", className: "text-accent-orange" };
  return { label: "Active", className: "text-accent-green" };
}

export function ApiTokensManager({
  initialTokens,
}: {
  initialTokens: ApiTokenSummary[];
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number>(90);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    setNewToken(null);
    startTransition(async () => {
      try {
        const { token } = await createApiToken({
          name: name.trim(),
          expiresInDays: expiresInDays === 0 ? null : expiresInDays,
        });
        setNewToken(token);
        setName("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create token");
      }
    });
  }

  function handleRevoke(tokenId: number) {
    startTransition(async () => {
      try {
        await revokeApiToken({ tokenId });
        setTokens((prev) =>
          prev.map((t) =>
            t.tokenId === tokenId
              ? { ...t, revokedAt: new Date().toISOString() }
              : t
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to revoke token");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-text-secondary">Token name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. data-pull-script"
              className="rounded-md border border-border bg-background px-3 py-2 text-text-primary outline-none focus:border-accent-blue"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">Expires</span>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-3 py-2 text-text-primary outline-none focus:border-accent-blue"
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={handleCreate}
            disabled={isPending || !name.trim()}
            className={cn(
              "rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-background",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            Generate token
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-accent-red">{error}</p>}

        {newToken && (
          <div className="mt-4 rounded-md border border-accent-red/40 bg-background p-3">
            <p className="mb-2 text-sm text-text-secondary">
              Copy this token now — it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-surface px-2 py-1 text-sm text-accent-red">
                {newToken}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(newToken)}
                className="rounded-md border border-border px-3 py-1 text-sm text-text-primary hover:bg-surface-hover"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-text-secondary">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Expires</th>
              <th className="px-4 py-2 font-medium">Last used</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-text-secondary"
                >
                  No tokens yet.
                </td>
              </tr>
            )}
            {tokens.map((t) => {
              const status = statusOf(t);
              const revocable = !t.revokedAt;
              return (
                <tr key={t.tokenId} className="border-t border-border">
                  <td className="px-4 py-2 text-text-primary">{t.name}</td>
                  <td className={cn("px-4 py-2", status.className)}>
                    {status.label}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">
                    {fmt(t.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">
                    {fmt(t.expiresAt)}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">
                    {fmt(t.lastUsedAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {revocable && (
                      <button
                        onClick={() => handleRevoke(t.tokenId)}
                        disabled={isPending}
                        className="text-accent-red hover:underline disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
