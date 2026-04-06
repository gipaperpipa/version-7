import { AssumptionProfileKey, AssumptionTemplateScope } from "../../generated-contracts/enums";
import type { ScenarioAssumptionTemplateDto } from "../../generated-contracts/scenarios";
import { SCENARIO_ASSUMPTION_PROFILE_DEFAULTS } from "./scenario-assumptions";

const SCENARIO_ASSUMPTION_TEMPLATES: Omit<ScenarioAssumptionTemplateDto, "isWorkspaceDefault">[] = [
  {
    key: "baseline-standard",
    name: "Baseline Standard",
    description: "Balanced directional underwriting for first-pass feasibility work.",
    scope: AssumptionTemplateScope.SYSTEM,
    profileKey: AssumptionProfileKey.BASELINE,
    defaults: SCENARIO_ASSUMPTION_PROFILE_DEFAULTS[AssumptionProfileKey.BASELINE],
  },
  {
    key: "conservative-underwrite",
    name: "Conservative Underwrite",
    description: "Stricter planning, cost, vacancy, and exit posture for downside review.",
    scope: AssumptionTemplateScope.SYSTEM,
    profileKey: AssumptionProfileKey.CONSERVATIVE,
    defaults: SCENARIO_ASSUMPTION_PROFILE_DEFAULTS[AssumptionProfileKey.CONSERVATIVE],
  },
  {
    key: "aggressive-upside",
    name: "Aggressive Upside",
    description: "Tighter buffers and stronger commercial assumptions for upside sensitivity checks.",
    scope: AssumptionTemplateScope.SYSTEM,
    profileKey: AssumptionProfileKey.AGGRESSIVE,
    defaults: SCENARIO_ASSUMPTION_PROFILE_DEFAULTS[AssumptionProfileKey.AGGRESSIVE],
  },
  {
    key: "custom-casework",
    name: "Custom Casework",
    description: "Start from baseline values, then override the assumptions that are truly case-specific.",
    scope: AssumptionTemplateScope.SYSTEM,
    profileKey: AssumptionProfileKey.CUSTOM,
    defaults: SCENARIO_ASSUMPTION_PROFILE_DEFAULTS[AssumptionProfileKey.CUSTOM],
  },
];

export function getScenarioAssumptionTemplates(workspaceDefaultTemplateKey?: string | null): ScenarioAssumptionTemplateDto[] {
  return SCENARIO_ASSUMPTION_TEMPLATES.map((template) => ({
    ...template,
    isWorkspaceDefault: template.key === workspaceDefaultTemplateKey,
  }));
}

export function getScenarioAssumptionTemplateByKey(key: string | null | undefined) {
  if (!key) return null;
  return SCENARIO_ASSUMPTION_TEMPLATES.find((item) => item.key === key) ?? null;
}
