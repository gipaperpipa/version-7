-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "anchorParcelId" TEXT NOT NULL,
    "anchorParcelGroupId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationId_anchorParcelId_key" ON "Project"("organizationId", "anchorParcelId");

-- CreateIndex
CREATE INDEX "Project_organizationId_status_idx" ON "Project"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Project_organizationId_anchorParcelGroupId_idx" ON "Project"("organizationId", "anchorParcelGroupId");

-- Seed projects for existing scenario anchors so current scenario work remains governable.
WITH "scenario_anchors" AS (
    SELECT DISTINCT
        s."organizationId",
        CASE
            WHEN p."parcelGroupId" IS NOT NULL AND p."isGroupSite" = false
                THEN COALESCE(pg."siteParcelId", s."parcelId")
            ELSE s."parcelId"
        END AS "anchorParcelId",
        CASE
            WHEN p."parcelGroupId" IS NOT NULL AND p."isGroupSite" = false
                THEN p."parcelGroupId"
            ELSE COALESCE(s."parcelGroupId", p."parcelGroupId")
        END AS "anchorParcelGroupId"
    FROM "Scenario" s
    INNER JOIN "Parcel" p ON p."id" = s."parcelId"
    LEFT JOIN "ParcelGroup" pg ON pg."id" = p."parcelGroupId"
    WHERE s."parcelId" IS NOT NULL
),
"project_candidates" AS (
    SELECT
        sa."organizationId",
        sa."anchorParcelId",
        sa."anchorParcelGroupId",
        ap."isGroupSite",
        ap."name",
        ap."cadastralId",
        ap."addressLine1",
        ap."municipalityName",
        ap."city"
    FROM "scenario_anchors" sa
    INNER JOIN "Parcel" ap ON ap."id" = sa."anchorParcelId"
)
INSERT INTO "Project" (
    "id",
    "organizationId",
    "anchorParcelId",
    "anchorParcelGroupId",
    "name",
    "description",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('prj_', SUBSTRING(MD5(CONCAT(pc."organizationId", ':', pc."anchorParcelId")) FROM 1 FOR 24)),
    pc."organizationId",
    pc."anchorParcelId",
    pc."anchorParcelGroupId",
    CASE
        WHEN pc."isGroupSite" = true
            THEN COALESCE(pc."name", pc."cadastralId", pc."addressLine1", pc."municipalityName", pc."city", 'Untitled site')
        ELSE CONCAT(COALESCE(pc."name", pc."cadastralId", pc."addressLine1", pc."municipalityName", pc."city", 'Untitled site'), ' project')
    END,
    NULL,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "project_candidates" pc
ON CONFLICT ("organizationId", "anchorParcelId") DO NOTHING;

-- Link existing scenarios to their backfilled or reused projects.
WITH "scenario_project_map" AS (
    SELECT
        s."id" AS "scenarioId",
        pjt."id" AS "projectId"
    FROM "Scenario" s
    INNER JOIN "Parcel" p ON p."id" = s."parcelId"
    LEFT JOIN "ParcelGroup" pg ON pg."id" = p."parcelGroupId"
    INNER JOIN "Project" pjt
        ON pjt."organizationId" = s."organizationId"
        AND pjt."anchorParcelId" = CASE
            WHEN p."parcelGroupId" IS NOT NULL AND p."isGroupSite" = false
                THEN COALESCE(pg."siteParcelId", s."parcelId")
            ELSE s."parcelId"
        END
    WHERE s."parcelId" IS NOT NULL
)
UPDATE "Scenario" s
SET "projectId" = spm."projectId"
FROM "scenario_project_map" spm
WHERE s."id" = spm."scenarioId";

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_anchorParcelId_fkey" FOREIGN KEY ("anchorParcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
