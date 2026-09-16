-- =====================================================================
-- Migration: add_api_tokens
-- Scope: configurations schema only
-- What changes:
--   1. CREATE api_tokens table (personal access tokens for historian API)
-- All other tables are NOT touched.
-- =====================================================================

-- CreateTable
CREATE TABLE "configurations"."api_tokens" (
    "token_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("token_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "configurations"."api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "api_tokens_user_id_idx" ON "configurations"."api_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "configurations"."api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "configurations"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
