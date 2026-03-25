import { PlanningParameterKey } from "./enums";

export const CORE_PLANNING_KEY_SLUGS = {
  GRZ: PlanningParameterKey.GRZ,
  GFZ: PlanningParameterKey.GFZ,
  MAX_BGF_SQM: PlanningParameterKey.MAX_BGF_SQM,
  MAX_HEIGHT_M: PlanningParameterKey.MAX_HEIGHT_M,
  MAX_FLOORS: PlanningParameterKey.MAX_FLOORS,
  MAX_UNITS: PlanningParameterKey.MAX_UNITS,
  BUILDABLE_WINDOW: PlanningParameterKey.BUILDABLE_WINDOW,
  PARKING_SPACES_PER_UNIT: PlanningParameterKey.PARKING_SPACES_PER_UNIT,
  SUBSIDY_ELIGIBILITY: PlanningParameterKey.SUBSIDY_ELIGIBILITY,
  RENT_CAP_EUR_SQM: PlanningParameterKey.RENT_CAP_EUR_SQM,
  LOAN_CAP_PCT: PlanningParameterKey.LOAN_CAP_PCT,
} as const;

export function resolvePlanningKeyParts(input: {
  parameterKey?: PlanningParameterKey | null;
  customKey?: string | null;
  keyNamespace?: string | null;
}) {
  if (!input.parameterKey && !input.customKey) {
    throw new Error("Either parameterKey or customKey is required.");
  }

  if (input.parameterKey) {
    return {
      parameterKey: input.parameterKey,
      customKey: null,
      keyNamespace: "core",
      keySlug: input.parameterKey,
    };
  }

  return {
    parameterKey: null,
    customKey: input.customKey ?? null,
    keyNamespace: input.keyNamespace ?? "custom",
    keySlug: input.customKey!,
  };
}
