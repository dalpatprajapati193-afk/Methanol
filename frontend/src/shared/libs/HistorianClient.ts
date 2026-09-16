/**
 * Server-to-server client for the separate "historian" FastAPI service.
 *
 * The historian is never published; it is reachable only on the internal docker
 * network and trusts identity headers from the gateway. For BFF calls we bypass
 * Caddy and talk to it directly, so this client sets the same identity + gateway
 * secret headers that Caddy would inject after forward_auth.
 *
 * Distinct from FastApiClient.ts (the in-repo `services/` API). Server-only.
 */
import { auth } from "@/auth";

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function fetchHistorian<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeoutMs = 30000, ...fetchOptions } = options;

  const baseUrl = process.env.HISTORIAN_INTERNAL_URL;
  if (!baseUrl) {
    throw new Error("HISTORIAN_INTERNAL_URL environment variable is missing.");
  }
  const gatewaySecret = process.env.HISTORIAN_GATEWAY_SECRET;
  if (!gatewaySecret) {
    throw new Error("HISTORIAN_GATEWAY_SECRET environment variable is missing.");
  }

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Cannot call historian without an authenticated session.");
  }

  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Secret": gatewaySecret,
        "X-Auth-User-Id": session.user.id,
        "X-Auth-User-Email": session.user.email ?? "",
        "X-Auth-User-Name": session.user.name ?? "",
        ...fetchOptions.headers,
      },
    });

    clearTimeout(id);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Historian Error ${response.status}: ${errorText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Historian Request Timeout after ${timeoutMs}ms to ${endpoint}`);
    }
    throw error;
  }
}
