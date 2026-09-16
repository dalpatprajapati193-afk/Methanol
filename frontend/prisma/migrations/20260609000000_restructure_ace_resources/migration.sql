-- =====================================================================
-- Migration: restructure_ace_resources
-- Scope: product schema only
-- What changes:
--   1. DROP old access_control_entries (incompatible with new schema)
--   2. CREATE resources table
--   3. CREATE security_group_resource_mapping table
--   4. CREATE new access_control_entries table
-- All other tables (users, capabilities, instances, AF hierarchy, etc.)
-- are NOT touched.
-- =====================================================================

SET search_path TO product;

-- Step 1: Drop old ACE table (it had resource_id/resource_type/identity columns)
DROP TABLE IF EXISTS "product"."access_control_entries";

-- Step 2: Create resource registry
CREATE TABLE "product"."resources" (
    "resource_id"   SERIAL          NOT NULL,
    "title"         VARCHAR(100)    NOT NULL,
    "url"           VARCHAR(255),
    "description"   VARCHAR(500),
    "is_active"     BOOLEAN         NOT NULL DEFAULT true,
    "icon"          VARCHAR(50),
    "resource_type" VARCHAR(50)     NOT NULL,
    "resource_area" VARCHAR(50)     NOT NULL,
    "created_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("resource_id")
);

-- Step 3: Create many-to-many join table
CREATE TABLE "product"."security_group_resource_mapping" (
    "id"                  SERIAL          NOT NULL,
    "security_group_id"   INTEGER         NOT NULL,
    "resource_id"         INTEGER         NOT NULL,
    "created_at"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_group_resource_mapping_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one group can map to each resource only once
CREATE UNIQUE INDEX "security_group_resource_mapping_group_resource_key"
    ON "product"."security_group_resource_mapping"("security_group_id", "resource_id");

-- Foreign keys for mapping table
ALTER TABLE "product"."security_group_resource_mapping"
    ADD CONSTRAINT "security_group_resource_mapping_security_group_id_fkey"
    FOREIGN KEY ("security_group_id") REFERENCES "product"."security_groups"("group_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product"."security_group_resource_mapping"
    ADD CONSTRAINT "security_group_resource_mapping_resource_id_fkey"
    FOREIGN KEY ("resource_id") REFERENCES "product"."resources"("resource_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Create new ACE table (1:1 with mapping via unique mappingId)
CREATE TABLE "product"."access_control_entries" (
    "ace_id"                            SERIAL          NOT NULL,
    "security_group_resource_mapping_id" INTEGER        NOT NULL,
    "can_create"    BOOLEAN             NOT NULL DEFAULT false,
    "can_read"      BOOLEAN             NOT NULL DEFAULT true,
    "can_update"    BOOLEAN             NOT NULL DEFAULT false,
    "can_delete"    BOOLEAN             NOT NULL DEFAULT false,
    "is_allowed"    BOOLEAN             NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_control_entries_pkey" PRIMARY KEY ("ace_id")
);

-- Unique: one ACE per mapping
CREATE UNIQUE INDEX "access_control_entries_security_group_resource_mapping_id_key"
    ON "product"."access_control_entries"("security_group_resource_mapping_id");

-- Foreign key to mapping
ALTER TABLE "product"."access_control_entries"
    ADD CONSTRAINT "access_control_entries_security_group_resource_mapping_id_fkey"
    FOREIGN KEY ("security_group_resource_mapping_id")
    REFERENCES "product"."security_group_resource_mapping"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
