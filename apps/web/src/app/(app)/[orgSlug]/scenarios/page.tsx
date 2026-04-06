import Link from "next/link";
import {
  OptimizationTarget,
  ScenarioGovernanceStatus,
  StrategyType,
  type ParcelDto,
  type ScenarioDto,
} from "@repo/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  StatusBadge,
  getReadinessTone,
  getScenarioGovernanceTone,
  getScenarioStatusTone,
} from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getScenarios } from "@/lib/api/scenarios";
import {
  humanizeTokenLabel,
  optimizationTargetLabels,
  scenarioGovernanceStatusLabels,
  scenarioStatusLabels,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";
import {
  archiveScenarioVariantsAction,
  resolveScenarioFamilyAction,
  setScenarioCurrentBestAction,
  setScenarioGovernanceAction,
} from "./actions";

type LifecycleScope = "WORKING" | "ALL" | ScenarioGovernanceStatus;
type AnchorScope = "ALL" | "GROUPED_SITE" | "STANDALONE" | "UNLINKED";
type VariantView = "LEADS" | "ALL";
type RunHistoryScope = "ANY" | "HAS_RUN" | "NO_RUN";
type FundingScope = "ANY" | "HAS_ENABLED" | "NO_ENABLED";
type SuggestedLeadReason =
  | "CURRENT_BEST"
  | "ONLY_ACTIVE_CANDIDATE"
  | "LATEST_RUN"
  | "LATEST_ACTIVE_VARIANT"
  | "LATEST_DRAFT"
  | "LATEST_ACTIVITY";
type FamilyHealthStatus = "HEALTHY" | "NO_LEAD" | "TOO_MANY_ACTIVE" | "DRAFT_ONLY";

type FamilySummary = {
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
};

function formatScenarioSignal(value: string | null) {
  if (!value) return "No run";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function isGroupedSite(parcel: ParcelDto | null | undefined) {
  return Boolean(parcel?.isGroupSite || parcel?.provenance?.trustMode === "GROUP_DERIVED");
}

function getSiteAnchorLabel(parcel: ParcelDto | null | undefined) {
  if (!parcel) return "Unlinked";
  return parcel.name ?? parcel.cadastralId ?? "Unnamed site";
}

function matchesScenarioQuery(scenario: ScenarioDto, linkedParcelName: string, query: string) {
  if (!query) return true;
  const haystack = [
    scenario.name,
    scenario.description ?? "",
    linkedParcelName,
    scenario.strategyType,
    scenario.optimizationTarget,
    scenario.assumptionSummary.templateName ?? "",
    scenario.assumptionSummary.profileKey,
  ].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function buildBoardHref(
  orgSlug: string,
  filters: {
    q?: string;
    lifecycle?: LifecycleScope;
    strategy?: StrategyType | "ALL";
    anchor?: AnchorScope;
    siteId?: string;
    variantView?: VariantView;
    runHistory?: RunHistoryScope;
    funding?: FundingScope;
  },
) {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.lifecycle && filters.lifecycle !== "WORKING") search.set("lifecycle", filters.lifecycle);
  if (filters.strategy && filters.strategy !== "ALL") search.set("strategy", filters.strategy);
  if (filters.anchor && filters.anchor !== "ALL") search.set("anchor", filters.anchor);
  if (filters.siteId && filters.siteId !== "ALL") search.set("siteId", filters.siteId);
  if (filters.variantView && filters.variantView !== "LEADS") search.set("variantView", filters.variantView);
  if (filters.runHistory && filters.runHistory !== "ANY") search.set("runHistory", filters.runHistory);
  if (filters.funding && filters.funding !== "ANY") search.set("funding", filters.funding);

  const searchString = search.toString();
  return searchString ? `/${orgSlug}/scenarios?${searchString}` : `/${orgSlug}/scenarios`;
}

function matchesLifecycleFilter(scenario: ScenarioDto, lifecycle: LifecycleScope) {
  if (lifecycle === "WORKING") return scenario.governanceStatus !== ScenarioGovernanceStatus.ARCHIVED;
  if (lifecycle === "ALL") return true;
  return scenario.governanceStatus === lifecycle;
}

function matchesAnchorFilter(
  scenario: ScenarioDto,
  linkedParcel: ParcelDto | null,
  anchorFilter: AnchorScope,
  selectedSiteId: string,
) {
  if (selectedSiteId !== "ALL" && scenario.parcelId !== selectedSiteId) return false;

  switch (anchorFilter) {
    case "GROUPED_SITE":
      return isGroupedSite(linkedParcel);
    case "STANDALONE":
      return Boolean(scenario.parcelId) && !isGroupedSite(linkedParcel);
    case "UNLINKED":
      return !scenario.parcelId;
    case "ALL":
    default:
      return true;
  }
}

function matchesRunHistoryFilter(scenario: ScenarioDto, runHistory: RunHistoryScope) {
  if (runHistory === "HAS_RUN") return Boolean(scenario.latestRunAt);
  if (runHistory === "NO_RUN") return !scenario.latestRunAt;
  return true;
}

function matchesFundingFilter(scenario: ScenarioDto, funding: FundingScope) {
  const enabledFundingCount = scenario.fundingVariants.filter((item) => item.isEnabled).length;
  if (funding === "HAS_ENABLED") return enabledFundingCount > 0;
  if (funding === "NO_ENABLED") return enabledFundingCount === 0;
  return true;
}

function getGovernanceNextAction(scenario: ScenarioDto) {
  if (scenario.governanceStatus === ScenarioGovernanceStatus.ARCHIVED) {
    return { label: "Archived reference", detail: "Kept outside the working set until restored.", tone: "surface" as const };
  }
  if (scenario.governanceStatus === ScenarioGovernanceStatus.DRAFT) {
    return { label: "Promote or refine", detail: "Still exploratory until it becomes a serious candidate.", tone: "neutral" as const };
  }
  if (scenario.isCurrentBest) {
    return { label: "Current lead", detail: "This is the scenario the workspace is currently leaning toward.", tone: "accent" as const };
  }
  return { label: "Active variant", detail: "Still in play, but not the lead case right now.", tone: "info" as const };
}

function getLeadReasonLabel(reason: FamilySummary["leadReason"]) {
  switch (reason) {
    case "CURRENT_BEST":
      return "Current best";
    case "LATEST_CANDIDATE":
      return "Latest candidate";
    case "LATEST_DRAFT":
      return "Latest draft";
    case "LATEST_ACTIVITY":
    default:
      return "Latest activity";
  }
}

function getSuggestedLeadReasonLabel(reason: SuggestedLeadReason) {
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

function formatFundingState(scenario: ScenarioDto) {
  const enabledFundingCount = scenario.fundingVariants.filter((item) => item.isEnabled).length;
  return enabledFundingCount ? `${enabledFundingCount} lane${enabledFundingCount === 1 ? "" : "s"} enabled` : "No active stack";
}

function formatAssumptionLine(scenario: ScenarioDto) {
  const templateLabel = scenario.assumptionSummary.templateName ?? humanizeTokenLabel(scenario.assumptionSummary.profileKey);
  const workspaceLabel = scenario.assumptionSummary.isWorkspaceDefault ? " / workspace default" : "";
  return `${templateLabel}${workspaceLabel}${scenario.assumptionSummary.overrideCount ? ` / ${scenario.assumptionSummary.overrideCount} override${scenario.assumptionSummary.overrideCount === 1 ? "" : "s"}` : ""}`;
}

function formatReadinessLine(scenario: ScenarioDto) {
  const snapshot = scenario.readinessSnapshot;
  if (!snapshot) return "Readiness not evaluated yet";
  const blockerLine = snapshot.executionBlockers
    ? `${snapshot.executionBlockers} execution blocker${snapshot.executionBlockers === 1 ? "" : "s"}`
    : snapshot.confidenceBlockers
      ? `${snapshot.confidenceBlockers} confidence blocker${snapshot.confidenceBlockers === 1 ? "" : "s"}`
      : `${snapshot.warningCount} warning${snapshot.warningCount === 1 ? "" : "s"}`;
  return `${humanizeTokenLabel(snapshot.status)} / ${blockerLine}`;
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

function sortScenariosForBoard(
  scenarios: ScenarioDto[],
  parcelById: Map<string, ParcelDto>,
  familySummariesByKey: Map<string, FamilySummary>,
) {
  return [...scenarios].sort((left, right) => {
    const leftParcel = left.parcelId ? parcelById.get(left.parcelId) ?? null : null;
    const rightParcel = right.parcelId ? parcelById.get(right.parcelId) ?? null : null;
    const leftFamily = familySummariesByKey.get(left.familyKey);
    const rightFamily = familySummariesByKey.get(right.familyKey);
    const anchorRank = Number(isGroupedSite(rightParcel)) - Number(isGroupedSite(leftParcel));
    if (anchorRank !== 0) return anchorRank;
    const leadRank = Number((rightFamily?.leadScenario.id ?? right.id) === right.id) - Number((leftFamily?.leadScenario.id ?? left.id) === left.id);
    if (leadRank !== 0) return leadRank;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function buildFamilySummaries(scenarios: ScenarioDto[], parcelById: Map<string, ParcelDto>) {
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
    } satisfies FamilySummary;
  }).sort((left, right) => {
    const anchorRank = Number(right.groupedSiteAnchor) - Number(left.groupedSiteAnchor);
    if (anchorRank !== 0) return anchorRank;
    return new Date(right.leadScenario.updatedAt).getTime() - new Date(left.leadScenario.updatedAt).getTime();
  });
}

export default async function ScenariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{
    error?: string;
    message?: string;
    q?: string;
    lifecycle?: LifecycleScope;
    strategy?: StrategyType | "ALL";
    anchor?: AnchorScope;
    siteId?: string;
    variantView?: VariantView;
    runHistory?: RunHistoryScope;
    funding?: FundingScope;
  }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const [scenarios, parcels] = await Promise.all([getScenarios(orgSlug), getParcels(orgSlug)]);
    const parcelById = new Map(parcels.items.map((parcel) => [parcel.id, parcel]));
    const searchQuery = resolvedSearchParams?.q?.trim() ?? "";
    const lifecycle = resolvedSearchParams?.lifecycle ?? "WORKING";
    const strategyFilter = resolvedSearchParams?.strategy ?? "ALL";
    const anchorFilter = resolvedSearchParams?.anchor ?? "ALL";
    const selectedSiteId = resolvedSearchParams?.siteId ?? "ALL";
    const variantView = lifecycle === ScenarioGovernanceStatus.ARCHIVED ? "ALL" : resolvedSearchParams?.variantView ?? "LEADS";
    const runHistory = resolvedSearchParams?.runHistory ?? "ANY";
    const funding = resolvedSearchParams?.funding ?? "ANY";
    const scenarioAnchors = parcels.items
      .filter((parcel) => parcel.isGroupSite || !parcel.parcelGroupId)
      .sort((left, right) => {
        const anchorRank = Number(isGroupedSite(right)) - Number(isGroupedSite(left));
        if (anchorRank !== 0) return anchorRank;
        return getSiteAnchorLabel(left).localeCompare(getSiteAnchorLabel(right));
      });

    const baseFilteredScenarios = [...scenarios.items].filter((scenario) => {
      const linkedParcel = scenario.parcelId ? parcelById.get(scenario.parcelId) ?? null : null;
      const linkedParcelName = linkedParcel?.name ?? linkedParcel?.cadastralId ?? "";
      return matchesLifecycleFilter(scenario, lifecycle)
        && (strategyFilter === "ALL" || scenario.strategyType === strategyFilter)
        && matchesAnchorFilter(scenario, linkedParcel, anchorFilter, selectedSiteId)
        && matchesRunHistoryFilter(scenario, runHistory)
        && matchesFundingFilter(scenario, funding)
        && matchesScenarioQuery(scenario, linkedParcelName, searchQuery);
    });

    const familySummaries = buildFamilySummaries(baseFilteredScenarios, parcelById);
    const familySummariesByKey = new Map(familySummaries.map((family) => [family.familyKey, family]));
    const unresolvedFamilies = familySummaries.filter((family) => family.healthStatus !== "HEALTHY");
    const filteredScenarios = sortScenariosForBoard(
      baseFilteredScenarios.filter((scenario) => {
        if (variantView !== "LEADS") return true;
        return familySummariesByKey.get(scenario.familyKey)?.leadScenario.id === scenario.id;
      }),
      parcelById,
      familySummariesByKey,
    );

    const groupedSiteAnchoredCount = scenarios.items.filter((scenario) => {
      const linkedParcel = scenario.parcelId ? parcelById.get(scenario.parcelId) ?? null : null;
      return isGroupedSite(linkedParcel);
    }).length;
    const activeCandidateCount = scenarios.items.filter((scenario) => scenario.governanceStatus === ScenarioGovernanceStatus.ACTIVE_CANDIDATE).length;
    const draftCount = scenarios.items.filter((scenario) => scenario.governanceStatus === ScenarioGovernanceStatus.DRAFT).length;
    const archivedCount = scenarios.items.filter((scenario) => scenario.governanceStatus === ScenarioGovernanceStatus.ARCHIVED).length;
    const currentBestCount = scenarios.items.filter((scenario) => scenario.isCurrentBest).length;
    const withRunHistory = scenarios.items.filter((scenario) => scenario.latestRunAt).length;
    const withFundingEnabled = scenarios.items.filter((scenario) => scenario.fundingVariants.some((item) => item.isEnabled)).length;
    const workspaceGroupedSiteCount = parcels.items.filter((parcel) => isGroupedSite(parcel)).length;
    const groupedSiteAnchorGap = workspaceGroupedSiteCount > 0 && groupedSiteAnchoredCount === 0;
    const healthyFamilyCount = familySummaries.length - unresolvedFamilies.length;
    const filterHref = buildBoardHref(orgSlug, {
      q: searchQuery,
      lifecycle,
      strategy: strategyFilter,
      anchor: anchorFilter,
      siteId: selectedSiteId,
      variantView,
      runHistory,
      funding,
    });

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario workspace"
          title="Governed scenario board"
          description="Keep live candidates visible, cluster variants into families, and move superseded cases out of the default working set."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{scenarios.total} total cases</span>
              <span className="meta-chip">{activeCandidateCount} active candidate{activeCandidateCount === 1 ? "" : "s"}</span>
              <span className="meta-chip">{draftCount} draft{draftCount === 1 ? "" : "s"}</span>
              <span className="meta-chip">{archivedCount} archived</span>
              <span className="meta-chip">{currentBestCount} current lead{currentBestCount === 1 ? "" : "s"}</span>
              <span className="meta-chip">{groupedSiteAnchoredCount} grouped-site anchored</span>
              <span className="meta-chip">{withRunHistory} with run history</span>
            </div>
          )}
          actions={(
            <>
              <Link className={buttonClasses()} href={`/${orgSlug}/scenarios/new`}>
                New scenario
              </Link>
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios/compare`}>
                Compare
              </Link>
            </>
          )}
        />

        {resolvedSearchParams?.error === "status-request-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Scenario governance update failed</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The scenario board could not save that governance change. Try again after the workspace refreshes."}</AlertDescription>
          </Alert>
        ) : null}

        {groupedSiteAnchorGap ? (
          <Alert tone="warning">
            <AlertTitle>Grouped sites exist, but scenarios are still not using them</AlertTitle>
            <AlertDescription>
              The workspace already has {workspaceGroupedSiteCount} grouped site{workspaceGroupedSiteCount === 1 ? "" : "s"}, but no scenarios are anchored to them yet.
              Move new analysis onto grouped sites so site-level scenario families become the normal working model.
            </AlertDescription>
          </Alert>
        ) : null}

        {unresolvedFamilies.length ? (
          <Alert tone={unresolvedFamilies.some((family) => family.healthTone === "danger") ? "danger" : "warning"}>
            <AlertTitle>{unresolvedFamilies.length} family{unresolvedFamilies.length === 1 ? "" : "ies"} need governance resolution</AlertTitle>
            <AlertDescription>
              Lead-first working view is active, but these families still need an explicit lead and/or active-variant cleanup before the workspace will feel disciplined.
            </AlertDescription>
          </Alert>
        ) : null}

        <SectionCard
          className="index-surface index-surface--workspace"
          eyebrow="Governance posture"
          title="Working set over flat list"
          description="The default board view surfaces family leads and hides archived noise until you explicitly ask for it."
        >
          <div className="ops-summary-grid">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Family leads</div>
              <div className="ops-summary-item__value">{familySummaries.filter((family) => family.leadScenario.isCurrentBest).length}</div>
              <div className="ops-summary-item__detail">Explicit current-best scenarios across site-strategy families.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Healthy families</div>
              <div className="ops-summary-item__value">{healthyFamilyCount}</div>
              <div className="ops-summary-item__detail">Families with a clear lead and controlled active clutter.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Working families</div>
              <div className="ops-summary-item__value">{familySummaries.length}</div>
              <div className="ops-summary-item__detail">Families visible under the current lifecycle and filter scope.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Needs resolution</div>
              <div className="ops-summary-item__value">{unresolvedFamilies.length}</div>
              <div className="ops-summary-item__detail">Families still missing a clear lead or carrying too many active variants.</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Board controls"
          title="Filter the working set"
          description="Search by site, strategy, lifecycle, funding posture, or run history. The default view shows working-family leads so superseded variants stop crowding the board."
          size="compact"
        >
          <form method="get" action={`/${orgSlug}/scenarios`} className="content-stack">
            <div className="field-grid field-grid--quad">
              <div className="field-stack">
                <Label htmlFor="q">Search</Label>
                <Input id="q" name="q" defaultValue={searchQuery} placeholder="Scenario name, site, template..." />
              </div>

              <div className="field-stack">
                <Label htmlFor="lifecycle">Lifecycle</Label>
                <select id="lifecycle" name="lifecycle" defaultValue={lifecycle} className="ui-select">
                  <option value="WORKING">Working set</option>
                  <option value="ALL">All scenarios</option>
                  {Object.values(ScenarioGovernanceStatus).map((value) => (
                    <option key={value} value={value}>{scenarioGovernanceStatusLabels[value]}</option>
                  ))}
                </select>
              </div>

              <div className="field-stack">
                <Label htmlFor="strategy">Strategy</Label>
                <select id="strategy" name="strategy" defaultValue={strategyFilter} className="ui-select">
                  <option value="ALL">All strategies</option>
                  {Object.values(StrategyType).map((value) => (
                    <option key={value} value={value}>{strategyTypeLabels[value]}</option>
                  ))}
                </select>
              </div>

              <div className="field-stack">
                <Label htmlFor="anchor">Anchor type</Label>
                <select id="anchor" name="anchor" defaultValue={anchorFilter} className="ui-select">
                  <option value="ALL">All anchors</option>
                  <option value="GROUPED_SITE">Grouped sites</option>
                  <option value="STANDALONE">Standalone parcels</option>
                  <option value="UNLINKED">Unlinked</option>
                </select>
              </div>

              <div className="field-stack">
                <Label htmlFor="siteId">Specific site</Label>
                <select id="siteId" name="siteId" defaultValue={selectedSiteId} className="ui-select">
                  <option value="ALL">All sites</option>
                  {scenarioAnchors.map((parcel) => (
                    <option key={parcel.id} value={parcel.id}>{getSiteAnchorLabel(parcel)}</option>
                  ))}
                </select>
              </div>

              <div className="field-stack">
                <Label htmlFor="runHistory">Run history</Label>
                <select id="runHistory" name="runHistory" defaultValue={runHistory} className="ui-select">
                  <option value="ANY">Any</option>
                  <option value="HAS_RUN">Has run history</option>
                  <option value="NO_RUN">No run history</option>
                </select>
              </div>

              <div className="field-stack">
                <Label htmlFor="funding">Funding</Label>
                <select id="funding" name="funding" defaultValue={funding} className="ui-select">
                  <option value="ANY">Any</option>
                  <option value="HAS_ENABLED">Has enabled funding</option>
                  <option value="NO_ENABLED">No enabled funding</option>
                </select>
              </div>

              <div className="field-stack">
                <Label htmlFor="variantView">Variant view</Label>
                <select id="variantView" name="variantView" defaultValue={variantView} className="ui-select">
                  <option value="LEADS">Family leads only</option>
                  <option value="ALL">All variants</option>
                </select>
              </div>
            </div>

            <div className="action-row">
              <button type="submit" className={buttonClasses()}>Apply filters</button>
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                Clear filters
              </Link>
              <span className="field-help">{filteredScenarios.length} scenario{filteredScenarios.length === 1 ? "" : "s"} match the current board view.</span>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          eyebrow="Family resolution"
          title="Unhealthy families needing a decision"
          description="Use this queue to adopt a lead, keep one challenger if needed, and archive uncontrolled active clutter. Suggestions are advisory and based on the current family evidence."
        >
          {unresolvedFamilies.length ? (
            <div className="content-stack">
              {unresolvedFamilies.map((family) => {
                const suggestedScenario = family.suggestedLeadScenario;
                const suggestedLinkedParcel = suggestedScenario.parcelId ? parcelById.get(suggestedScenario.parcelId) ?? null : null;
                const adoptSuggestedLeadAction = setScenarioCurrentBestAction.bind(null, orgSlug, suggestedScenario.id, filterHref);
                const archiveOlderAction = archiveScenarioVariantsAction.bind(null, orgSlug, filterHref);
                const resolveAction = resolveScenarioFamilyAction.bind(null, orgSlug, filterHref);

                return (
                  <div key={`resolution-${family.familyKey}`} className="ops-table__row ops-table__row--parcels">
                    <div className="ops-table__cell">
                      <div className="list-row__body">
                        <div className="list-row__title">
                          <span className="list-row__title-text">{family.familyLabel}</span>
                          <StatusBadge tone={family.healthTone}>{family.healthLabel}</StatusBadge>
                          <StatusBadge tone={family.groupedSiteAnchor ? "accent" : "surface"}>
                            {family.groupedSiteAnchor ? "Grouped-site family" : "Parcel family"}
                          </StatusBadge>
                        </div>
                        <div className="inline-meta">
                          <span className="meta-chip">{family.anchorLabel}</span>
                          <span className="meta-chip">{optimizationTargetLabels[suggestedScenario.optimizationTarget]}</span>
                          <span className="meta-chip">{family.activeCandidateCount} active candidate{family.activeCandidateCount === 1 ? "" : "s"}</span>
                          {family.challengerCount ? <span className="meta-chip">{family.challengerCount} challenger{family.challengerCount === 1 ? "" : "s"}</span> : null}
                        </div>
                        <div className="list-row__meta list-row__meta--clamped">{family.healthDetail}</div>
                      </div>
                    </div>

                    <div className="ops-table__cell">
                      <div className="ops-cell-stack">
                        <div className="ops-scan__label">Suggested lead</div>
                        <div className="ops-scan__value">{suggestedScenario.name}</div>
                        <div className="ops-scan__detail">
                          {getSuggestedLeadReasonLabel(family.suggestedLeadReason)} / {formatReadinessLine(suggestedScenario)}
                        </div>
                        <div className="ops-scan__detail">{formatAssumptionLine(suggestedScenario)}</div>
                      </div>
                    </div>

                    <div className="ops-table__cell">
                      <div className="ops-cell-stack">
                        <div className="ops-scan__label">Challenger posture</div>
                        <div className="ops-scan__value">
                          {family.challengerScenario ? family.challengerScenario.name : family.draftCount ? `${family.draftCount} draft variant${family.draftCount === 1 ? "" : "s"}` : "No active challenger"}
                        </div>
                        <div className="ops-scan__detail">
                          {family.challengerScenario
                            ? `${formatReadinessLine(family.challengerScenario)} / keep in play only if it is still a real alternative.`
                            : "The family can be made cleaner without losing a live challenger."}
                        </div>
                      </div>
                    </div>

                    <div className="ops-table__actions ops-table__actions--dense">
                      <div className="action-row">
                        <Link className={buttonClasses({ size: "sm" })} href={`/${orgSlug}/scenarios/${suggestedScenario.id}/builder`}>
                          Review suggestion
                        </Link>
                        {suggestedLinkedParcel ? (
                          <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/parcels/${suggestedLinkedParcel.id}`}>
                            Open site
                          </Link>
                        ) : null}
                      </div>

                      <div className="action-row action-row--compact">
                        {!suggestedScenario.isCurrentBest ? (
                          <form action={adoptSuggestedLeadAction}>
                            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>Adopt suggested lead</button>
                          </form>
                        ) : null}
                        {family.resolutionArchiveVariantIds.length ? (
                          <form action={resolveAction}>
                            <input type="hidden" name="leadScenarioId" value={suggestedScenario.id} />
                            {family.resolutionArchiveVariantIds.map((scenarioId) => (
                              <input key={scenarioId} type="hidden" name="archiveScenarioId" value={scenarioId} />
                            ))}
                            <button type="submit" className={buttonClasses({ size: "sm" })}>
                              Resolve family
                            </button>
                          </form>
                        ) : null}
                        {family.olderActiveVariantIds.length ? (
                          <form action={archiveOlderAction}>
                            {family.olderActiveVariantIds.map((scenarioId) => (
                              <input key={scenarioId} type="hidden" name="scenarioId" value={scenarioId} />
                            ))}
                            <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm" })}>Archive non-lead actives</button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="field-help">
              Every visible family already has a clear lead and controlled active clutter. Use the family board below for routine monitoring.
            </div>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Scenario families"
          title="Lead cases by site and strategy"
          description="Families help the board answer which case is the real candidate, which ones are exploratory drafts, and which older variants can leave the working set."
        >
          {familySummaries.length ? (
            <div className="content-stack">
              {familySummaries.map((family) => {
                const leadScenario = family.leadScenario;
                const linkedParcel = leadScenario.parcelId ? parcelById.get(leadScenario.parcelId) ?? null : null;
                const nextAction = getGovernanceNextAction(leadScenario);
                const suggestedScenario = family.suggestedLeadScenario;
                const activateAction = setScenarioGovernanceAction.bind(
                  null,
                  orgSlug,
                  leadScenario.id,
                  ScenarioGovernanceStatus.ACTIVE_CANDIDATE,
                  filterHref,
                );
                const draftAction = setScenarioGovernanceAction.bind(
                  null,
                  orgSlug,
                  leadScenario.id,
                  ScenarioGovernanceStatus.DRAFT,
                  filterHref,
                );
                const archiveAction = setScenarioGovernanceAction.bind(
                  null,
                  orgSlug,
                  leadScenario.id,
                  ScenarioGovernanceStatus.ARCHIVED,
                  filterHref,
                );
                const makeLeadAction = setScenarioCurrentBestAction.bind(null, orgSlug, leadScenario.id, filterHref);
                const adoptSuggestedLeadAction = setScenarioCurrentBestAction.bind(null, orgSlug, suggestedScenario.id, filterHref);
                const archiveOlderAction = archiveScenarioVariantsAction.bind(null, orgSlug, filterHref);
                const resolveAction = resolveScenarioFamilyAction.bind(null, orgSlug, filterHref);

                return (
                  <div key={family.familyKey} className="ops-table__row ops-table__row--parcels">
                    <div className="ops-table__cell">
                      <div className="list-row__body">
                        <div className="list-row__title">
                          <span className="list-row__title-text">{family.familyLabel}</span>
                          <StatusBadge tone={family.groupedSiteAnchor ? "accent" : "surface"}>
                            {family.groupedSiteAnchor ? "Grouped-site family" : "Parcel family"}
                          </StatusBadge>
                          <StatusBadge tone={family.healthTone}>{family.healthLabel}</StatusBadge>
                          <StatusBadge tone={getScenarioGovernanceTone(leadScenario.governanceStatus)}>
                            {scenarioGovernanceStatusLabels[leadScenario.governanceStatus]}
                          </StatusBadge>
                          {leadScenario.isCurrentBest ? <StatusBadge tone="accent">Current lead</StatusBadge> : null}
                        </div>
                        <div className="inline-meta">
                          <span className="meta-chip">{family.anchorLabel}</span>
                          <span className="meta-chip">{optimizationTargetLabels[leadScenario.optimizationTarget]}</span>
                          <span className="meta-chip">{getLeadReasonLabel(family.leadReason)}</span>
                          <span className="meta-chip">v{leadScenario.familyVersion}</span>
                        </div>
                        <div className="list-row__meta list-row__meta--clamped">
                          {leadScenario.name} / {formatAssumptionLine(leadScenario)} / {formatReadinessLine(leadScenario)}
                        </div>
                        {!family.explicitLeadExists ? (
                          <div className="list-row__meta list-row__meta--clamped">
                            Suggested lead: {suggestedScenario.name} / {getSuggestedLeadReasonLabel(family.suggestedLeadReason)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="ops-table__cell">
                      <div className="ops-cell-stack">
                        <div className="ops-scan__label">Family posture</div>
                        <div className="action-row">
                          <StatusBadge tone={nextAction.tone}>{nextAction.label}</StatusBadge>
                        </div>
                        <div className="ops-scan__detail">{family.healthDetail}</div>
                      </div>
                    </div>

                    <div className="ops-table__cell">
                      <div className="ops-cell-stack">
                        <div className="ops-scan__label">Variants</div>
                        <div className="ops-scan__value">
                          {family.activeCandidateCount} active / {family.draftCount} draft / {family.archivedCount} archived
                        </div>
                        <div className="ops-scan__detail">
                          {family.olderActiveVariantIds.length
                            ? `${family.olderActiveVariantIds.length} non-lead active variant${family.olderActiveVariantIds.length === 1 ? "" : "s"} still add clutter to this family.`
                            : family.challengerScenario
                              ? `One challenger remains active: ${family.challengerScenario.name}.`
                              : "No extra active variants competing with the family lead right now."}
                        </div>
                      </div>
                    </div>

                    <div className="ops-table__actions ops-table__actions--dense">
                      <div className="action-row">
                        <Link className={buttonClasses({ size: "sm" })} href={`/${orgSlug}/scenarios/${leadScenario.id}/builder`}>
                          Open lead
                        </Link>
                        {linkedParcel ? (
                          <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/parcels/${linkedParcel.id}`}>
                            Open site
                          </Link>
                        ) : null}
                      </div>

                      <div className="action-row action-row--compact">
                        {leadScenario.governanceStatus !== ScenarioGovernanceStatus.ACTIVE_CANDIDATE ? (
                          <form action={activateAction}>
                            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>Activate</button>
                          </form>
                        ) : null}
                        {!leadScenario.isCurrentBest ? (
                          <form action={makeLeadAction}>
                            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>Make lead</button>
                          </form>
                        ) : null}
                        {!family.explicitLeadExists && suggestedScenario.id !== leadScenario.id ? (
                          <form action={adoptSuggestedLeadAction}>
                            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>Adopt suggestion</button>
                          </form>
                        ) : null}
                        {leadScenario.governanceStatus !== ScenarioGovernanceStatus.DRAFT ? (
                          <form action={draftAction}>
                            <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm" })}>Move to draft</button>
                          </form>
                        ) : null}
                        {leadScenario.governanceStatus !== ScenarioGovernanceStatus.ARCHIVED ? (
                          <form action={archiveAction}>
                            <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm" })}>Archive</button>
                          </form>
                        ) : null}
                        {family.olderActiveVariantIds.length ? (
                          <form action={archiveOlderAction}>
                            {family.olderActiveVariantIds.map((scenarioId) => (
                              <input key={scenarioId} type="hidden" name="scenarioId" value={scenarioId} />
                            ))}
                            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>Archive non-lead actives</button>
                          </form>
                        ) : null}
                        {!family.explicitLeadExists && family.resolutionArchiveVariantIds.length ? (
                          <form action={resolveAction}>
                            <input type="hidden" name="leadScenarioId" value={suggestedScenario.id} />
                            {family.resolutionArchiveVariantIds.map((scenarioId) => (
                              <input key={scenarioId} type="hidden" name="archiveScenarioId" value={scenarioId} />
                            ))}
                            <button type="submit" className={buttonClasses({ size: "sm" })}>Resolve family</button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              eyebrow="No families in view"
              title="No scenario families match the current filter scope"
              description="Widen the lifecycle or site filters, or create a new scenario family from a parcel or grouped site."
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/scenarios/new`}>
                    Create scenario
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                    Reset board
                  </Link>
                </>
              )}
            />
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Filtered scenarios"
          title="Scenario rows"
          description="Use the full row list when you need to inspect individual variants, not just the family leads."
        >
          {filteredScenarios.length ? (
            <div className="ops-table">
              <div className="ops-table__header ops-table__header--parcels">
                <div>Scenario</div>
                <div>Anchor</div>
                <div>Assumptions</div>
                <div>Readiness and funding</div>
                <div>Actions</div>
              </div>

              {filteredScenarios.map((scenario) => {
                const linkedParcel = scenario.parcelId ? parcelById.get(scenario.parcelId) ?? null : null;
                const family = familySummariesByKey.get(scenario.familyKey) ?? null;
                const isFamilyLead = family?.leadScenario.id === scenario.id;
                const isSuggestedLead = family?.suggestedLeadScenario.id === scenario.id;
                const activateAction = setScenarioGovernanceAction.bind(
                  null,
                  orgSlug,
                  scenario.id,
                  ScenarioGovernanceStatus.ACTIVE_CANDIDATE,
                  filterHref,
                );
                const draftAction = setScenarioGovernanceAction.bind(
                  null,
                  orgSlug,
                  scenario.id,
                  ScenarioGovernanceStatus.DRAFT,
                  filterHref,
                );
                const archiveAction = setScenarioGovernanceAction.bind(
                  null,
                  orgSlug,
                  scenario.id,
                  ScenarioGovernanceStatus.ARCHIVED,
                  filterHref,
                );
                const makeLeadAction = setScenarioCurrentBestAction.bind(null, orgSlug, scenario.id, filterHref);

                return (
                  <div key={scenario.id} className="ops-table__row ops-table__row--parcels">
                    <div className="ops-table__cell">
                      <div className="list-row__body">
                        <div className="list-row__title">
                          <span className="list-row__title-text">{scenario.name}</span>
                          <StatusBadge tone={getScenarioGovernanceTone(scenario.governanceStatus)}>
                            {scenarioGovernanceStatusLabels[scenario.governanceStatus]}
                          </StatusBadge>
                          <StatusBadge tone={getScenarioStatusTone(scenario.status)}>
                            {scenarioStatusLabels[scenario.status]}
                          </StatusBadge>
                          {scenario.isCurrentBest ? <StatusBadge tone="accent">Current lead</StatusBadge> : null}
                          {!scenario.isCurrentBest && isFamilyLead ? <StatusBadge tone="info">Family lead</StatusBadge> : null}
                          {!scenario.isCurrentBest && !isFamilyLead && isSuggestedLead ? <StatusBadge tone="warning">Suggested lead</StatusBadge> : null}
                          {family && family.healthStatus !== "HEALTHY" ? <StatusBadge tone={family.healthTone}>{family.healthLabel}</StatusBadge> : null}
                        </div>
                        <div className="inline-meta">
                          <span className="meta-chip">v{scenario.familyVersion}</span>
                          <span className="meta-chip">{strategyTypeLabels[scenario.strategyType]}</span>
                          <span className="meta-chip">{optimizationTargetLabels[scenario.optimizationTarget]}</span>
                          <span className="meta-chip">Latest run {formatScenarioSignal(scenario.latestRunAt)}</span>
                        </div>
                        <div className="list-row__meta list-row__meta--clamped">
                          {isSuggestedLead && family && !family.explicitLeadExists
                            ? `Advisory lead suggestion / ${getSuggestedLeadReasonLabel(family.suggestedLeadReason)}`
                            : getGovernanceNextAction(scenario).detail}
                        </div>
                      </div>
                    </div>

                    <div className="ops-table__cell">
                      <div className="ops-cell-stack">
                        <div className="ops-scan__label">Site anchor</div>
                        <div className="ops-scan__value">{getSiteAnchorLabel(linkedParcel)}</div>
                        <div className="ops-scan__detail">
                          {linkedParcel
                            ? isGroupedSite(linkedParcel)
                              ? "Grouped-site anchor"
                              : "Standalone parcel anchor"
                            : "Parcel link missing"}
                        </div>
                      </div>
                    </div>

                    <div className="ops-table__cell">
                      <div className="ops-cell-stack">
                        <div className="ops-scan__label">Template</div>
                        <div className="ops-scan__value">{scenario.assumptionSummary.templateName ?? humanizeTokenLabel(scenario.assumptionSummary.profileKey)}</div>
                        <div className="ops-scan__detail">{formatAssumptionLine(scenario)}</div>
                      </div>
                    </div>

                    <div className="ops-table__cell">
                      <div className="ops-cell-stack">
                        <div className="ops-scan__label">Readiness</div>
                        <div className="action-row">
                          <StatusBadge tone={getReadinessTone(scenario.readinessSnapshot?.status ?? null)}>
                            {scenario.readinessSnapshot ? humanizeTokenLabel(scenario.readinessSnapshot.status) : "Not checked"}
                          </StatusBadge>
                        </div>
                        <div className="ops-scan__detail">{formatReadinessLine(scenario)} / {formatFundingState(scenario)}</div>
                      </div>
                    </div>

                    <div className="ops-table__actions ops-table__actions--dense">
                      <div className="action-row action-row--compact">
                        <Link className={buttonClasses({ size: "sm" })} href={`/${orgSlug}/scenarios/${scenario.id}/builder`}>
                          Open
                        </Link>
                        {scenario.governanceStatus !== ScenarioGovernanceStatus.ACTIVE_CANDIDATE ? (
                          <form action={activateAction}>
                            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>Activate</button>
                          </form>
                        ) : null}
                        {!scenario.isCurrentBest ? (
                          <form action={makeLeadAction}>
                            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>Make lead</button>
                          </form>
                        ) : null}
                        {scenario.governanceStatus !== ScenarioGovernanceStatus.DRAFT ? (
                          <form action={draftAction}>
                            <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm" })}>Draft</button>
                          </form>
                        ) : null}
                        {scenario.governanceStatus !== ScenarioGovernanceStatus.ARCHIVED ? (
                          <form action={archiveAction}>
                            <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm" })}>Archive</button>
                          </form>
                        ) : (
                          <form action={draftAction}>
                            <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm" })}>Restore</button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              eyebrow="No scenarios"
              title="No scenarios match the current board filters"
              description="Relax the lifecycle or anchor filters, or create a new scenario from a parcel or grouped site."
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/scenarios/new`}>
                    Create scenario
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                    Reset board
                  </Link>
                </>
              )}
            />
          )}
        </SectionCard>
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Scenarios unavailable"
          description="Scenario data could not be loaded because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
