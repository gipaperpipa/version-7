import {
  CORE_PLANNING_KEY_SLUGS,
  PlanningParameterKey,
  PlanningParameterType,
} from "@repo/contracts";

export type PlanningFieldSection = "Buildability" | "Capacity" | "Policy";
export type PlanningFieldInputKind = "number" | "tri-state" | "readonly";
export type PlanningFieldStorageKind = "valueNumber" | "valueBoolean" | "readonlyValueNumber";

export interface PlanningFieldDefinition {
  keySlug: PlanningParameterKey;
  label: string;
  unit: string | null;
  helpText: string;
  affectsReadiness: boolean;
  readinessUsageLabel: string | null;
  section: PlanningFieldSection;
  inputKind: PlanningFieldInputKind;
  storageKind: PlanningFieldStorageKind;
  parameterType: PlanningParameterType;
}

export const sprint1PlanningFieldDefinitions: PlanningFieldDefinition[] = [
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.GRZ,
    label: "Site Coverage Ratio (GRZ)",
    unit: "ratio",
    helpText: "Max footprint as a share of parcel area.",
    affectsReadiness: true,
    readinessUsageLabel: "Used in readiness checks",
    section: "Buildability",
    inputKind: "number",
    storageKind: "valueNumber",
    parameterType: PlanningParameterType.NUMBER,
  },
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.GFZ,
    label: "Floor Area Ratio (GFZ)",
    unit: "ratio",
    helpText: "Caps total buildable gross floor area relative to parcel size.",
    affectsReadiness: true,
    readinessUsageLabel: "Used in readiness checks",
    section: "Buildability",
    inputKind: "number",
    storageKind: "valueNumber",
    parameterType: PlanningParameterType.NUMBER,
  },
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.MAX_BGF_SQM,
    label: "Max Gross Floor Area",
    unit: "sqm",
    helpText: "Absolute cap on buildable BGF if known.",
    affectsReadiness: true,
    readinessUsageLabel: "Used by feasibility v0",
    section: "Buildability",
    inputKind: "number",
    storageKind: "valueNumber",
    parameterType: PlanningParameterType.NUMBER,
  },
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.MAX_HEIGHT_M,
    label: "Max Building Height",
    unit: "m",
    helpText: "Used with floors and GFZ to cap buildable volume.",
    affectsReadiness: true,
    readinessUsageLabel: "Used by feasibility v0",
    section: "Buildability",
    inputKind: "number",
    storageKind: "valueNumber",
    parameterType: PlanningParameterType.NUMBER,
  },
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.MAX_FLOORS,
    label: "Max Floors",
    unit: "floors",
    helpText: "Upper limit on effective floors when height is absent or permissive.",
    affectsReadiness: true,
    readinessUsageLabel: "Used by feasibility v0",
    section: "Buildability",
    inputKind: "number",
    storageKind: "valueNumber",
    parameterType: PlanningParameterType.NUMBER,
  },
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.MAX_UNITS,
    label: "Max Units",
    unit: "units",
    helpText: "Optional unit-count ceiling for feasibility output.",
    affectsReadiness: false,
    readinessUsageLabel: null,
    section: "Capacity",
    inputKind: "number",
    storageKind: "valueNumber",
    parameterType: PlanningParameterType.NUMBER,
  },
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.PARKING_SPACES_PER_UNIT,
    label: "Parking Spaces per Unit",
    unit: "spaces/unit",
    helpText: "Overrides the Sprint 1 parking fallback.",
    affectsReadiness: false,
    readinessUsageLabel: null,
    section: "Capacity",
    inputKind: "number",
    storageKind: "valueNumber",
    parameterType: PlanningParameterType.NUMBER,
  },
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.SUBSIDY_ELIGIBILITY,
    label: "Subsidy Eligibility",
    unit: null,
    helpText: "Marks whether the planning context supports subsidy assumptions.",
    affectsReadiness: false,
    readinessUsageLabel: null,
    section: "Policy",
    inputKind: "tri-state",
    storageKind: "valueBoolean",
    parameterType: PlanningParameterType.BOOLEAN,
  },
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.RENT_CAP_EUR_SQM,
    label: "Rent Cap",
    unit: "EUR/sqm",
    helpText: "Planning or subsidy rent ceiling if known.",
    affectsReadiness: false,
    readinessUsageLabel: null,
    section: "Policy",
    inputKind: "number",
    storageKind: "valueNumber",
    parameterType: PlanningParameterType.NUMBER,
  },
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.LOAN_CAP_PCT,
    label: "Loan Cap",
    unit: "%",
    helpText: "Loan percentage ceiling if constrained by policy or program context.",
    affectsReadiness: false,
    readinessUsageLabel: null,
    section: "Policy",
    inputKind: "number",
    storageKind: "valueNumber",
    parameterType: PlanningParameterType.NUMBER,
  },
  {
    keySlug: CORE_PLANNING_KEY_SLUGS.BUILDABLE_WINDOW,
    label: "Buildable Window Area",
    unit: "sqm",
    helpText: "Geometry-backed planning input. GIS editing stays out of Sprint 1 web scope.",
    affectsReadiness: true,
    readinessUsageLabel: "Used in readiness checks",
    section: "Buildability",
    inputKind: "readonly",
    storageKind: "readonlyValueNumber",
    parameterType: PlanningParameterType.GEOMETRY,
  },
];
