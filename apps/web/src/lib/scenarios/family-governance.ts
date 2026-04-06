import { ScenarioGovernanceStatus, type ParcelDto, type ScenarioDto } from "@repo/contracts";
import { strategyTypeLabels } from "@/lib/ui/enum-labels";

export type SuggestedLeadReason =
  | "CURRENT_BEST"
  | "ONLY_ACTIVE_CANDIDATE"
  | "LATEST_RUN"
  | "LATEST_ACTIVE_VARIANT"
  | "LATEST_DRAFT"
  | "LATEST_ACTIVITY";

export type FamilyHealthStatus = "HEALTHY" | "NO_LEAD" | "TOO_MANY_ACTIVE" | "DRAFT_ONLY";

export interface ScenarioFamilyGovernanceSummary {
  familyKey: string;
  familyLabel: string;
  leadScenario: ScenarioDto;
  leadReason: "CURRENT_BEST" | "LATEST_CANDIDATE" | "LATEST_DRAFT" | "LATEST_ACTIVITY";
  scenarios: ScenarioDto[];
  groupedSiteAnchor: boolean;
  anchorLabel: string;
  olderActiveVariantIds: string[];
  activeCandidateCount: number;
  draftCount: number;
  archivedCount: number;
  suggestedLeadScenario: ScenarioDto;
  suggestedLeadReason: SuggestedLeadReason;
  challengerScenario: ScenarioDto | null;
  challengerCount: number;
  explicitLeadExists: boolean;
  healthStatus: FamilyHealthStatus;
  healthTone: "success" | "warning" | "danger" | "neutral";
  healthLabel: string;
  healthDetail: string;
  resolutionArchiveVariantIds: string[];
}

export function isGroupedSite(parcel: ParcelDto | null | undefined) {
  return Boolean(parcel?.isGroupSite || parcel?.provenance?.trustMode === "GROUP_DERIVED");
}

export function getSiteAnchorLabel(parcel: ParcelDto | null | undefined) {
  if (!parcel) return "Unlinked";
  return parcel.name ?? parcel.cadastralId ?? "Unnamed site";
}

export function getSuggestedLeadReasonLabel(reason: SuggestedLeadReason) {
  switch (reason) {
    case "CURRENT_BEST":
      return "Already current lead";
    case "ONLY_ACTIVE_CANDIDATE":
      return "Only active candidate";
    case "LATEST_RUN":
      return "Latest run among active variants";
    case "LATEST_ACTIVE_VARIANT":
      return "Most recently updated active variant";
    case "LATEST_DRAFT":
      return "Most recent draft";
    case "LATEST_ACTIVITY":
    default:
      return "Latest activity in family";
  }
}

function getSuggestedLeadScenario(
  scenarios: ScenarioDto[],
  activeCandidates: ScenarioDto[],
  drafts: ScenarioDto[],
) {
  const explicitLead = activeCandidates.find((scenario) => scenario.isCurrentBest) ?? null;
  if (explicitLead) {
    return {
      scenario: explicitLead,
      reason: "CURRENT_BEST" as const,
    };
  }

  if (activeCandidates.length === 1) {
    return {
      scenario: activeCandidates[0],
      reason: "ONLY_ACTIVE_CANDIDATE" as const,
    };
  }

  const latestRunCandidate = [...activeCandidates]
    .filter((scenario) => Boolean(scenario.latestRunAt))
    .sort((left, right) => {
      const runDelta = new Date(right.latestRunAt ?? right.updatedAt).getTime() - new Date(left.latestRunAt ?? left.updatedAt).getTime();
      if (runDelta !== 0) return runDelta;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })[0] ?? null;

  if (latestRunCandidate) {
    return {
      scenario: latestRunCandidate,
      reason: "LATEST_RUN" as const,
    };
  }

  if (activeCandidates.length) {
    return {
      scenario: [...activeCandidates].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0],
      reason: "LATEST_ACTIVE_VARIANT" as const,
    };
  }

  if (drafts.length) {
    return {
      scenario: [...drafts].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0],
      reason: "LATEST_DRAFT" as const,
    };
  }

  return {
    scenario: [...scenarios].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0],
    reason: "LATEST_ACTIVITY" as const,
  };
}

function getFamilyHealth({
  activeCandidateCount,
  draftCount,
  explicitLeadExists,
  olderActiveVariantCount,
}: {
  activeCandidateCount: number;
  draftCount: number;
  explicitLeadExists: boolean;
  olderActiveVariantCount: number;
}) {
  if (activeCandidateCount === 0 && draftCount > 0) {
    return {
      status: "DRAFT_ONLY" as const,
      tone: "neutral" as const,
      label: "Draft family",
      detail: "This family is still exploratory. Promote a draft only when it becomes a real candidate.",
    };
  }

  if (!explicitLeadExists && activeCandidateCount >= 3) {
    return {
      status: "NO_LEAD" as const,
      tone: "danger" as const,
      label: "No lead / too many active",
      detail: `${activeCandidateCount} active variants are still competing without a current lead. Resolve this family before it gets noisier.`,
    };
  }

  if (!explicitLeadExists && activeCandidateCount > 0) {
    return {
      status: "NO_LEAD" as const,
      tone: "warning" as const,
      label: "No current lead",
      detail: "The family is in play, but nobody has marked which scenario the workspace is leaning toward.",
    };
  }

  if (olderActiveVariantCount >= 2) {
    return {
      status: "TOO_MANY_ACTIVE" as const,
      tone: "warning" as const,
      label: "Too many active variants",
      detail: `${olderActiveVariantCount} non-lead active variants are still cluttering the family. Keep a challenger if needed, but archive the rest.`,
    };
  }

  return {
    status: "HEALTHY" as const,
    tone: "success" as const,
    label: olderActiveVariantCount === 1 ? "Lead plus challenger" : "Healthy family",
    detail: olderActiveVariantCount === 1
      ? "The family has one clear lead and one active challenger still in play."
      : "The family has one clear lead and no extra active clutter.",
  };
}

