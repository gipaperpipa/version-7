import type { Id, IsoDateTime } from "./common";
import type {
  ScenarioReadinessIssueCategory,
  ScenarioReadinessIssueCode,
  ScenarioReadinessIssueSeverity,
  ScenarioReadinessStatus,
} from "./enums";

export interface ScenarioReadinessIssueDto {
  code: ScenarioReadinessIssueCode;
  field?: string;
  message: string;
  severity: ScenarioReadinessIssueSeverity;
  category: ScenarioReadinessIssueCategory;
  blocksRun: boolean;
  blocksConfidence: boolean;
}

export interface ScenarioReadinessSummaryDto {
  executionBlockers: number;
  confidenceBlockers: number;
  planningCritical: number;
  fundingCritical: number;
  optionalInputs: number;
  qualityWarnings: number;
}

export interface ScenarioReadinessDto {
  scenarioId: Id;
  status: ScenarioReadinessStatus;
  canRun: boolean;
  issues: ScenarioReadinessIssueDto[];
  summary: ScenarioReadinessSummaryDto;
  validatedAt: IsoDateTime;
}
