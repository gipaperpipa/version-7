import { Injectable } from "@nestjs/common";
import { MissingDataFlag, OptimizationTarget, StrategyType } from "../../generated-contracts/enums";
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

    const rawBuildableFootprintSqm = input.planning.buildableWindowAreaSqm
      ? Math.min(
          input.planning.buildableWindowAreaSqm,
          input.planning.grz ? input.planning.parcelAreaSqm * input.planning.grz : input.planning.buildableWindowAreaSqm,
        )
      : input.planning.grz
        ? input.planning.parcelAreaSqm * input.planning.grz
        : input.planning.parcelAreaSqm * defaults.fallbackParcelFootprintShare;

    const rawBuildableBgfSqm = Math.min(
      input.planning.gfz ? input.planning.parcelAreaSqm * input.planning.gfz : Number.POSITIVE_INFINITY,
      rawBuildableFootprintSqm * effectiveFloors,
      input.planning.maxBgfSqm ?? Number.POSITIVE_INFINITY,
    );

    const planningAdjustedBgfSqm = rawBuildableBgfSqm * (1 - input.assumptions.planningBufferPct);
    const nlaEstimateSqm = planningAdjustedBgfSqm * input.assumptions.efficiencyFactorPct;
    const estimatedUnitCount = input.avgUnitSizeSqm ? Math.floor(nlaEstimateSqm / input.avgUnitSizeSqm) : null;
    const requiredParkingSpaces = estimatedUnitCount
      ? Math.ceil(estimatedUnitCount * (input.planning.parkingSpacesPerUnit ?? defaults.defaultParkingSpacesPerUnit))
      : null;

    const acquisitionCost = input.landCost ? input.landCost * input.assumptions.acquisitionClosingCostPct : null;
    const hardCost = input.hardCostPerBgfSqm ? planningAdjustedBgfSqm * input.hardCostPerBgfSqm : null;
    const softCost = hardCost ? hardCost * (input.softCostPct ?? defaults.defaultSoftCostPct) : null;
    const parkingCost = requiredParkingSpaces
      ? requiredParkingSpaces * (input.parkingCostPerSpace ?? defaults.defaultParkingCostPerSpace)
      : null;
    const contingencyCost = [hardCost ?? 0, softCost ?? 0, parkingCost ?? 0].reduce((sum, value) => sum + value, 0)
      * input.assumptions.contingencyPct;
    const developerFeeBase = [input.landCost ?? 0, acquisitionCost ?? 0, hardCost ?? 0, softCost ?? 0, parkingCost ?? 0, contingencyCost]
      .reduce((sum, value) => sum + value, 0);
    const developerFee = developerFeeBase * input.assumptions.developerFeePct;
    const totalDevelopmentCost = developerFeeBase + developerFee;
    const totalCapitalizedUses = totalDevelopmentCost * (1 + input.assumptions.targetProfitPct);

    let remaining = totalDevelopmentCost;
    let stateSubsidyAmount = 0;
    let kfwAmount = 0;
    let freeFinancingAmount = 0;
    let grantAmount = 0;

    for (const item of [...input.fundingStack].filter((x) => x.isEnabled).sort((a, b) => a.stackOrder - b.stackOrder)) {
      const caps = [
        item.amountOverride ?? null,
        item.sharePctOverride ? totalDevelopmentCost * item.sharePctOverride : null,
        item.maxLoanPct ? totalDevelopmentCost * item.maxLoanPct : null,
        item.maxLoanPerSqm ? planningAdjustedBgfSqm * item.maxLoanPerSqm : null,
        remaining,
      ].filter((value): value is number => typeof value === "number");

      const amount = caps.length ? Math.min(...caps) : 0;
      if (item.financingSourceType === "STATE_SUBSIDY") stateSubsidyAmount += amount;
      if (item.financingSourceType === "KFW") kfwAmount += amount;
      if (item.financingSourceType === "FREE_FINANCING") freeFinancingAmount += amount;
      if (item.financingSourceType === "GRANT") grantAmount += amount;
      remaining -= amount;
    }

    const requiredEquity = Math.max(0, remaining);
    const subsidyAdjustedUses = Math.max(
      0,
      totalCapitalizedUses - stateSubsidyAmount - grantAmount - kfwAmount * defaults.kfwSubsidyEquivalentFactor,
    );

    const grossResidentialRevenueAnnual = this.computeGrossResidentialRevenueAnnual(input, nlaEstimateSqm);
    const vacancyAdjustedRevenueAnnual = grossResidentialRevenueAnnual != null
      ? grossResidentialRevenueAnnual * (1 - input.assumptions.vacancyPct)
      : null;
    const operatingCostAnnual = nlaEstimateSqm ? nlaEstimateSqm * input.assumptions.operatingCostPerNlaSqmYear : null;
    const parkingRevenueAnnual = requiredParkingSpaces && input.strategyType !== StrategyType.BUILD_TO_SELL
      ? requiredParkingSpaces * input.assumptions.parkingRevenuePerSpaceMonth * defaults.monthsPerYear
      : null;
    const parkingSalesRevenue = requiredParkingSpaces && input.strategyType === StrategyType.BUILD_TO_SELL
      ? requiredParkingSpaces * input.assumptions.parkingSalePricePerSpace
      : null;
    const netOperatingIncomeAnnual = [vacancyAdjustedRevenueAnnual ?? 0, parkingRevenueAnnual ?? 0, -(operatingCostAnnual ?? 0)]
      .reduce((sum, value) => sum + value, 0);

    const grossSalesRevenue = input.targetSalesPriceEurSqm ? nlaEstimateSqm * input.targetSalesPriceEurSqm : null;
    const netSalesRevenue = grossSalesRevenue != null
      ? (grossSalesRevenue + (parkingSalesRevenue ?? 0)) * (1 - input.assumptions.salesClosingCostPct)
      : null;

    const effectiveRentableSqmMonths = nlaEstimateSqm
      ? nlaEstimateSqm * defaults.monthsPerYear * (1 - input.assumptions.vacancyPct)
      : null;
    const annualRecoveryNeeded = operatingCostAnnual != null
      ? totalCapitalizedUses / defaults.breakEvenYears + operatingCostAnnual - (parkingRevenueAnnual ?? 0)
      : null;
    const subsidyAdjustedAnnualRecoveryNeeded = operatingCostAnnual != null
      ? subsidyAdjustedUses / defaults.breakEvenYears + operatingCostAnnual - (parkingRevenueAnnual ?? 0)
      : null;

    const breakEvenRentEurSqm = annualRecoveryNeeded && effectiveRentableSqmMonths
      ? annualRecoveryNeeded / effectiveRentableSqmMonths
      : null;
    const subsidyAdjustedBreakEvenRentEurSqm = subsidyAdjustedAnnualRecoveryNeeded && effectiveRentableSqmMonths
      ? subsidyAdjustedAnnualRecoveryNeeded / effectiveRentableSqmMonths
      : null;
    const breakEvenSalesPriceEurSqm = grossSalesRevenue != null && nlaEstimateSqm
      ? (totalCapitalizedUses / (1 - input.assumptions.salesClosingCostPct) - (parkingSalesRevenue ?? 0)) / nlaEstimateSqm
      : null;

    const subsidyAdjustedProfitPct = this.computeSubsidyAdjustedProfitPct({
      input,
      subsidyAdjustedUses,
      netOperatingIncomeAnnual,
      netSalesRevenue,
    });
    const subsidyAdjustedIrrPct = this.computeSubsidyAdjustedIrrPct({
      input,
      subsidyAdjustedUses,
      netOperatingIncomeAnnual,
      netSalesRevenue,
    });

    const inputConfidencePct = Math.max(25, 100 - missingDataFlags.length * 8);
    const outputConfidencePct = Math.max(20, inputConfidencePct - warnings.length * 2);
    const objectiveValue = this.pickObjective(input.optimizationTarget, {
      breakEvenRentEurSqm,
      breakEvenSalesPriceEurSqm,
      requiredEquity,
      subsidyAdjustedIrrPct,
      estimatedUnitCount,
    });

    return {
      heuristicVersion: this.heuristicVersion,
      warnings,
      missingDataFlags,
      confidence: {
        inputConfidencePct,
        outputConfidencePct,
        reasons: [
          `Assumption profile ${input.assumptions.profileKey} applied on top of current scenario and planning inputs.`,
          "Confidence remains directional because buildability, cost, capital stack, and valuation logic are still heuristic v0 formulas.",
        ],
      },
      outputs: {
        buildableFootprintSqm: rawBuildableFootprintSqm,
        buildableBgfSqm: rawBuildableBgfSqm,
        planningAdjustedBgfSqm,
        effectiveFloors,
        estimatedUnitCount,
        requiredParkingSpaces,
        acquisitionCost,
        hardCost,
        softCost,
        parkingCost,
        contingencyCost,
        developerFee,
        totalDevelopmentCost,
        totalCapitalizedUses,
        freeFinancingAmount,
        stateSubsidyAmount,
        kfwAmount,
        grantAmount,
        equityAmount: requiredEquity,
        requiredEquity,
        grossResidentialRevenueAnnual,
        vacancyAdjustedRevenueAnnual,
        operatingCostAnnual,
        parkingRevenueAnnual,
        parkingSalesRevenue,
        netOperatingIncomeAnnual,
        grossSalesRevenue,
        netSalesRevenue,
        breakEvenRentEurSqm,
        breakEvenSalesPriceEurSqm,
        subsidyAdjustedBreakEvenRentEurSqm,
        subsidyAdjustedProfitPct,
        subsidyAdjustedIrrPct,
        objectiveValue,
      },
      explanation: {
        heuristicVersion: this.heuristicVersion,
        summary: this.buildSummary(input, {
          planningAdjustedBgfSqm,
          requiredEquity,
          breakEvenRentEurSqm,
          breakEvenSalesPriceEurSqm,
          subsidyAdjustedIrrPct,
          estimatedUnitCount,
        }),
        objectiveNarrative: this.buildObjectiveNarrative(input.optimizationTarget, objectiveValue),
        dominantDrivers: [
          `Planning-adjusted BGF of ${planningAdjustedBgfSqm.toFixed(0)} sqm anchors every downstream output.`,
          `Assumption profile ${input.assumptions.profileKey} applies ${Math.round(input.assumptions.efficiencyFactorPct * 100)}% efficiency and ${Math.round(input.assumptions.vacancyPct * 100)}% vacancy.`,
          `Land plus hard cost per BGF sqm remain the strongest use-side drivers of required equity.`,
          "Funding stack order still allocates state subsidy, then KfW, then free financing, then residual equity.",
        ],
        fallbackAssumptions: warnings.map((warning) => warning.message),
        capitalStackNarrative: [
          `State subsidy allocated first: ${stateSubsidyAmount.toFixed(2)}`,
          `KfW allocated second: ${kfwAmount.toFixed(2)}`,
          `Free financing allocated third: ${freeFinancingAmount.toFixed(2)}`,
          `Residual equity carried last: ${requiredEquity.toFixed(2)}`,
        ],
        weakestLinks: this.buildWeakestLinks(missingDataFlags, breakEvenRentEurSqm, breakEvenSalesPriceEurSqm),
        tradeoffs: this.buildTradeoffs(input, {
          totalCapitalizedUses,
          netOperatingIncomeAnnual,
          netSalesRevenue,
          requiredEquity,
        }),
        nextActions: this.buildNextActions(input, missingDataFlags),
      },
    };
  }

  private computeGrossResidentialRevenueAnnual(input: FeasibilityEngineInput, nlaEstimateSqm: number) {
    switch (input.strategyType) {
      case StrategyType.FREE_MARKET_RENTAL:
      case StrategyType.STUDENT_HOUSING:
        return input.targetMarketRentEurSqm ? nlaEstimateSqm * input.targetMarketRentEurSqm * 12 : null;
      case StrategyType.SUBSIDIZED_RENTAL: {
        if (!input.targetSubsidizedRentEurSqm) return null;
        const subsidizedShare = input.subsidizedSharePct ?? 1;
        const marketShare = Math.max(0, 1 - subsidizedShare);
        const marketRent = input.targetMarketRentEurSqm ?? input.targetSubsidizedRentEurSqm;
        const weightedRent = input.targetSubsidizedRentEurSqm * subsidizedShare + marketRent * marketShare;
        return nlaEstimateSqm * weightedRent * 12;
      }
      default:
        return null;
    }
  }

  private computeSubsidyAdjustedProfitPct(params: {
    input: FeasibilityEngineInput;
    subsidyAdjustedUses: number;
    netOperatingIncomeAnnual: number | null;
    netSalesRevenue: number | null;
  }) {
    const { input, subsidyAdjustedUses, netOperatingIncomeAnnual, netSalesRevenue } = params;
    if (!subsidyAdjustedUses) return null;

    if (input.strategyType === StrategyType.BUILD_TO_SELL) {
      if (netSalesRevenue == null) return null;
      return ((netSalesRevenue - subsidyAdjustedUses) / subsidyAdjustedUses) * 100;
    }

    if (netOperatingIncomeAnnual == null) return null;
    const terminalValue = input.assumptions.exitCapRatePct > 0
      ? netOperatingIncomeAnnual / input.assumptions.exitCapRatePct
      : null;
    if (terminalValue == null) return null;

    return (((netOperatingIncomeAnnual * 10) + terminalValue - subsidyAdjustedUses) / subsidyAdjustedUses) * 100;
  }

  private computeSubsidyAdjustedIrrPct(params: {
    input: FeasibilityEngineInput;
    subsidyAdjustedUses: number;
    netOperatingIncomeAnnual: number | null;
    netSalesRevenue: number | null;
  }) {
    const { input, subsidyAdjustedUses, netOperatingIncomeAnnual, netSalesRevenue } = params;
    if (!subsidyAdjustedUses) return null;

    if (input.strategyType === StrategyType.BUILD_TO_SELL) {
      if (netSalesRevenue == null) return null;
      const saleYears = Math.max(input.assumptions.salesAbsorptionMonths / 12, 0.25);
      return ((Math.pow(netSalesRevenue / subsidyAdjustedUses, 1 / saleYears)) - 1) * 100;
    }

    if (netOperatingIncomeAnnual == null || input.assumptions.exitCapRatePct <= 0) return null;

    const terminalValue = netOperatingIncomeAnnual / input.assumptions.exitCapRatePct;
    const irr = this.computeIrr([
      -subsidyAdjustedUses,
      netOperatingIncomeAnnual,
      netOperatingIncomeAnnual,
      netOperatingIncomeAnnual,
      netOperatingIncomeAnnual,
      netOperatingIncomeAnnual,
      netOperatingIncomeAnnual,
      netOperatingIncomeAnnual,
      netOperatingIncomeAnnual,
      netOperatingIncomeAnnual,
      netOperatingIncomeAnnual + terminalValue,
    ]);

    return irr == null ? null : irr * 100;
  }

  private computeIrr(cashflows: number[]) {
    let low = -0.9;
    let high = 1.5;
    let lowNpv = this.computeNpv(cashflows, low);
    let highNpv = this.computeNpv(cashflows, high);

    if (lowNpv === 0) return low;
    if (highNpv === 0) return high;
    if (lowNpv * highNpv > 0) return null;

    for (let index = 0; index < 60; index += 1) {
      const mid = (low + high) / 2;
      const midNpv = this.computeNpv(cashflows, mid);
      if (Math.abs(midNpv) < 1e-7) return mid;
      if (lowNpv * midNpv <= 0) {
        high = mid;
        highNpv = midNpv;
      } else {
        low = mid;
        lowNpv = midNpv;
      }
    }

    return (low + high) / 2;
  }

  private computeNpv(cashflows: number[], rate: number) {
    return cashflows.reduce((sum, cashflow, index) => sum + (cashflow / Math.pow(1 + rate, index)), 0);
  }

  private buildSummary(
    input: FeasibilityEngineInput,
    metrics: {
      planningAdjustedBgfSqm: number;
      requiredEquity: number;
      breakEvenRentEurSqm: number | null;
      breakEvenSalesPriceEurSqm: number | null;
      subsidyAdjustedIrrPct: number | null;
      estimatedUnitCount: number | null;
    },
  ) {
    if (input.strategyType === StrategyType.BUILD_TO_SELL) {
      return `This v0 readout sizes roughly ${metrics.planningAdjustedBgfSqm.toFixed(0)} sqm of usable BGF and ${metrics.estimatedUnitCount ?? "n/a"} units, then tests whether the current sale assumptions can clear capitalized uses and equity.`;
    }

    return `This v0 readout sizes roughly ${metrics.planningAdjustedBgfSqm.toFixed(0)} sqm of usable BGF and ${metrics.estimatedUnitCount ?? "n/a"} units, then turns the current rent, funding, and cost assumptions into required equity, break-even rent, and a directional return signal.`;
  }

  private buildObjectiveNarrative(target: OptimizationTarget, objectiveValue: number | null) {
    if (objectiveValue == null) {
      return "The current run does not yet produce a comparable value for the selected optimization target.";
    }

    switch (target) {
      case OptimizationTarget.MIN_BREAK_EVEN_RENT:
        return `Ranking target is break-even rent, currently estimated at ${objectiveValue.toFixed(2)} EUR/sqm. Lower is better.`;
      case OptimizationTarget.MIN_BREAK_EVEN_SALES_PRICE:
        return `Ranking target is break-even sales price, currently estimated at ${objectiveValue.toFixed(2)} EUR/sqm. Lower is better.`;
      case OptimizationTarget.MIN_REQUIRED_EQUITY:
        return `Ranking target is required equity, currently estimated at ${objectiveValue.toFixed(0)}. Lower is better.`;
      case OptimizationTarget.MAX_SUBSIDY_ADJUSTED_IRR:
        return `Ranking target is subsidy-adjusted IRR, currently estimated at ${objectiveValue.toFixed(2)}%. Higher is better.`;
      case OptimizationTarget.MAX_UNIT_COUNT:
        return `Ranking target is unit count, currently estimated at ${objectiveValue.toFixed(0)} units. Higher is better.`;
      default:
        return "The selected optimization target is being treated directionally.";
    }
  }

  private buildWeakestLinks(
    missingDataFlags: MissingDataFlag[],
    breakEvenRentEurSqm: number | null,
    breakEvenSalesPriceEurSqm: number | null,
  ) {
    const weakestLinks = missingDataFlags.slice(0, 3).map((flag) => `Missing-data flag: ${flag}`);
    if (breakEvenRentEurSqm == null) weakestLinks.push("Rental logic is incomplete because a break-even rent could not be calculated.");
    if (breakEvenSalesPriceEurSqm == null) weakestLinks.push("Sale logic is incomplete because a break-even sales price could not be calculated.");
    return weakestLinks;
  }

  private buildTradeoffs(
    input: FeasibilityEngineInput,
    metrics: {
      totalCapitalizedUses: number;
      netOperatingIncomeAnnual: number | null;
      netSalesRevenue: number | null;
      requiredEquity: number;
    },
  ) {
    const tradeoffs = [
      `Higher planning buffers and lower efficiency reduce saleable or rentable area but dampen entitlement overstatement risk.`,
      `More subsidy or cheaper debt lowers residual equity, but the ranking still depends heavily on the use-side assumptions.`,
      `The ${input.assumptions.profileKey} assumption profile is carrying meaningful weight in the current output.`,
    ];

    if (metrics.netOperatingIncomeAnnual != null) {
      tradeoffs.push(`Annual NOI is ${metrics.netOperatingIncomeAnnual.toFixed(0)}, so yield logic matters as much as rent in this case.`);
    }
    if (metrics.netSalesRevenue != null) {
      tradeoffs.push(`Net sales revenue is ${metrics.netSalesRevenue.toFixed(0)} against capitalized uses of ${metrics.totalCapitalizedUses.toFixed(0)}.`);
    }
    if (metrics.requiredEquity > metrics.totalCapitalizedUses * 0.35) {
      tradeoffs.push("Residual equity is still large relative to total uses, so capital structure remains the main pressure point.");
    }

    return tradeoffs.slice(0, 4);
  }

  private buildNextActions(input: FeasibilityEngineInput, missingDataFlags: MissingDataFlag[]) {
    const nextActions = [
      "Use comparison against peer scenarios before treating a single run as decisive.",
      "Review planning constraints and parking assumptions if the case depends heavily on unit count or BGF.",
    ];

    if (missingDataFlags.length) {
      nextActions.unshift(`Tighten ${missingDataFlags.slice(0, 2).join(", ")} before relying on the current ranking.`);
    }

    if (input.strategyType === StrategyType.BUILD_TO_SELL) {
      nextActions.push("Challenge sales price, closing cost, and absorption assumptions together rather than one at a time.");
    } else {
      nextActions.push("Challenge rent, vacancy, operating cost, and exit yield together rather than one at a time.");
    }

    return nextActions.slice(0, 4);
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
