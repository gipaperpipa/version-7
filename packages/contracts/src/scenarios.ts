import type { DecimalString, Id, IsoDateTime, PagedResponseDto } from "./common";
import type {
  AcquisitionType,
  FinancingSourceType,
  OptimizationTarget,
  ScenarioStatus,
  StrategyType,
} from "./enums";

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

export interface ScenarioDto {
  id: Id;
  organizationId: Id;
  createdById: Id;
  parcelId: Id | null;
  parcelGroupId: Id | null;
  name: string;
  description: string | null;
  status: ScenarioStatus;
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
  inputsJson: Record<string, unknown> | null;
  latestRunAt: IsoDateTime | null;
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

export type ListScenariosResponseDto = PagedResponseDto<ScenarioDto>;
