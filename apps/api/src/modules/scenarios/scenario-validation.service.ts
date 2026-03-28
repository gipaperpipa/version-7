import { Injectable, NotFoundException } from "@nestjs/common";
import { FinancingSourceType } from "@prisma/client";
import {
  CORE_PLANNING_KEY_SLUGS,
  ScenarioReadinessIssueCode,
  ScenarioReadinessIssueSeverity,
  ScenarioReadinessStatus,
  StrategyType,
  type ScenarioReadinessIssueDto,
} from "../../contracts";
import { PrismaService } from "../../common/prisma/prisma.service";
import { scenarioForValidationArgs, type ScenarioForValidation } from "./scenario.types";

@Injectable()
export class ScenarioValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async loadScenarioForOrganization(
    scenarioId: string,
    organizationId: string,
  ): Promise<ScenarioForValidation> {
    const scenario = await this.prisma.scenario.findFirst({
      ...scenarioForValidationArgs,
      where: {
        id: scenarioId,
        organizationId,
      },
    });

    if (!scenario) {
      throw new NotFoundException("Scenario not found");
    }

    return scenario;
  }

  evaluateLoadedScenario(scenario: ScenarioForValidation) {
    const params = scenario.parcel?.planningParameters ?? [];
    const issues: ScenarioReadinessIssueDto[] = [];
    const hasValue = (slug: string) =>
      params.some(
        (p) =>
          p.keySlug === slug &&
          (p.valueNumber !== null || p.valueBoolean !== null || p.valueJson !== null || p.geom !== null),
      );

    const enabledStateSubsidy = scenario.fundingVariants.some(
      (item) => item.financingSourceType === FinancingSourceType.STATE_SUBSIDY && item.isEnabled,
    );

    if (!scenario.parcelId) {
      issues.push(this.block(ScenarioReadinessIssueCode.MISSING_PARCEL, "parcelId", "A parcel is required for Sprint 1 feasibility runs."));
    }

    if (scenario.parcelGroupId && !scenario.parcelId) {
      issues.push(this.block(
        ScenarioReadinessIssueCode.PARCEL_GROUP_RUN_UNSUPPORTED_V0,
        "parcelGroupId",
        "Parcel-group-only runs are not supported by the v0 engine.",
      ));
    }

    if (!scenario.parcel?.landAreaSqm) {
      issues.push(this.block(ScenarioReadinessIssueCode.MISSING_LAND_AREA, "parcel.landAreaSqm", "Parcel land area is required."));
    }

    const hasFootprintInput =
      hasValue(CORE_PLANNING_KEY_SLUGS.BUILDABLE_WINDOW) ||
      hasValue(CORE_PLANNING_KEY_SLUGS.GRZ);

    const hasVolumeInput =
      hasValue(CORE_PLANNING_KEY_SLUGS.GFZ) ||
      hasValue(CORE_PLANNING_KEY_SLUGS.MAX_BGF_SQM) ||
      hasValue(CORE_PLANNING_KEY_SLUGS.MAX_HEIGHT_M) ||
      hasValue(CORE_PLANNING_KEY_SLUGS.MAX_FLOORS);

    if (!hasFootprintInput || !hasVolumeInput) {
      issues.push(this.block(
        ScenarioReadinessIssueCode.MISSING_BUILDABILITY_INPUT,
        "planning",
        "Buildability inputs are incomplete for v0 feasibility.",
      ));
    }

    if (!scenario.hardCostPerBgfSqm || !scenario.landCost) {
      issues.push(this.block(ScenarioReadinessIssueCode.MISSING_COST_INPUT, "costs", "Land cost and hard cost per BGF sqm are required."));
    }

    switch (scenario.strategyType) {
      case StrategyType.FREE_MARKET_RENTAL:
      case StrategyType.STUDENT_HOUSING:
        if (!scenario.targetMarketRentEurSqm) {
          issues.push(this.block(ScenarioReadinessIssueCode.MISSING_MARKET_RENT, "targetMarketRentEurSqm", "Market rent is required."));
        }
        break;
      case StrategyType.SUBSIDIZED_RENTAL:
        if (!scenario.targetSubsidizedRentEurSqm) {
          issues.push(this.block(ScenarioReadinessIssueCode.MISSING_SUBSIDIZED_RENT, "targetSubsidizedRentEurSqm", "Subsidized rent is required."));
        }
        if (!scenario.subsidizedSharePct) {
          issues.push(this.block(ScenarioReadinessIssueCode.MISSING_SUBSIDIZED_SHARE, "subsidizedSharePct", "Subsidized share is required."));
        }
        if (!enabledStateSubsidy) {
          issues.push(this.block(ScenarioReadinessIssueCode.MISSING_STATE_SUBSIDY_STACK, "fundingVariants", "At least one enabled state subsidy item is required."));
        }
        break;
      case StrategyType.BUILD_TO_SELL:
        if (!scenario.targetSalesPriceEurSqm) {
          issues.push(this.block(ScenarioReadinessIssueCode.MISSING_SALES_PRICE, "targetSalesPriceEurSqm", "Sales price input is required."));
        }
        break;
      case StrategyType.MIXED_STRATEGY:
        issues.push(this.warn(ScenarioReadinessIssueCode.TEMPORARY_MIXED_STRATEGY, "strategyType", "MIXED_STRATEGY is temporary in Sprint 1."));
        if (!scenario.strategyMixJson) {
          issues.push(this.block(ScenarioReadinessIssueCode.MISSING_MIX_CONFIGURATION, "strategyMixJson", "Temporary mix configuration is required."));
        }
        break;
    }

    const blockingCount = issues.filter((item) => item.severity === ScenarioReadinessIssueSeverity.BLOCKING).length;
    const warningCount = issues.filter((item) => item.severity === ScenarioReadinessIssueSeverity.WARNING).length;
    const sourceScores = [
      scenario.parcel?.confidenceScore ?? null,
      ...params.map((item) => item.confidenceScore ?? null),
    ].filter((value): value is number => typeof value === "number");

    const sourceAverage = sourceScores.length
      ? sourceScores.reduce((acc, value) => acc + value, 0) / sourceScores.length
      : 70;
    const inputConfidencePct = Math.max(20, Math.round(sourceAverage - blockingCount * 20 - warningCount * 8));

    return {
      readiness: {
        scenarioId: scenario.id,
        status: blockingCount > 0
          ? ScenarioReadinessStatus.BLOCKED
          : warningCount > 0
            ? ScenarioReadinessStatus.READY_WITH_WARNINGS
            : ScenarioReadinessStatus.READY,
        canRun: blockingCount === 0,
        issues,
        validatedAt: new Date().toISOString(),
      },
      inputConfidencePct,
      confidenceReasons: [
        `Derived from source confidence average of ${Math.round(sourceAverage)}%.`,
        `${blockingCount} blocking issue(s) and ${warningCount} warning(s) reduced readiness confidence.`,
      ],
    };
  }

  private block(code: ScenarioReadinessIssueCode, field: string, message: string): ScenarioReadinessIssueDto {
    return { code, field, message, severity: ScenarioReadinessIssueSeverity.BLOCKING };
  }

  private warn(code: ScenarioReadinessIssueCode, field: string, message: string): ScenarioReadinessIssueDto {
    return { code, field, message, severity: ScenarioReadinessIssueSeverity.WARNING };
  }
}
