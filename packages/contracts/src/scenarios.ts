import type { DecimalString, Id, IsoDateTime, PagedResponseDto } from "./common";
import type {
  AcquisitionType,
  AssumptionProfileKey,
  AssumptionTemplateScope,
  FinancingSourceType,
  OptimizationTarget,
  ScenarioGovernanceStatus,
  ScenarioReadinessStatus,
  ScenarioStatus,
  StrategyType,
} from "./enums";
import type { ScenarioRunDto } from "./feasibility";
import type { ScenarioReadinessDto } from "./readiness";

export interface ScenarioFundingVariantDto {
  id: Id;
  scenarioId: Id;
  fundingProgramVariantId: Id | null;
  label: string;
  financingSourceType: FinancingSourceType;
  stackOrder: number;
  isEnabled: boolean;
  amountOverride: DecimalString | null;
  sharePctOverride: DecimalString | null;
  interestRateOverridePct: DecimalString | null;
  termMonthsOverride: number | null;
  notes: string | null;
}

export interface ScenarioAssumptionOverridesDto {
  planningBufferPct: DecimalString | null;
  efficiencyFactorPct: DecimalString | null;
  vacancyPct: DecimalString | null;
  operatingCostPerNlaSqmYear: DecimalString | null;
  acquisitionClosingCostPct: DecimalString | null;
  contingencyPct: DecimalString | null;
  developerFeePct: DecimalString | null;
  targetProfitPct: DecimalString | null;
  exitCapRatePct: DecimalString | null;
  salesClosingCostPct: DecimalString | null;
  salesAbsorptionMonths: number | null;
  parkingRevenuePerSpaceMonth: DecimalString | null;
  parkingSalePricePerSpace: DecimalString | null;
}

export interface ScenarioAssumptionSetDto {
  profileKey: AssumptionProfileKey;
  templateKey: string | null;
  templateName: string | null;
  notes: string | null;
  overrides: ScenarioAssumptionOverridesDto;
}

export interface ScenarioAssumptionEffectiveDto extends ScenarioAssumptionOverridesDto {
  profileKey: AssumptionProfileKey;
}

export interface ScenarioAssumptionValueDetailDto {
  label: string;
  templateValue: DecimalString | number | null;
  overrideValue: DecimalString | number | null;
  effectiveValue: DecimalString | number | null;
  isOverridden: boolean;
}

export interface ScenarioAssumptionTemplateDto {
  key: string;
  name: string;
  description: string;
  scope: AssumptionTemplateScope;
  profileKey: AssumptionProfileKey;
  isWorkspaceDefault: boolean;
  defaults: ScenarioAssumptionEffectiveDto;
}

export interface ScenarioAssumptionSummaryDto {
  templateKey: string | null;
  templateName: string | null;
  templateScope: AssumptionTemplateScope | null;
  profileKey: AssumptionProfileKey;
  isWorkspaceDefault: boolean;
  overrideCount: number;
  effective: ScenarioAssumptionEffectiveDto;
  details: Record<string, ScenarioAssumptionValueDetailDto>;
}

export interface ScenarioReadinessSnapshotDto {
  status: ScenarioReadinessStatus;
  executionBlockers: number;
  confidenceBlockers: number;
  warningCount: number;
}

