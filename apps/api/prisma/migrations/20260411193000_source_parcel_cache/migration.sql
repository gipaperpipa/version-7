-- CreateTable
CREATE TABLE "SourceParcelCache" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "sourceParcelId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerParcelId" TEXT NOT NULL,
    "sourceAuthority" TEXT NOT NULL,
    "bboxWest" DOUBLE PRECISION,
    "bboxSouth" DOUBLE PRECISION,
    "bboxEast" DOUBLE PRECISION,
    "bboxNorth" DOUBLE PRECISION,
    "recordJson" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceParcelCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceParcelCache_sourceParcelId_key" ON "SourceParcelCache"("sourceParcelId");

-- CreateIndex
CREATE INDEX "SourceParcelCache_providerKey_fetchedAt_idx" ON "SourceParcelCache"("providerKey", "fetchedAt");

-- CreateIndex
CREATE INDEX "SourceParcelCache_providerKey_providerParcelId_idx" ON "SourceParcelCache"("providerKey", "providerParcelId");
