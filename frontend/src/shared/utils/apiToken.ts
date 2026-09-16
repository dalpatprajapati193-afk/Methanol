import { randomBytes, createHash } from "crypto";

/** Prefix so tokens are recognizable in logs/UI and greppable by clients. */
export const API_TOKEN_PREFIX = "hist_";

/**
 * Generate a new opaque personal API token.
 * The plaintext is shown to the user exactly once; only the hash is persisted.
 */
export function generateApiToken(): { token: string; tokenHash: string } {
  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  return { token, tokenHash: hashApiToken(token) };
}

/** SHA-256 of the plaintext token. Stored at rest and used for lookup. */
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
