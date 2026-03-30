import { Injectable } from "@nestjs/common";
import { CORE_PLANNING_KEY_SLUGS } from "../../generated-contracts/planning-keys";
import { toApiJson } from "../../common/prisma/api-mappers";
import type {
  FeasibilityEngineInput,
  ScenarioSnapshotInput,
} from "../finance/feasibility.types";
import type { ScenarioForValidation } from "./scenario.types";
import {
  extractScenarioAssumptionSet,
  getEffectiveScenarioAssumptions,
} from "./scenario-assumptions";

@Injectable()
export class ScenarioInputBuilderService {
  buildSnapshot(scenario: ScenarioForValidation): ScenarioSnapshotInput {
    const assumptionSet = extractScenarioAssumptionSet(toApiJson<Record<string, unknown>>(scenario.inputsJson));
    const overrideCount = Object.values(assumptionSet?.overrides ?? {}).filter((value) => value !== null).length;

    return {
      scenarioId: scenario.id,
      strategyType: scenario.strategyType,
      acquisitionType: scenario.acquisitionType,
      optimizationTarget: scenario.optimizationTarget,
      parcelId: scenario.parcelId,
      strategyMixJson: toApiJson<Record<string, unknown>>(scenario.strategyMixJson),
      assumptionSet: {
        profileKey: assumptionSet?.profileKey ?? "BASELINE",
        notes: assumptionSet?.notes ?? null,
        overrideCount,
      },
      fundingVariants: scenario.fundingVariants.map((item) => ({
        id: item.id,
        label: item.label,
        financingSourceType: item.financingSourceType,
        stackOrder: item.stackOrder,
        isEnabled: item.isEnabled,
        fundingProgramVariantId: item.fundingProgramVariantId,
      })),
    };
  }

