import { Injectable } from "@nestjs/common";
import { MissingDataFlag, OptimizationTarget } from "../../generated-contracts/enums";
import { FEASIBILITY_V0_DEFAULTS, FEASIBILITY_V0_WARNINGS } from "./feasibility.defaults";
import type { FeasibilityEngineInput, FeasibilityEngineOutput } from "./feasibility.types";

@Injectable()
export class FeasibilityEngineV0Service {
  readonly heuristicVersion = "feasibility-v0-heuristic";

  execute(input: FeasibilityEngineInput): FeasibilityEngineOutput {
    const warnings = FEASIBILITY_V0_WARNINGS.map((warning) => ({ ...warning }));
    const defaults = FEASIBILITY_V0_DEFAULTS;
    const missingDataFlags: MissingDataFlag[] = [];

    if (!input.planning.buildableWindowAreaSqm) missingDataFlags.push(MissingDataFlag.BUILDABLE_WINDOW);
    if (!input.planning.grz) missingDataFlags.push(MissingDataFlag.GRZ);
    if (!input.planning.gfz) missingDataFlags.push(MissingDataFlag.GFZ);
    if (!input.avgUnitSizeSqm) missingDataFlags.push(MissingDataFlag.AVG_UNIT_SIZE_SQM);
    if (!input.hardCostPerBgfSqm) missingDataFlags.push(MissingDataFlag.HARD_COST_PER_BGF_SQM);
    if (!input.fundingStack.length) missingDataFlags.push(MissingDataFlag.FUNDING_STACK);

    const effectiveFloors = input.planning.maxFloors && input.planning.maxHeightM
      ? Math.min(input.planning.maxFloors, Math.floor(input.planning.maxHeightM / defaults.floorToFloorMeters))
      : input.planning.maxFloors ?? (
        input.planning.maxHeightM
          ? Math.floor(input.planning.maxHeightM / defaults.floorToFloorMeters)
          : defaults.fallbackEffectiveFloors
      );

    const buildableFootprintSqm = input.planning.buildableWindowAreaSqm
      ? Math.min(
          input.planning.buildableWindowAreaSqm,
          input.planning.grz ? input.planning.parcelAreaSqm * input.planning.grz : input.planning.buildableWindowAreaSqm,
        )
      : input.planning.grz
        ? input.planning.parcelAreaSqm * input.planning.grz
        : input.planning.parcelAreaSqm * defaults.fallbackParcelFootprintShare;

    const buildableBgfSqm = Math.min(
      input.planning.gfz ? input.planning.parcelAreaSqm * input.planning.gfz : Number.POSITIVE_INFINITY,
      buildableFootprintSqm * effectiveFloors,
      input.planning.maxBgfSqm ?? Number.POSITIVE_INFINITY,
    );

    const nlaEstimateSqm = buildableBgfSqm * defaults.nlaEfficiencyFactor;
    const estimatedUnitCount = input.avgUnitSizeSqm ? Math.floor(nlaEstimateSqm / input.avgUnitSizeSqm) : null;
    const requiredParkingSpaces = estimatedUnitCount
      ? Math.ceil(estimatedUnitCount * (input.planning.parkingSpacesPerUnit ?? defaults.defaultParkingSpacesPerUnit))
      : null;
    const hardCost = input.hardCostPerBgfSqm ? buildableBgfSqm * input.hardCostPerBgfSqm : null;
    const softCost = hardCost ? hardCost * (input.softCostPct ?? defaults.defaultSoftCostPct) : null;
    const parkingCost = requiredParkingSpaces
      ? requiredParkingSpaces * (input.parkingCostPerSpace ?? defaults.defaultParkingCostPerSpace)
      : null;
    const totalDevelopmentCost = [input.landCost ?? 0, hardCost ?? 0, softCost ?? 0, parkingCost ?? 0].reduce((a, b) => a + b, 0);

    let remaining = totalDevelopmentCost;
    let stateSubsidyAmount = 0;
    let kfwAmount = 0;
    let freeFinancingAmount = 0;

    for (const item of [...input.fundingStack].filter((x) => x.isEnabled).sort((a, b) => a.stackOrder - b.stackOrder)) {
      const caps = [
        item.amountOverride ?? null,
        item.sharePctOverride ? totalDevelopmentCost * item.sharePctOverride : null,
        item.maxLoanPct ? totalDevelopmentCost * item.maxLoanPct : null,
        item.maxLoanPerSqm ? buildableBgfSqm * item.maxLoanPerSqm : null,
        remaining,
      ].filter((value): value is number => typeof value === "number");

      const amount = caps.length ? Math.min(...caps) : 0;
      if (item.financingSourceType === "STATE_SUBSIDY") stateSubsidyAmount += amount;
      if (item.financingSourceType === "KFW") kfwAmount += amount;
      if (item.financingSourceType === "FREE_FINANCING") freeFinancingAmount += amount;
      remaining -= amount;
    }

    const requiredEquity = Math.max(0, remaining);
    const breakEvenRentEurSqm = nlaEstimateSqm
      ? totalDevelopmentCost / (nlaEstimateSqm * defaults.monthsPerYear * defaults.breakEvenYears)
      : null;
    const breakEvenSalesPriceEurSqm = nlaEstimateSqm ? totalDevelopmentCost / nlaEstimateSqm : null;
    const subsidyAdjustedBreakEvenRentEurSqm = nlaEstimateSqm
      ? (
        totalDevelopmentCost -
        stateSubsidyAmount -
        kfwAmount * defaults.kfwSubsidyEquivalentFactor
      ) / (nlaEstimateSqm * defaults.monthsPerYear * defaults.breakEvenYears)
      : null;

    const inputConfidencePct = Math.max(25, 100 - missingDataFlags.length * 8);
    const outputConfidencePct = Math.max(20, inputConfidencePct - warnings.length * 2);

    return {
      heuristicVersion: this.heuristicVersion,
      warnings,
      missingDataFlags,
      confidence: {
        inputConfidencePct,
        outputConfidencePct,
        reasons: [
          "Derived from missing-data count and heuristic fallback usage.",
          "v0 outputs are explicitly heuristic and replaceable.",
        ],
      },
      outputs: {
        buildableFootprintSqm,
        buildableBgfSqm,
        effectiveFloors,
        estimatedUnitCount,
        requiredParkingSpaces,
        hardCost,
        softCost,
        parkingCost,
        totalDevelopmentCost,
        freeFinancingAmount,
        stateSubsidyAmount,
        kfwAmount,
        grantAmount: 0,
        equityAmount: requiredEquity,
        requiredEquity,
        breakEvenRentEurSqm,
        breakEvenSalesPriceEurSqm,
        subsidyAdjustedBreakEvenRentEurSqm,
        subsidyAdjustedProfitPct: null,
        subsidyAdjustedIrrPct: null,
        objectiveValue: this.pickObjective(input.optimizationTarget, {
          breakEvenRentEurSqm,
          breakEvenSalesPriceEurSqm,
          requiredEquity,
          subsidyAdjustedIrrPct: null,
          estimatedUnitCount,
        }),
      },
      explanation: {
        heuristicVersion: this.heuristicVersion,
        summary:
          "This v0 result estimates buildable area, parking, capital stack allocation, and break-even metrics from parcel area, planning limits, and selected funding inputs using replaceable heuristics.",
        dominantDrivers: [
          "Parcel area and GRZ/buildable window drive footprint.",
          "GFZ, max BGF, and effective floor count cap total buildable BGF.",
          "Hard cost per BGF sqm and land cost dominate total development cost.",
          "Funding stack order allocates state subsidy, then KfW, then free financing, then residual equity.",
        ],
        fallbackAssumptions: warnings.map((warning) => warning.message),
        capitalStackNarrative: [
          `State subsidy allocated first: ${stateSubsidyAmount.toFixed(2)}`,
          `KfW allocated second: ${kfwAmount.toFixed(2)}`,
          `Free financing allocated third: ${freeFinancingAmount.toFixed(2)}`,
          `Residual equity allocated last: ${requiredEquity.toFixed(2)}`,
        ],
      },
    };
  }

  private pickObjective(
    target: OptimizationTarget,
    outputs: {
      breakEvenRentEurSqm: number | null;
      breakEvenSalesPriceEurSqm: number | null;
      requiredEquity: number | null;
      subsidyAdjustedIrrPct: number | null;
      estimatedUnitCount: number | null;
    },
  ) {
    switch (target) {
      case OptimizationTarget.MIN_BREAK_EVEN_RENT:
        return outputs.breakEvenRentEurSqm;
      case OptimizationTarget.MIN_BREAK_EVEN_SALES_PRICE:
        return outputs.breakEvenSalesPriceEurSqm;
      case OptimizationTarget.MIN_REQUIRED_EQUITY:
        return outputs.requiredEquity;
      case OptimizationTarget.MAX_SUBSIDY_ADJUSTED_IRR:
        return outputs.subsidyAdjustedIrrPct;
      case OptimizationTarget.MAX_UNIT_COUNT:
        return outputs.estimatedUnitCount;
      default:
        return null;
    }
  }
}
