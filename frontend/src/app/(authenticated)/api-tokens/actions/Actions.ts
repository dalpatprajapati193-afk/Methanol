"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/shared/libs/Prisma";
import { generateApiToken } from "@/shared/utils/apiToken";

export interface ApiTokenSummary {
  tokenId: number;
  name: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

async function requireUserId(): Promise<number> {
  const session = await auth();
  const userId = parseInt(session?.user?.id || "0", 10);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  expiresInDays: z.number().int().positive().max(3650).nullable(),
});

export async function createApiToken(input: {
  name: string;
  expiresInDays: number | null;
}): Promise<{ token: string }> {
  const userId = await requireUserId();
  const { name, expiresInDays } = createSchema.parse(input);

  const { token, tokenHash } = generateApiToken();
  const expiresAt =
    expiresInDays === null
      ? null
      : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await prisma.apiToken.create({
    data: { userId, name, tokenHash, expiresAt },
  });

  revalidatePath("/api-tokens");
  // Plaintext returned exactly once; never persisted or retrievable again.
  return { token };
}

export async function listApiTokens(): Promise<ApiTokenSummary[]> {
  const userId = await requireUserId();
  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return tokens.map((t) => ({
    tokenId: t.tokenId,
    name: t.name,
    createdAt: t.createdAt.toISOString(),
    expiresAt: t.expiresAt?.toISOString() ?? null,
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    revokedAt: t.revokedAt?.toISOString() ?? null,
  }));
}

const revokeSchema = z.object({ tokenId: z.number().int().positive() });

export async function revokeApiToken(input: { tokenId: number }): Promise<void> {
  const userId = await requireUserId();
  const { tokenId } = revokeSchema.parse(input);

  // Scope by userId so a user can only revoke their own tokens.
  await prisma.apiToken.updateMany({
    where: { tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/api-tokens");
}