export interface ScenarioDto {
  id: Id;
  organizationId: Id;
  createdById: Id;
  parcelId: Id | null;
  parcelGroupId: Id | null;
  name: string;
  description: string | null;
  status: ScenarioStatus;
  governanceStatus: ScenarioGovernanceStatus;
  isCurrentBest: boolean;
  familyKey: string;
  familyVersion: number;
  strategyType: StrategyType;
  acquisitionType: AcquisitionType;
  optimizationTarget: OptimizationTarget;
  strategyMixJson: Record<string, unknown> | null;
  avgUnitSizeSqm: DecimalString | null;
  targetMarketRentEurSqm: DecimalString | null;
  targetSubsidizedRentEurSqm: DecimalString | null;
  targetSalesPriceEurSqm: DecimalString | null;
  subsidizedSharePct: DecimalString | null;
  hardCostPerBgfSqm: DecimalString | null;
  softCostPct: DecimalString | null;
  parkingCostPerSpace: DecimalString | null;
  landCost: DecimalString | null;
  equityTargetPct: DecimalString | null;
  assumptionSet: ScenarioAssumptionSetDto | null;
  assumptionSummary: ScenarioAssumptionSummaryDto;
  inputsJson: Record<string, unknown> | null;
  latestRunAt: IsoDateTime | null;
  readinessSnapshot: ScenarioReadinessSnapshotDto | null;
  fundingVariants: ScenarioFundingVariantDto[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreateScenarioRequestDto {
  parcelId?: Id | null;
  parcelGroupId?: Id | null;
  name: string;
  description?: string | null;
  strategyType: StrategyType;
  acquisitionType: AcquisitionType;
  optimizationTarget: OptimizationTarget;
  strategyMixJson?: Record<string, unknown> | null;
  avgUnitSizeSqm?: DecimalString | null;
  targetMarketRentEurSqm?: DecimalString | null;
  targetSubsidizedRentEurSqm?: DecimalString | null;
  targetSalesPriceEurSqm?: DecimalString | null;
  subsidizedSharePct?: DecimalString | null;
  hardCostPerBgfSqm?: DecimalString | null;
  softCostPct?: DecimalString | null;
  parkingCostPerSpace?: DecimalString | null;
  landCost?: DecimalString | null;
  equityTargetPct?: DecimalString | null;
  governanceStatus?: ScenarioGovernanceStatus;
  isCurrentBest?: boolean;
  assumptionSet?: ScenarioAssumptionSetDto | null;
  inputsJson?: Record<string, unknown> | null;
}

export interface UpdateScenarioRequestDto extends Partial<CreateScenarioRequestDto> {
  status?: ScenarioStatus;
}

export interface UpsertScenarioFundingStackRequestDto {
  items: Array<{
    fundingProgramVariantId?: Id | null;
    label: string;
    financingSourceType: FinancingSourceType;
    stackOrder: number;
    isEnabled?: boolean;
    amountOverride?: DecimalString | null;
    sharePctOverride?: DecimalString | null;
    interestRateOverridePct?: DecimalString | null;
    termMonthsOverride?: number | null;
    notes?: string | null;
  }>;
}

export interface ScenarioComparisonParcelDto {
  id: Id;
  name: string | null;
  cadastralId: string | null;
  municipalityName: string | null;
  landAreaSqm: DecimalString | null;
  confidenceScore: number | null;
  sourceType: string;
}

export interface ScenarioComparisonEntryDto {
  scenario: ScenarioDto;
  parcel: ScenarioComparisonParcelDto | null;
  readiness: ScenarioReadinessDto;
  latestRun: ScenarioRunDto | null;
  rank: number | null;
  objectiveValue: DecimalString | null;
  deltaToLeader: DecimalString | null;
  warningCount: number;
  blockerCount: number;
  missingDataCount: number;
  topDrivers: string[];
  assumptionSummary: string;
  recommendation: string;
}

export interface ScenarioComparisonResponseDto {
  rankingTarget: OptimizationTarget;
  objectiveDirection: "min" | "max";
  mixedOptimizationTargets: boolean;
  leaderScenarioId: Id | null;
  entries: ScenarioComparisonEntryDto[];
}

export type ListScenariosResponseDto = PagedResponseDto<ScenarioDto>;
export interface ListScenarioAssumptionTemplatesResponseDto {
  items: ScenarioAssumptionTemplateDto[];
  workspaceDefaultTemplateKey: string | null;
  workspaceDefaultTemplateName: string | null;
}

export interface UpdateScenarioWorkspaceDefaultsRequestDto {
  defaultTemplateKey: string | null;
}