  buildFeasibilityInput(scenario: ScenarioForValidation): FeasibilityEngineInput {
    const params = scenario.parcel?.planningParameters ?? [];
    const getNumber = (slug: string) => {
      const item = params.find((parameter) => parameter.keySlug === slug);
      return item?.valueNumber ? Number(item.valueNumber.toString()) : undefined;
    };
    const getBoolean = (slug: string) => {
      const item = params.find((parameter) => parameter.keySlug === slug);
      return item?.valueBoolean ?? undefined;
    };
    const effectiveAssumptions = getEffectiveScenarioAssumptions(
      extractScenarioAssumptionSet(toApiJson<Record<string, unknown>>(scenario.inputsJson)),
    );

    return {
      organizationId: scenario.organizationId,
      scenarioId: scenario.id,
      strategyType: scenario.strategyType,
      optimizationTarget: scenario.optimizationTarget,
      avgUnitSizeSqm: scenario.avgUnitSizeSqm ? Number(scenario.avgUnitSizeSqm.toString()) : undefined,
      targetMarketRentEurSqm: scenario.targetMarketRentEurSqm ? Number(scenario.targetMarketRentEurSqm.toString()) : undefined,
      targetSubsidizedRentEurSqm: scenario.targetSubsidizedRentEurSqm ? Number(scenario.targetSubsidizedRentEurSqm.toString()) : undefined,
      targetSalesPriceEurSqm: scenario.targetSalesPriceEurSqm ? Number(scenario.targetSalesPriceEurSqm.toString()) : undefined,
      subsidizedSharePct: scenario.subsidizedSharePct ? Number(scenario.subsidizedSharePct.toString()) : undefined,
      hardCostPerBgfSqm: scenario.hardCostPerBgfSqm ? Number(scenario.hardCostPerBgfSqm.toString()) : undefined,
      softCostPct: scenario.softCostPct ? Number(scenario.softCostPct.toString()) : undefined,
      parkingCostPerSpace: scenario.parkingCostPerSpace ? Number(scenario.parkingCostPerSpace.toString()) : undefined,
      landCost: scenario.landCost ? Number(scenario.landCost.toString()) : undefined,
      equityTargetPct: scenario.equityTargetPct ? Number(scenario.equityTargetPct.toString()) : undefined,
      assumptions: {
        profileKey: effectiveAssumptions.profileKey,
        planningBufferPct: Number(effectiveAssumptions.planningBufferPct),
        efficiencyFactorPct: Number(effectiveAssumptions.efficiencyFactorPct),
        vacancyPct: Number(effectiveAssumptions.vacancyPct),
        operatingCostPerNlaSqmYear: Number(effectiveAssumptions.operatingCostPerNlaSqmYear),
        acquisitionClosingCostPct: Number(effectiveAssumptions.acquisitionClosingCostPct),
        contingencyPct: Number(effectiveAssumptions.contingencyPct),
        developerFeePct: Number(effectiveAssumptions.developerFeePct),
        targetProfitPct: Number(effectiveAssumptions.targetProfitPct),
        exitCapRatePct: Number(effectiveAssumptions.exitCapRatePct),
        salesClosingCostPct: Number(effectiveAssumptions.salesClosingCostPct),
        salesAbsorptionMonths: effectiveAssumptions.salesAbsorptionMonths ?? 12,
        parkingRevenuePerSpaceMonth: Number(effectiveAssumptions.parkingRevenuePerSpaceMonth),
        parkingSalePricePerSpace: Number(effectiveAssumptions.parkingSalePricePerSpace),
      },
      planning: {
        parcelAreaSqm: scenario.parcel?.landAreaSqm ? Number(scenario.parcel.landAreaSqm.toString()) : 0,
        grz: getNumber(CORE_PLANNING_KEY_SLUGS.GRZ),
        gfz: getNumber(CORE_PLANNING_KEY_SLUGS.GFZ),
        maxBgfSqm: getNumber(CORE_PLANNING_KEY_SLUGS.MAX_BGF_SQM),
        maxHeightM: getNumber(CORE_PLANNING_KEY_SLUGS.MAX_HEIGHT_M),
        maxFloors: getNumber(CORE_PLANNING_KEY_SLUGS.MAX_FLOORS),
        maxUnits: getNumber(CORE_PLANNING_KEY_SLUGS.MAX_UNITS),
        parkingSpacesPerUnit: getNumber(CORE_PLANNING_KEY_SLUGS.PARKING_SPACES_PER_UNIT),
        buildableWindowAreaSqm: getNumber(CORE_PLANNING_KEY_SLUGS.BUILDABLE_WINDOW),
        rentCapEurSqm: getNumber(CORE_PLANNING_KEY_SLUGS.RENT_CAP_EUR_SQM),
        subsidyEligibility: getBoolean(CORE_PLANNING_KEY_SLUGS.SUBSIDY_ELIGIBILITY),
        loanCapPct: getNumber(CORE_PLANNING_KEY_SLUGS.LOAN_CAP_PCT),
      },
      fundingStack: scenario.fundingVariants.map((item) => ({
        id: item.id,
        label: item.label,
        financingSourceType: item.financingSourceType,
        stackOrder: item.stackOrder,
        isEnabled: item.isEnabled,
        amountOverride: item.amountOverride ? Number(item.amountOverride.toString()) : undefined,
        sharePctOverride: item.sharePctOverride ? Number(item.sharePctOverride.toString()) : undefined,
        interestRatePct: item.interestRateOverridePct
          ? Number(item.interestRateOverridePct.toString())
          : item.fundingProgramVariant?.interestRatePct
            ? Number(item.fundingProgramVariant.interestRatePct.toString())
            : undefined,
        termMonths: item.termMonthsOverride ?? item.fundingProgramVariant?.termMonths ?? undefined,
        maxLoanPct: item.fundingProgramVariant?.maxLoanPct ? Number(item.fundingProgramVariant.maxLoanPct.toString()) : undefined,
        maxLoanPerSqm: item.fundingProgramVariant?.maxLoanPerSqm ? Number(item.fundingProgramVariant.maxLoanPerSqm.toString()) : undefined,
        rentCapEurSqm: item.fundingProgramVariant?.rentCapEurSqm ? Number(item.fundingProgramVariant.rentCapEurSqm.toString()) : undefined,
        loanCapPct: item.fundingProgramVariant?.loanCapPct ? Number(item.fundingProgramVariant.loanCapPct.toString()) : undefined,
        subsidyEligibleSharePct: item.fundingProgramVariant?.subsidyEligibleSharePct
          ? Number(item.fundingProgramVariant.subsidyEligibleSharePct.toString())
          : undefined,
        allowsKfwCombination: item.fundingProgramVariant?.allowsKfwCombination ?? undefined,
      })),
    };
  }
}
