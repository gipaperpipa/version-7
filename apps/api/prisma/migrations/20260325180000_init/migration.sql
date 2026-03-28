-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLATFORM_ADMIN', 'ORG_OWNER', 'ORG_ADMIN', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('USER_INPUT', 'IMPORT', 'GIS_CADASTRE', 'PLANNING_DOCUMENT', 'THIRD_PARTY_API', 'SYSTEM_DERIVED', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('FREE_MARKET_RENTAL', 'SUBSIDIZED_RENTAL', 'STUDENT_HOUSING', 'BUILD_TO_SELL', 'MIXED_STRATEGY');

-- CreateEnum
CREATE TYPE "AcquisitionType" AS ENUM ('BUY', 'LEASE', 'OPTION');

-- CreateEnum
CREATE TYPE "OptimizationTarget" AS ENUM ('MIN_BREAK_EVEN_RENT', 'MIN_BREAK_EVEN_SALES_PRICE', 'MIN_REQUIRED_EQUITY', 'MAX_SUBSIDY_ADJUSTED_IRR', 'MAX_UNIT_COUNT');

-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('DRAFT', 'READY', 'RUNNING', 'COMPLETED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScenarioRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScenarioReadinessStatus" AS ENUM ('READY', 'READY_WITH_WARNINGS', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PlanningParameterType" AS ENUM ('NUMBER', 'BOOLEAN', 'JSON', 'GEOMETRY');

-- CreateEnum
CREATE TYPE "PlanningParameterKey" AS ENUM ('GRZ', 'GFZ', 'MAX_BGF_SQM', 'MAX_HEIGHT_M', 'MAX_FLOORS', 'MAX_UNITS', 'BUILDABLE_WINDOW', 'PARKING_SPACES_PER_UNIT', 'SUBSIDY_ELIGIBILITY', 'RENT_CAP_EUR_SQM', 'LOAN_CAP_PCT');

-- CreateEnum
CREATE TYPE "FinancingSourceType" AS ENUM ('STATE_SUBSIDY', 'KFW', 'FREE_FINANCING', 'GRANT', 'EQUITY');

-- CreateEnum
CREATE TYPE "FundingProviderType" AS ENUM ('COMMERCIAL_BANK', 'STATE_SUBSIDY_BANK', 'KFW');

-- CreateEnum
CREATE TYPE "FundingCategory" AS ENUM ('FREE_LOAN', 'STATE_SUBSIDY_LOAN', 'KFW_LOAN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT,
    "cadastralId" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "stateCode" TEXT,
    "countryCode" TEXT DEFAULT 'DE',
    "municipalityName" TEXT,
    "districtName" TEXT,
    "landAreaSqm" DECIMAL(65,30),
    "sourceType" "SourceType" NOT NULL,
    "sourceReference" TEXT,
    "confidenceScore" INTEGER,
    "geom" JSONB,
    "centroid" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningParameter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parcelId" TEXT,
    "planningDocumentId" TEXT,
    "parcelGroupId" TEXT,
    "parameterKey" "PlanningParameterKey",
    "customKey" TEXT,
    "keyNamespace" TEXT NOT NULL,
    "keySlug" TEXT NOT NULL,
    "parameterType" "PlanningParameterType" NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "valueText" TEXT,
    "valueNumber" DECIMAL(65,30),
    "valueBoolean" BOOLEAN,
    "valueJson" JSONB,
    "geom" JSONB,
    "sourceType" "SourceType" NOT NULL,
    "sourceReference" TEXT,
    "confidenceScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingProgram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerType" "FundingProviderType" NOT NULL,
    "category" "FundingCategory" NOT NULL,
    "stateCode" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "sourceType" "SourceType" NOT NULL,
    "sourceReference" TEXT,
    "confidenceScore" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "FundingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingProgramVariant" (
    "id" TEXT NOT NULL,
    "fundingProgramId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "termMonths" INTEGER,
    "interestRatePct" DECIMAL(65,30),
    "maxLoanPct" DECIMAL(65,30),
    "maxLoanPerSqm" DECIMAL(65,30),
    "rentCapEurSqm" DECIMAL(65,30),
    "loanCapPct" DECIMAL(65,30),
    "subsidyEligibleSharePct" DECIMAL(65,30),
    "eligibleStrategyTypes" "StrategyType"[],
    "allowsKfwCombination" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "FundingProgramVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "parcelId" TEXT,
    "parcelGroupId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ScenarioStatus" NOT NULL DEFAULT 'DRAFT',
    "strategyType" "StrategyType" NOT NULL,
    "acquisitionType" "AcquisitionType" NOT NULL,
    "optimizationTarget" "OptimizationTarget" NOT NULL,
    "strategyMixJson" JSONB,
    "avgUnitSizeSqm" DECIMAL(65,30),
    "targetMarketRentEurSqm" DECIMAL(65,30),
    "targetSubsidizedRentEurSqm" DECIMAL(65,30),
    "targetSalesPriceEurSqm" DECIMAL(65,30),
    "subsidizedSharePct" DECIMAL(65,30),
    "hardCostPerBgfSqm" DECIMAL(65,30),
    "softCostPct" DECIMAL(65,30),
    "parkingCostPerSpace" DECIMAL(65,30),
    "landCost" DECIMAL(65,30),
    "equityTargetPct" DECIMAL(65,30),
    "inputsJson" JSONB,
    "latestRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioFundingVariant" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "fundingProgramVariantId" TEXT,
    "label" TEXT NOT NULL,
    "financingSourceType" "FinancingSourceType" NOT NULL,
    "stackOrder" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "amountOverride" DECIMAL(65,30),
    "sharePctOverride" DECIMAL(65,30),
    "interestRateOverridePct" DECIMAL(65,30),
    "termMonthsOverride" INTEGER,
    "notes" TEXT,

    CONSTRAINT "ScenarioFundingVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "triggeredById" TEXT,
    "status" "ScenarioRunStatus" NOT NULL,
    "readinessStatus" "ScenarioReadinessStatus",
    "readinessIssuesJson" JSONB,
    "queueJobId" TEXT,
    "engineVersion" TEXT,
    "inputSnapshot" JSONB,
    "warningsJson" JSONB,
    "missingDataFlagsJson" JSONB,
    "confidenceReasonsJson" JSONB,
    "inputConfidencePct" INTEGER,
    "outputConfidencePct" INTEGER,
    "errorMessage" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialResult" (
    "id" TEXT NOT NULL,
    "scenarioRunId" TEXT NOT NULL,
    "buildableFootprintSqm" DECIMAL(65,30),
    "buildableBgfSqm" DECIMAL(65,30),
    "effectiveFloors" INTEGER,
    "estimatedUnitCount" INTEGER,
    "requiredParkingSpaces" INTEGER,
    "hardCost" DECIMAL(65,30),
    "softCost" DECIMAL(65,30),
    "parkingCost" DECIMAL(65,30),
    "totalDevelopmentCost" DECIMAL(65,30),
    "freeFinancingAmount" DECIMAL(65,30),
    "stateSubsidyAmount" DECIMAL(65,30),
    "kfwAmount" DECIMAL(65,30),
    "grantAmount" DECIMAL(65,30),
    "equityAmount" DECIMAL(65,30),
    "requiredEquity" DECIMAL(65,30),
    "breakEvenRentEurSqm" DECIMAL(65,30),
    "breakEvenSalesPriceEurSqm" DECIMAL(65,30),
    "subsidyAdjustedBreakEvenRentEurSqm" DECIMAL(65,30),
    "subsidyAdjustedProfitPct" DECIMAL(65,30),
    "subsidyAdjustedIrrPct" DECIMAL(65,30),
    "warningsJson" JSONB,
    "missingDataFlagsJson" JSONB,
    "confidenceReasonsJson" JSONB,
    "outputConfidencePct" INTEGER,
    "outputsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FundingProgram_code_key" ON "FundingProgram"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FundingProgramVariant_code_key" ON "FundingProgramVariant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialResult_scenarioRunId_key" ON "FinancialResult"("scenarioRunId");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningParameter" ADD CONSTRAINT "PlanningParameter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningParameter" ADD CONSTRAINT "PlanningParameter_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingProgramVariant" ADD CONSTRAINT "FundingProgramVariant_fundingProgramId_fkey" FOREIGN KEY ("fundingProgramId") REFERENCES "FundingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioFundingVariant" ADD CONSTRAINT "ScenarioFundingVariant_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioFundingVariant" ADD CONSTRAINT "ScenarioFundingVariant_fundingProgramVariantId_fkey" FOREIGN KEY ("fundingProgramVariantId") REFERENCES "FundingProgramVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioRun" ADD CONSTRAINT "ScenarioRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioRun" ADD CONSTRAINT "ScenarioRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioRun" ADD CONSTRAINT "ScenarioRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialResult" ADD CONSTRAINT "FinancialResult_scenarioRunId_fkey" FOREIGN KEY ("scenarioRunId") REFERENCES "ScenarioRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
