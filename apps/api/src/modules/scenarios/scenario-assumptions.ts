import { AssumptionProfileKey } from "../../generated-contracts/enums";
import type {
  ScenarioAssumptionEffectiveDto,
  ScenarioAssumptionOverridesDto,
  ScenarioAssumptionSetDto,
} from "../../generated-contracts/scenarios";

type ScenarioInputsRecord = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProfileKey(value: unknown): value is AssumptionProfileKey {
  return Object.values(AssumptionProfileKey).includes(value as AssumptionProfileKey);
}

function nullableDecimalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

export const emptyScenarioAssumptionOverrides = (): ScenarioAssumptionOverridesDto => ({
  planningBufferPct: null,
  efficiencyFactorPct: null,
  vacancyPct: null,
  operatingCostPerNlaSqmYear: null,
  acquisitionClosingCostPct: null,
  contingencyPct: null,
  developerFeePct: null,
  targetProfitPct: null,
  exitCapRatePct: null,
  salesClosingCostPct: null,
  salesAbsorptionMonths: null,
  parkingRevenuePerSpaceMonth: null,
  parkingSalePricePerSpace: null,
});

export const SCENARIO_ASSUMPTION_PROFILE_DEFAULTS: Record<AssumptionProfileKey, ScenarioAssumptionEffectiveDto> = {
  [AssumptionProfileKey.BASELINE]: {
    profileKey: AssumptionProfileKey.BASELINE,
    planningBufferPct: "0.05",
    efficiencyFactorPct: "0.82",
    vacancyPct: "0.04",
    operatingCostPerNlaSqmYear: "18",
    acquisitionClosingCostPct: "0.03",
    contingencyPct: "0.06",
    developerFeePct: "0.04",
    targetProfitPct: "0.12",
    exitCapRatePct: "0.045",
    salesClosingCostPct: "0.03",
    salesAbsorptionMonths: 12,
    parkingRevenuePerSpaceMonth: "110",
    parkingSalePricePerSpace: "22000",
  },
  [AssumptionProfileKey.CONSERVATIVE]: {
    profileKey: AssumptionProfileKey.CONSERVATIVE,
    planningBufferPct: "0.1",
    efficiencyFactorPct: "0.78",
    vacancyPct: "0.07",
    operatingCostPerNlaSqmYear: "22",
    acquisitionClosingCostPct: "0.04",
    contingencyPct: "0.09",
    developerFeePct: "0.05",
    targetProfitPct: "0.15",
    exitCapRatePct: "0.05",
    salesClosingCostPct: "0.04",
    salesAbsorptionMonths: 15,
    parkingRevenuePerSpaceMonth: "95",
    parkingSalePricePerSpace: "18000",
  },
  [AssumptionProfileKey.AGGRESSIVE]: {
    profileKey: AssumptionProfileKey.AGGRESSIVE,
    planningBufferPct: "0.02",
    efficiencyFactorPct: "0.85",
    vacancyPct: "0.02",
    operatingCostPerNlaSqmYear: "15",
    acquisitionClosingCostPct: "0.025",
    contingencyPct: "0.04",
    developerFeePct: "0.035",
    targetProfitPct: "0.1",
    exitCapRatePct: "0.04",
    salesClosingCostPct: "0.025",
    salesAbsorptionMonths: 9,
    parkingRevenuePerSpaceMonth: "125",
    parkingSalePricePerSpace: "26000",
  },
  [AssumptionProfileKey.CUSTOM]: {
    profileKey: AssumptionProfileKey.CUSTOM,
    planningBufferPct: "0.05",
    efficiencyFactorPct: "0.82",
    vacancyPct: "0.04",
    operatingCostPerNlaSqmYear: "18",
    acquisitionClosingCostPct: "0.03",
    contingencyPct: "0.06",
    developerFeePct: "0.04",
    targetProfitPct: "0.12",
    exitCapRatePct: "0.045",
    salesClosingCostPct: "0.03",
    salesAbsorptionMonths: 12,
    parkingRevenuePerSpaceMonth: "110",
    parkingSalePricePerSpace: "22000",
  },
};

export function normalizeScenarioAssumptionOverrides(
  value: unknown,
): ScenarioAssumptionOverridesDto {
  const record = isRecord(value) ? value : {};

  return {
    planningBufferPct: nullableDecimalString(record.planningBufferPct),
    efficiencyFactorPct: nullableDecimalString(record.efficiencyFactorPct),
    vacancyPct: nullableDecimalString(record.vacancyPct),
    operatingCostPerNlaSqmYear: nullableDecimalString(record.operatingCostPerNlaSqmYear),
    acquisitionClosingCostPct: nullableDecimalString(record.acquisitionClosingCostPct),
    contingencyPct: nullableDecimalString(record.contingencyPct),
    developerFeePct: nullableDecimalString(record.developerFeePct),
    targetProfitPct: nullableDecimalString(record.targetProfitPct),
    exitCapRatePct: nullableDecimalString(record.exitCapRatePct),
    salesClosingCostPct: nullableDecimalString(record.salesClosingCostPct),
    salesAbsorptionMonths: nullableInteger(record.salesAbsorptionMonths),
    parkingRevenuePerSpaceMonth: nullableDecimalString(record.parkingRevenuePerSpaceMonth),
    parkingSalePricePerSpace: nullableDecimalString(record.parkingSalePricePerSpace),
  };
}

