-- AlterTable
ALTER TABLE "Parcel"
ADD COLUMN "parcelGroupId" TEXT,
ADD COLUMN "isGroupSite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceProviderName" TEXT,
ADD COLUMN "sourceProviderParcelId" TEXT,
ADD COLUMN "provenanceJson" JSONB;

-- CreateTable
CREATE TABLE "ParcelGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "landAreaSqm" DECIMAL(65,30),
    "sourceType" "SourceType" NOT NULL,
    "sourceReference" TEXT,
    "sourceProviderName" TEXT,
    "confidenceScore" INTEGER,
    "geom" JSONB,
    "centroid" JSONB,
    "provenanceJson" JSONB,
    "siteParcelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelGroup_pkey" PRIMARY KEY ("id")
);

-- Backfill existing parcels with baseline provenance
UPDATE "Parcel"
SET "provenanceJson" = jsonb_build_object(
    'providerName', NULL,
    'providerParcelId', NULL,
    'trustMode', CASE
        WHEN "sourceType" IN ('USER_INPUT', 'MANUAL_OVERRIDE') THEN 'MANUAL_FALLBACK'
        WHEN "sourceType" = 'SYSTEM_DERIVED' THEN 'GROUP_DERIVED'
        WHEN "geom" IS NOT NULL AND "landAreaSqm" IS NOT NULL THEN 'SOURCE_PRIMARY'
        ELSE 'SOURCE_INCOMPLETE'
    END,
    'geometryDerived', ("geom" IS NOT NULL),
    'areaDerived', ("landAreaSqm" IS NOT NULL),
    'rawMetadata', NULL
)
WHERE "provenanceJson" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ParcelGroup_siteParcelId_key" ON "ParcelGroup"("siteParcelId");

-- CreateIndex
CREATE INDEX "Parcel_parcelGroupId_idx" ON "Parcel"("parcelGroupId");

-- CreateIndex
CREATE INDEX "Parcel_sourceProviderName_sourceProviderParcelId_idx" ON "Parcel"("sourceProviderName", "sourceProviderParcelId");

-- CreateIndex
CREATE INDEX "PlanningParameter_parcelGroupId_idx" ON "PlanningParameter"("parcelGroupId");

-- CreateIndex
CREATE INDEX "Scenario_parcelGroupId_idx" ON "Scenario"("parcelGroupId");

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_parcelGroupId_fkey" FOREIGN KEY ("parcelGroupId") REFERENCES "ParcelGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelGroup" ADD CONSTRAINT "ParcelGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelGroup" ADD CONSTRAINT "ParcelGroup_siteParcelId_fkey" FOREIGN KEY ("siteParcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningParameter" ADD CONSTRAINT "PlanningParameter_parcelGroupId_fkey" FOREIGN KEY ("parcelGroupId") REFERENCES "ParcelGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_parcelGroupId_fkey" FOREIGN KEY ("parcelGroupId") REFERENCES "ParcelGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
