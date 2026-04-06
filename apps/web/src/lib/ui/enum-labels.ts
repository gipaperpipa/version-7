import { AcquisitionType, AssumptionProfileKey, OptimizationTarget, ScenarioGovernanceStatus, ScenarioStatus, StrategyType } from "@repo/contracts";

export const strategyTypeLabels: Record<StrategyType, string> = {
  [StrategyType.FREE_MARKET_RENTAL]: "Free-Market Rental",
  [StrategyType.SUBSIDIZED_RENTAL]: "Subsidized Rental",
  [StrategyType.STUDENT_HOUSING]: "Student Housing",
  [StrategyType.BUILD_TO_SELL]: "Build-to-Sell",
  [StrategyType.MIXED_STRATEGY]: "Mixed Strategy (Temporary)",
};

export const acquisitionTypeLabels: Record<AcquisitionType, string> = {
  [AcquisitionType.BUY]: "Buy",
  [AcquisitionType.LEASE]: "Lease",
  [AcquisitionType.OPTION]: "Option",
};

export const optimizationTargetLabels: Record<OptimizationTarget, string> = {
  [OptimizationTarget.MIN_BREAK_EVEN_RENT]: "Minimize Break-Even Rent",
  [OptimizationTarget.MIN_BREAK_EVEN_SALES_PRICE]: "Minimize Break-Even Sales Price",
  [OptimizationTarget.MIN_REQUIRED_EQUITY]: "Minimize Required Equity",
  [OptimizationTarget.MAX_SUBSIDY_ADJUSTED_IRR]: "Maximize Subsidy-Adjusted IRR",
  [OptimizationTarget.MAX_UNIT_COUNT]: "Maximize Unit Count",
};

export const assumptionProfileLabels: Record<AssumptionProfileKey, string> = {
  [AssumptionProfileKey.BASELINE]: "Baseline",
  [AssumptionProfileKey.CONSERVATIVE]: "Conservative",
  [AssumptionProfileKey.AGGRESSIVE]: "Aggressive",
  [AssumptionProfileKey.CUSTOM]: "Custom",
};

export const scenarioStatusLabels: Record<ScenarioStatus, string> = {
  [ScenarioStatus.DRAFT]: "Draft",
  [ScenarioStatus.READY]: "Ready",
  [ScenarioStatus.RUNNING]: "Running",
  [ScenarioStatus.COMPLETED]: "Completed",
  [ScenarioStatus.FAILED]: "Failed",
  [ScenarioStatus.ARCHIVED]: "Archived",
};

export const scenarioGovernanceStatusLabels: Record<ScenarioGovernanceStatus, string> = {
  [ScenarioGovernanceStatus.DRAFT]: "Draft",
  [ScenarioGovernanceStatus.ACTIVE_CANDIDATE]: "Active candidate",
  [ScenarioGovernanceStatus.ARCHIVED]: "Archived",
};

export function humanizeTokenLabel(token: string) {
  return token
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const strategyFieldHints: Record<
  StrategyType,
  {
    title: string;
    description: string;
    requiredFields: string[];
  }
> = {
  [StrategyType.FREE_MARKET_RENTAL]: {
    title: "Free-market rental focus",
    description: "Market rent is the critical revenue input for Sprint 1 readiness.",
    requiredFields: ["Market rent EUR/sqm", "Land cost", "Hard cost per BGF sqm"],
  },
  [StrategyType.SUBSIDIZED_RENTAL]: {
    title: "Subsidized rental focus",
    description: "Subsidized rent, subsidized share, and at least one enabled state subsidy stack item are required.",
    requiredFields: ["Subsidized rent EUR/sqm", "Subsidized share pct", "State subsidy stack item"],
  },
  [StrategyType.STUDENT_HOUSING]: {
    title: "Student housing focus",
    description: "Sprint 1 uses rental math similar to free-market rental.",
    requiredFields: ["Market rent EUR/sqm", "Average unit size sqm", "Land cost"],
  },
  [StrategyType.BUILD_TO_SELL]: {
    title: "Build-to-sell focus",
    description: "Sales price is the critical revenue input for Sprint 1 readiness.",
    requiredFields: ["Sales price EUR/sqm", "Land cost", "Hard cost per BGF sqm"],
  },
  [StrategyType.MIXED_STRATEGY]: {
    title: "Temporary mixed-strategy mode",
    description: "Sprint 1 keeps MIXED_STRATEGY minimal and temporary. A JSON mix configuration is required.",
    requiredFields: ["Temporary mix configuration JSON", "Primary revenue assumptions", "Funding stack"],
  },
};