export function decodeScenarioAssumptionSet(value: unknown): ScenarioAssumptionSetDto | null {
  const record = isRecord(value) ? value : null;
  if (!record || !isProfileKey(record.profileKey)) return null;

  return {
    profileKey: record.profileKey,
    notes: typeof record.notes === "string" && record.notes.trim() ? record.notes.trim() : null,
    overrides: normalizeScenarioAssumptionOverrides(record.overrides),
  };
}

export function extractScenarioAssumptionSet(inputsJson: ScenarioInputsRecord | null | undefined) {
  const record = isRecord(inputsJson) ? inputsJson : null;
  return decodeScenarioAssumptionSet(record?.assumptionSet);
}

export function withScenarioAssumptionSet(
  inputsJson: ScenarioInputsRecord | null | undefined,
  assumptionSet: ScenarioAssumptionSetDto | null | undefined,
): ScenarioInputsRecord | null | undefined {
  if (assumptionSet === undefined) return inputsJson;

  const next = isRecord(inputsJson) ? { ...inputsJson } : {};

  if (assumptionSet === null) {
    delete next.assumptionSet;
  } else {
    next.assumptionSet = {
      profileKey: assumptionSet.profileKey,
      notes: assumptionSet.notes,
      overrides: normalizeScenarioAssumptionOverrides(assumptionSet.overrides),
    };
  }

  return Object.keys(next).length ? next : null;
}

export function getEffectiveScenarioAssumptions(
  assumptionSet: ScenarioAssumptionSetDto | null | undefined,
): ScenarioAssumptionEffectiveDto {
  const normalized = assumptionSet ?? {
    profileKey: AssumptionProfileKey.BASELINE,
    notes: null,
    overrides: emptyScenarioAssumptionOverrides(),
  };
  const profileDefaults = SCENARIO_ASSUMPTION_PROFILE_DEFAULTS[normalized.profileKey];
  const overrides = normalizeScenarioAssumptionOverrides(normalized.overrides);

  return {
    profileKey: normalized.profileKey,
    planningBufferPct: overrides.planningBufferPct ?? profileDefaults.planningBufferPct,
    efficiencyFactorPct: overrides.efficiencyFactorPct ?? profileDefaults.efficiencyFactorPct,
    vacancyPct: overrides.vacancyPct ?? profileDefaults.vacancyPct,
    operatingCostPerNlaSqmYear:
      overrides.operatingCostPerNlaSqmYear ?? profileDefaults.operatingCostPerNlaSqmYear,
    acquisitionClosingCostPct:
      overrides.acquisitionClosingCostPct ?? profileDefaults.acquisitionClosingCostPct,
    contingencyPct: overrides.contingencyPct ?? profileDefaults.contingencyPct,
    developerFeePct: overrides.developerFeePct ?? profileDefaults.developerFeePct,
    targetProfitPct: overrides.targetProfitPct ?? profileDefaults.targetProfitPct,
    exitCapRatePct: overrides.exitCapRatePct ?? profileDefaults.exitCapRatePct,
    salesClosingCostPct: overrides.salesClosingCostPct ?? profileDefaults.salesClosingCostPct,
    salesAbsorptionMonths:
      overrides.salesAbsorptionMonths ?? profileDefaults.salesAbsorptionMonths,
    parkingRevenuePerSpaceMonth:
      overrides.parkingRevenuePerSpaceMonth ?? profileDefaults.parkingRevenuePerSpaceMonth,
    parkingSalePricePerSpace:
      overrides.parkingSalePricePerSpace ?? profileDefaults.parkingSalePricePerSpace,
  };
}

export function decodeEffectiveScenarioAssumptions(
  value: unknown,
): ScenarioAssumptionEffectiveDto | null {
  const record = isRecord(value) ? value : null;
  if (!record || !isProfileKey(record.profileKey)) return null;

  const merged = getEffectiveScenarioAssumptions({
    profileKey: record.profileKey,
    notes: null,
    overrides: normalizeScenarioAssumptionOverrides(record),
  });

  return {
    profileKey: merged.profileKey,
    planningBufferPct: nullableDecimalString(record.planningBufferPct) ?? merged.planningBufferPct,
    efficiencyFactorPct: nullableDecimalString(record.efficiencyFactorPct) ?? merged.efficiencyFactorPct,
    vacancyPct: nullableDecimalString(record.vacancyPct) ?? merged.vacancyPct,
    operatingCostPerNlaSqmYear:
      nullableDecimalString(record.operatingCostPerNlaSqmYear) ?? merged.operatingCostPerNlaSqmYear,
    acquisitionClosingCostPct:
      nullableDecimalString(record.acquisitionClosingCostPct) ?? merged.acquisitionClosingCostPct,
    contingencyPct: nullableDecimalString(record.contingencyPct) ?? merged.contingencyPct,
    developerFeePct: nullableDecimalString(record.developerFeePct) ?? merged.developerFeePct,
    targetProfitPct: nullableDecimalString(record.targetProfitPct) ?? merged.targetProfitPct,
    exitCapRatePct: nullableDecimalString(record.exitCapRatePct) ?? merged.exitCapRatePct,
    salesClosingCostPct: nullableDecimalString(record.salesClosingCostPct) ?? merged.salesClosingCostPct,
    salesAbsorptionMonths: nullableInteger(record.salesAbsorptionMonths) ?? merged.salesAbsorptionMonths,
    parkingRevenuePerSpaceMonth:
      nullableDecimalString(record.parkingRevenuePerSpaceMonth) ?? merged.parkingRevenuePerSpaceMonth,
    parkingSalePricePerSpace:
      nullableDecimalString(record.parkingSalePricePerSpace) ?? merged.parkingSalePricePerSpace,
  };
}
