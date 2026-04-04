import { Injectable, NotFoundException } from "@nestjs/common";
import { FinancingSourceType } from "@prisma/client";
import {
  CORE_PLANNING_KEY_SLUGS,
} from "../../generated-contracts/planning-keys";
import {
  ScenarioReadinessIssueCategory,
  ScenarioReadinessIssueCode,
  ScenarioReadinessIssueSeverity,
  ScenarioReadinessStatus,
  StrategyType,
} from "../../generated-contracts/enums";
import type { ScenarioReadinessIssueDto } from "../../generated-contracts/readiness";
import { PrismaService } from "../../common/prisma/prisma.service";
import { scenarioForValidationArgs, type ScenarioForValidation } from "./scenario.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
    const enabledFundingCount = scenario.fundingVariants.filter((item) => item.isEnabled).length;
    const parcelProvenance = isRecord(scenario.parcel?.provenanceJson) ? scenario.parcel?.provenanceJson : null;
    const parcelTrustMode = typeof parcelProvenance?.trustMode === "string" ? parcelProvenance.trustMode : null;
    const geometryDerived = Boolean(parcelProvenance?.geometryDerived);
    const areaDerived = Boolean(parcelProvenance?.areaDerived);

    if (!scenario.parcelId) {
      issues.push(this.blockExecution(ScenarioReadinessIssueCode.MISSING_PARCEL, "parcelId", "A parcel is required for Sprint 1 feasibility runs."));
    }

    if (scenario.parcelGroupId && !scenario.parcelId) {
      issues.push(this.blockExecution(
        ScenarioReadinessIssueCode.PARCEL_GROUP_RUN_UNSUPPORTED_V0,
        "parcelGroupId",
        "Parcel-group-only runs are not supported by the v0 engine.",
      ));
    }

    if (!scenario.parcel?.landAreaSqm) {
      issues.push(this.blockPlanning(ScenarioReadinessIssueCode.MISSING_LAND_AREA, "parcel.landAreaSqm", "Parcel land area is required."));
    }

    if (scenario.parcel && (parcelTrustMode === "SOURCE_INCOMPLETE" || !geometryDerived || !areaDerived)) {
      issues.push(this.warnConfidence(
        ScenarioReadinessIssueCode.SOURCE_PARCEL_INCOMPLETE,
        "parcel",
        "Parcel source intake is incomplete. The run can proceed, but planning confidence is reduced until geometry and area are fully source-derived.",
        ScenarioReadinessIssueCategory.PLANNING_CRITICAL,
      ));
    }

    if (scenario.parcel && parcelTrustMode === "MANUAL_FALLBACK") {
      issues.push(this.warnConfidence(
        ScenarioReadinessIssueCode.MANUAL_PARCEL_FALLBACK,
        "parcel",
        "This case is anchored to a manual fallback parcel. The run remains directional, but source-backed parcel identity should replace it when available.",
      ));
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
      issues.push(this.blockPlanning(
        ScenarioReadinessIssueCode.MISSING_BUILDABILITY_INPUT,
        "planning",
        "Buildability inputs are incomplete for v0 feasibility.",
      ));
    }

    if (!scenario.hardCostPerBgfSqm || !scenario.landCost) {
      issues.push(this.blockExecution(ScenarioReadinessIssueCode.MISSING_COST_INPUT, "costs", "Land cost and hard cost per BGF sqm are required."));
    }

    if (enabledFundingCount === 0) {
      issues.push(this.warnConfidence(
        ScenarioReadinessIssueCode.MISSING_ACTIVE_FUNDING_STACK,
        "fundingVariants",
        "No active funding stack is selected. The run can still proceed, but capital-structure outputs and confidence will be weaker.",
        ScenarioReadinessIssueCategory.FUNDING_CRITICAL,
      ));
    }

    switch (scenario.strategyType) {
      case StrategyType.FREE_MARKET_RENTAL:
      case StrategyType.STUDENT_HOUSING:
        if (!scenario.targetMarketRentEurSqm) {
          issues.push(this.blockExecution(ScenarioReadinessIssueCode.MISSING_MARKET_RENT, "targetMarketRentEurSqm", "Market rent is required."));
        }
        break;
      case StrategyType.SUBSIDIZED_RENTAL:
        if (!scenario.targetSubsidizedRentEurSqm) {
          issues.push(this.blockExecution(ScenarioReadinessIssueCode.MISSING_SUBSIDIZED_RENT, "targetSubsidizedRentEurSqm", "Subsidized rent is required."));
        }
        if (!scenario.subsidizedSharePct) {
          issues.push(this.blockExecution(ScenarioReadinessIssueCode.MISSING_SUBSIDIZED_SHARE, "subsidizedSharePct", "Subsidized share is required."));
        }
        if (!enabledStateSubsidy) {
          issues.push(this.blockFunding(ScenarioReadinessIssueCode.MISSING_STATE_SUBSIDY_STACK, "fundingVariants", "At least one enabled state subsidy item is required."));
        }
        break;
      case StrategyType.BUILD_TO_SELL:
        if (!scenario.targetSalesPriceEurSqm) {
          issues.push(this.blockExecution(ScenarioReadinessIssueCode.MISSING_SALES_PRICE, "targetSalesPriceEurSqm", "Sales price input is required."));
        }
        break;
      case StrategyType.MIXED_STRATEGY:
        issues.push(this.warnQuality(ScenarioReadinessIssueCode.TEMPORARY_MIXED_STRATEGY, "strategyType", "MIXED_STRATEGY is temporary in Sprint 1."));
        if (!scenario.strategyMixJson) {
          issues.push(this.blockExecution(ScenarioReadinessIssueCode.MISSING_MIX_CONFIGURATION, "strategyMixJson", "Temporary mix configuration is required."));
        }
        break;
    }

    const executionBlockerCount = issues.filter((item) => item.blocksRun).length;
    const confidenceBlockerCount = issues.filter((item) => item.blocksConfidence && !item.blocksRun).length;
    const warningCount = issues.filter((item) => item.severity === ScenarioReadinessIssueSeverity.WARNING).length;
    const summary = {
      executionBlockers: executionBlockerCount,
      confidenceBlockers: confidenceBlockerCount,
      planningCritical: issues.filter((item) => item.category === ScenarioReadinessIssueCategory.PLANNING_CRITICAL).length,
      fundingCritical: issues.filter((item) => item.category === ScenarioReadinessIssueCategory.FUNDING_CRITICAL).length,
      optionalInputs: issues.filter((item) => item.category === ScenarioReadinessIssueCategory.OPTIONAL_INPUT).length,
      qualityWarnings: issues.filter((item) => item.category === ScenarioReadinessIssueCategory.QUALITY_WARNING).length,
    };
    const sourceScores = [
      scenario.parcel?.confidenceScore ?? null,
      ...params.map((item) => item.confidenceScore ?? null),
    ].filter((value): value is number => typeof value === "number");

    const sourceAverage = sourceScores.length
      ? sourceScores.reduce((acc, value) => acc + value, 0) / sourceScores.length
      : 70;
    const inputConfidencePct = Math.max(20, Math.round(sourceAverage - executionBlockerCount * 20 - confidenceBlockerCount * 12 - warningCount * 6));

    return {
      readiness: {
        scenarioId: scenario.id,
        status: executionBlockerCount > 0
          ? ScenarioReadinessStatus.BLOCKED
          : confidenceBlockerCount > 0 || warningCount > 0
            ? ScenarioReadinessStatus.READY_WITH_WARNINGS
            : ScenarioReadinessStatus.READY,
        canRun: executionBlockerCount === 0,
        issues,
        summary,
        validatedAt: new Date().toISOString(),
      },
      inputConfidencePct,
      confidenceReasons: [
        `Derived from source confidence average of ${Math.round(sourceAverage)}%.`,
        `${executionBlockerCount} execution blocker(s), ${confidenceBlockerCount} confidence blocker(s), and ${warningCount} warning(s) reduced readiness confidence.`,
      ],
    };
  }

  private blockExecution(code: ScenarioReadinessIssueCode, field: string, message: string): ScenarioReadinessIssueDto {
    return this.issue(code, field, message, ScenarioReadinessIssueSeverity.BLOCKING, ScenarioReadinessIssueCategory.EXECUTION_BLOCKER, true, true);
  }

  private blockPlanning(code: ScenarioReadinessIssueCode, field: string, message: string): ScenarioReadinessIssueDto {
    return this.issue(code, field, message, ScenarioReadinessIssueSeverity.BLOCKING, ScenarioReadinessIssueCategory.PLANNING_CRITICAL, true, true);
  }

  private blockFunding(code: ScenarioReadinessIssueCode, field: string, message: string): ScenarioReadinessIssueDto {
    return this.issue(code, field, message, ScenarioReadinessIssueSeverity.BLOCKING, ScenarioReadinessIssueCategory.FUNDING_CRITICAL, true, true);
  }

  private warnConfidence(
    code: ScenarioReadinessIssueCode,
    field: string,
    message: string,
    category: ScenarioReadinessIssueCategory = ScenarioReadinessIssueCategory.CONFIDENCE_BLOCKER,
  ): ScenarioReadinessIssueDto {
    return this.issue(code, field, message, ScenarioReadinessIssueSeverity.WARNING, category, false, true);
  }

  private warnQuality(code: ScenarioReadinessIssueCode, field: string, message: string): ScenarioReadinessIssueDto {
    return this.issue(code, field, message, ScenarioReadinessIssueSeverity.WARNING, ScenarioReadinessIssueCategory.QUALITY_WARNING, false, false);
  }

  private issue(
    code: ScenarioReadinessIssueCode,
    field: string,
    message: string,
    severity: ScenarioReadinessIssueSeverity,
    category: ScenarioReadinessIssueCategory,
    blocksRun: boolean,
    blocksConfidence: boolean,
  ): ScenarioReadinessIssueDto {
    return { code, field, message, severity, category, blocksRun, blocksConfidence };
  }
}
