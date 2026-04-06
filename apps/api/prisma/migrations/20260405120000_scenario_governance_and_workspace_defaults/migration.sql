-- CreateEnum
CREATE TYPE "ScenarioGovernanceStatus" AS ENUM ('DRAFT', 'ACTIVE_CANDIDATE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN "defaultScenarioTemplateKey" TEXT;

-- AlterTable
ALTER TABLE "Scenario"
ADD COLUMN "governanceStatus" "ScenarioGovernanceStatus" NOT NULL DEFAULT 'ACTIVE_CANDIDATE',
ADD COLUMN "isCurrentBest" BOOLEAN NOT NULL DEFAULT false;
