import { NextRequest } from "next/server";
import { auth } from "@/auth";
import prisma from "@/shared/libs/Prisma";
import { hashApiToken } from "@/shared/utils/apiToken";
import { authorizeRequestPath } from "@/shared/libs/AccessControl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Refresh lastUsedAt at most this often to avoid a DB write per request.
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

interface Identity {
  id: string;
  email: string;
  name: string;
}

function ok(identity: Identity): Response {
  return new Response(null, {
    status: 200,
    headers: {
      "X-Auth-User-Id": identity.id,
      "X-Auth-User-Email": identity.email,
      "X-Auth-User-Name": identity.name,
    },
  });
}

const unauthorized = () => new Response(null, { status: 401 });
const forbidden = () => new Response(null, { status: 403 });

/**
 * Single verification authority for the historian gateway (Caddy forward_auth).
 *
 * Two-stage decision:
 *  1. AUTHENTICATE via the NextAuth session cookie OR a personal API token
 *     (Authorization: Bearer hist_…). Failure → 401.
 *  2. AUTHORIZE the identity against the originally-requested path (Caddy passes
 *     it as X-Forwarded-Uri) using the shared ACL. Failure → 403.
 *
 * On success returns identity headers that Caddy copies onto the upstream
 * request. On any non-2xx, Caddy relays this response to the client and never
 * reaches the upstream.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const requestPath = (request.headers.get("x-forwarded-uri") ?? "").split("?")[0];

  let userId: number | null = null;
  let identity: Identity | null = null;

  // 1a. Browser-direct / BFF: NextAuth session cookie.
  const session = await auth();
  if (session?.user?.id) {
    userId = parseInt(session.user.id, 10);
    identity = {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? "",
    };
  } else {
    // 1b. Programmatic clients (httpx/requests): personal API token.
    const authHeader = request.headers.get("authorization") ?? "";
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return unauthorized();
    }

    const apiToken = await prisma.apiToken.findUnique({
      where: { tokenHash: hashApiToken(token) },
      include: { user: true },
    });

    if (
      !apiToken ||
      apiToken.revokedAt !== null ||
      (apiToken.expiresAt !== null && apiToken.expiresAt <= new Date()) ||
      !apiToken.user.isActive
    ) {
      return unauthorized();
    }

    // Throttled best-effort last-used stamp; never block the auth decision on it.
    if (
      !apiToken.lastUsedAt ||
      Date.now() - apiToken.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS
    ) {
      prisma.apiToken
        .update({
          where: { tokenId: apiToken.tokenId },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});
    }

    userId = apiToken.userId;
    identity = {
      id: String(apiToken.userId),
      email: apiToken.user.userEmail,
      name: apiToken.user.userName,
    };
  }

  if (userId === null || Number.isNaN(userId) || !identity) {
    return unauthorized();
  }

  // 2. Authorize the authenticated identity against the requested path.
  const allowed = await authorizeRequestPath(userId, requestPath, "canRead");
  if (!allowed) {
    return forbidden();
  }

  return ok(identity);
}