export function buildScenarioFamilySummaries(scenarios: ScenarioDto[], parcelById: Map<string, ParcelDto>) {
  const families = new Map<string, ScenarioDto[]>();
  for (const scenario of scenarios) {
    const bucket = families.get(scenario.familyKey) ?? [];
    bucket.push(scenario);
    families.set(scenario.familyKey, bucket);
  }

  return Array.from(families.entries()).map(([familyKey, bucket]) => {
    const sorted = [...bucket].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
    const activeCandidates = sorted.filter((scenario) => scenario.governanceStatus === ScenarioGovernanceStatus.ACTIVE_CANDIDATE);
    const drafts = sorted.filter((scenario) => scenario.governanceStatus === ScenarioGovernanceStatus.DRAFT);
    const explicitLead = activeCandidates.find((scenario) => scenario.isCurrentBest) ?? null;
    const suggestedLead = getSuggestedLeadScenario(sorted, activeCandidates, drafts);
    const leadScenario = explicitLead ?? suggestedLead.scenario;
    const challengerScenario = activeCandidates.find((scenario) => scenario.id !== leadScenario.id) ?? null;
    const olderActiveVariantIds = activeCandidates.filter((scenario) => scenario.id !== leadScenario.id).map((scenario) => scenario.id);
    const health = getFamilyHealth({
      activeCandidateCount: activeCandidates.length,
      draftCount: drafts.length,
      explicitLeadExists: Boolean(explicitLead),
      olderActiveVariantCount: olderActiveVariantIds.length,
    });
    const linkedParcel = leadScenario.parcelId ? parcelById.get(leadScenario.parcelId) ?? null : null;

    return {
      familyKey,
      familyLabel: `${getSiteAnchorLabel(linkedParcel)} / ${strategyTypeLabels[leadScenario.strategyType]}`,
      leadScenario,
      leadReason: explicitLead
        ? "CURRENT_BEST"
        : activeCandidates.length
          ? "LATEST_CANDIDATE"
          : drafts.length
            ? "LATEST_DRAFT"
            : "LATEST_ACTIVITY",
      scenarios: sorted,
      groupedSiteAnchor: isGroupedSite(linkedParcel),
      anchorLabel: getSiteAnchorLabel(linkedParcel),
      olderActiveVariantIds,
      activeCandidateCount: activeCandidates.length,
      draftCount: drafts.length,
      archivedCount: sorted.filter((scenario) => scenario.governanceStatus === ScenarioGovernanceStatus.ARCHIVED).length,
      suggestedLeadScenario: suggestedLead.scenario,
      suggestedLeadReason: suggestedLead.reason,
      challengerScenario,
      challengerCount: olderActiveVariantIds.length,
      explicitLeadExists: Boolean(explicitLead),
      healthStatus: health.status,
      healthTone: health.tone,
      healthLabel: health.label,
      healthDetail: health.detail,
      resolutionArchiveVariantIds: activeCandidates.filter((scenario) => scenario.id !== suggestedLead.scenario.id).map((scenario) => scenario.id),
    } satisfies ScenarioFamilyGovernanceSummary;
  }).sort((left, right) => {
    const anchorRank = Number(right.groupedSiteAnchor) - Number(left.groupedSiteAnchor);
    if (anchorRank !== 0) return anchorRank;
    return new Date(right.leadScenario.updatedAt).getTime() - new Date(left.leadScenario.updatedAt).getTime();
  });
}

export function getLeadFirstComparisonDefaults(
  scenarios: ScenarioDto[],
  parcelById: Map<string, ParcelDto>,
) {
  const workingScenarios = scenarios.filter((scenario) => scenario.governanceStatus !== ScenarioGovernanceStatus.ARCHIVED);
  const familySummaries = buildScenarioFamilySummaries(workingScenarios, parcelById);
  const explicitLeadIds = familySummaries
    .map((family) => family.leadScenario)
    .filter((scenario) => scenario.isCurrentBest)
    .map((scenario) => scenario.id);

  if (explicitLeadIds.length >= 2) {
    return {
      scenarioIds: explicitLeadIds,
      source: "CURRENT_LEADS" as const,
      familySummaries,
    };
  }

  const familyLeadIds = familySummaries.map((family) => family.leadScenario.id);
  return {
    scenarioIds: familyLeadIds,
    source: "FAMILY_LEADS" as const,
    familySummaries,
  };
}
