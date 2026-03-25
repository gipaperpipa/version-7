import type { Id, IsoDateTime } from "./common";
import type {
  ScenarioReadinessIssueCode,
  ScenarioReadinessIssueSeverity,
  ScenarioReadinessStatus,
} from "./enums";

export interface ScenarioReadinessIssueDto {
  code: ScenarioReadinessIssueCode;
  field?: string;
  message: string;
  severity: ScenarioReadinessIssueSeverity;
}

export interface ScenarioReadinessDto {
  scenarioId: Id;
  status: ScenarioReadinessStatus;
  canRun: boolean;
  issues: ScenarioReadinessIssueDto[];
  validatedAt: IsoDateTime;
}
