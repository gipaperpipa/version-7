export const UserRole = {
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  ORG_OWNER: "ORG_OWNER",
  ORG_ADMIN: "ORG_ADMIN",
  ANALYST: "ANALYST",
  VIEWER: "VIEWER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SourceType = {
  USER_INPUT: "USER_INPUT",
  IMPORT: "IMPORT",
  GIS_CADASTRE: "GIS_CADASTRE",
  PLANNING_DOCUMENT: "PLANNING_DOCUMENT",
  THIRD_PARTY_API: "THIRD_PARTY_API",
  SYSTEM_DERIVED: "SYSTEM_DERIVED",
  MANUAL_OVERRIDE: "MANUAL_OVERRIDE",
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const StrategyType = {
  FREE_MARKET_RENTAL: "FREE_MARKET_RENTAL",
  SUBSIDIZED_RENTAL: "SUBSIDIZED_RENTAL",
  STUDENT_HOUSING: "STUDENT_HOUSING",
  BUILD_TO_SELL: "BUILD_TO_SELL",
  MIXED_STRATEGY: "MIXED_STRATEGY",
} as const;
export type StrategyType = (typeof StrategyType)[keyof typeof StrategyType];

export const AcquisitionType = {
  BUY: "BUY",
  LEASE: "LEASE",
  OPTION: "OPTION",
} as const;
export type AcquisitionType = (typeof AcquisitionType)[keyof typeof AcquisitionType];

export const OptimizationTarget = {
  MIN_BREAK_EVEN_RENT: "MIN_BREAK_EVEN_RENT",
  MIN_BREAK_EVEN_SALES_PRICE: "MIN_BREAK_EVEN_SALES_PRICE",
  MIN_REQUIRED_EQUITY: "MIN_REQUIRED_EQUITY",
  MAX_SUBSIDY_ADJUSTED_IRR: "MAX_SUBSIDY_ADJUSTED_IRR",
  MAX_UNIT_COUNT: "MAX_UNIT_COUNT",
} as const;
export type OptimizationTarget = (typeof OptimizationTarget)[keyof typeof OptimizationTarget];

export const AssumptionProfileKey = {
  BASELINE: "BASELINE",
  CONSERVATIVE: "CONSERVATIVE",
  AGGRESSIVE: "AGGRESSIVE",
  CUSTOM: "CUSTOM",
} as const;
export type AssumptionProfileKey = (typeof AssumptionProfileKey)[keyof typeof AssumptionProfileKey];

export const ScenarioStatus = {
  DRAFT: "DRAFT",
  READY: "READY",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ScenarioStatus = (typeof ScenarioStatus)[keyof typeof ScenarioStatus];

export const ScenarioRunStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type ScenarioRunStatus = (typeof ScenarioRunStatus)[keyof typeof ScenarioRunStatus];

export const ScenarioReadinessStatus = {
  READY: "READY",
  READY_WITH_WARNINGS: "READY_WITH_WARNINGS",
  BLOCKED: "BLOCKED",
} as const;
export type ScenarioReadinessStatus =
  (typeof ScenarioReadinessStatus)[keyof typeof ScenarioReadinessStatus];

export const ScenarioReadinessIssueSeverity = {
  BLOCKING: "BLOCKING",
  WARNING: "WARNING",
} as const;
export type ScenarioReadinessIssueSeverity =
  (typeof ScenarioReadinessIssueSeverity)[keyof typeof ScenarioReadinessIssueSeverity];

export const ScenarioReadinessIssueCode = {
  MISSING_PARCEL: "MISSING_PARCEL",
  PARCEL_GROUP_RUN_UNSUPPORTED_V0: "PARCEL_GROUP_RUN_UNSUPPORTED_V0",
  MISSING_LAND_AREA: "MISSING_LAND_AREA",
  MISSING_BUILDABILITY_INPUT: "MISSING_BUILDABILITY_INPUT",
  MISSING_COST_INPUT: "MISSING_COST_INPUT",
  MISSING_MARKET_RENT: "MISSING_MARKET_RENT",
  MISSING_SUBSIDIZED_RENT: "MISSING_SUBSIDIZED_RENT",
  MISSING_SUBSIDIZED_SHARE: "MISSING_SUBSIDIZED_SHARE",
  MISSING_STATE_SUBSIDY_STACK: "MISSING_STATE_SUBSIDY_STACK",
  MISSING_SALES_PRICE: "MISSING_SALES_PRICE",
  TEMPORARY_MIXED_STRATEGY: "TEMPORARY_MIXED_STRATEGY",
  MISSING_MIX_CONFIGURATION: "MISSING_MIX_CONFIGURATION",
} as const;
export type ScenarioReadinessIssueCode =
  (typeof ScenarioReadinessIssueCode)[keyof typeof ScenarioReadinessIssueCode];

export const PlanningParameterKey = {
  GRZ: "GRZ",
  GFZ: "GFZ",
  MAX_BGF_SQM: "MAX_BGF_SQM",
  MAX_HEIGHT_M: "MAX_HEIGHT_M",
  MAX_FLOORS: "MAX_FLOORS",
  MAX_UNITS: "MAX_UNITS",
  BUILDABLE_WINDOW: "BUILDABLE_WINDOW",
  PARKING_SPACES_PER_UNIT: "PARKING_SPACES_PER_UNIT",
  SUBSIDY_ELIGIBILITY: "SUBSIDY_ELIGIBILITY",
  RENT_CAP_EUR_SQM: "RENT_CAP_EUR_SQM",
  LOAN_CAP_PCT: "LOAN_CAP_PCT",
} as const;
export type PlanningParameterKey =
  (typeof PlanningParameterKey)[keyof typeof PlanningParameterKey];

export const PlanningParameterType = {
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
  JSON: "JSON",
  GEOMETRY: "GEOMETRY",
} as const;
export type PlanningParameterType =
  (typeof PlanningParameterType)[keyof typeof PlanningParameterType];

export const FinancingSourceType = {
  STATE_SUBSIDY: "STATE_SUBSIDY",
  KFW: "KFW",
  FREE_FINANCING: "FREE_FINANCING",
  GRANT: "GRANT",
  EQUITY: "EQUITY",
} as const;
export type FinancingSourceType =
  (typeof FinancingSourceType)[keyof typeof FinancingSourceType];

export const FundingProviderType = {
  COMMERCIAL_BANK: "COMMERCIAL_BANK",
  STATE_SUBSIDY_BANK: "STATE_SUBSIDY_BANK",
  KFW: "KFW",
} as const;
export type FundingProviderType =
  (typeof FundingProviderType)[keyof typeof FundingProviderType];

export const FundingCategory = {
  FREE_LOAN: "FREE_LOAN",
  STATE_SUBSIDY_LOAN: "STATE_SUBSIDY_LOAN",
  KFW_LOAN: "KFW_LOAN",
} as const;
export type FundingCategory = (typeof FundingCategory)[keyof typeof FundingCategory];

export const MissingDataFlag = {
  BUILDABLE_WINDOW: "BUILDABLE_WINDOW",
  GRZ: "GRZ",
  GFZ: "GFZ",
  AVG_UNIT_SIZE_SQM: "AVG_UNIT_SIZE_SQM",
  HARD_COST_PER_BGF_SQM: "HARD_COST_PER_BGF_SQM",
  FUNDING_STACK: "FUNDING_STACK",
} as const;
export type MissingDataFlag = (typeof MissingDataFlag)[keyof typeof MissingDataFlag];

export const RunWarningCode = {
  HEURISTIC_BUILDABILITY: "HEURISTIC_BUILDABILITY",
  HEURISTIC_COSTS: "HEURISTIC_COSTS",
  HEURISTIC_CAPITAL_STACK: "HEURISTIC_CAPITAL_STACK",
} as const;
export type RunWarningCode = (typeof RunWarningCode)[keyof typeof RunWarningCode];
