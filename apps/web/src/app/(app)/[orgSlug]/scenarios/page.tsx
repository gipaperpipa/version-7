import Link from "next/link";
import { OptimizationTarget, ScenarioStatus, StrategyType, type ParcelDto, type ScenarioDto } from "@repo/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, getScenarioStatusTone } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getScenarios } from "@/lib/api/scenarios";
import {
  humanizeTokenLabel,
  optimizationTargetLabels,
  scenarioStatusLabels,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";
import { archiveScenarioVariantsAction, setScenarioStatusAction } from "./actions";

type BoardScope = "ACTIVE" | "ARCHIVED" | "ALL";
type AnchorScope = "ALL" | "GROUPED_SITE" | "STANDALONE" | "UNLINKED";
type VariantView = "LEADS" | "ALL";

type FamilyScenarioStats = {
  familyKey: string;
  familyLabel: string;
  familySize: number;
  activeFamilySize: number;
  archivedFamilySize: number;
  isLead: boolean;
  olderActiveVariantIds: string[];
  groupedSiteAnchor: boolean;
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

function getScenarioFamilyKey(scenario: ScenarioDto) {
  const anchorKey = scenario.parcelGroupId ?? scenario.parcelId ?? "unlinked";
  return `${anchorKey}::${scenario.strategyType}::${scenario.acquisitionType}`;
}

function getScenarioNextAction(scenario: ScenarioDto) {
  if (!scenario.parcelId) {
    return { label: "Link parcel", detail: "Add a site anchor before treating the case as decision-ready.", tone: "warning" as const };
  }

  if (scenario.status === ScenarioStatus.READY) {
    return { label: "Run", detail: "Open builder and launch the next directional pass.", tone: "accent" as const };
  }

  if (scenario.status === ScenarioStatus.RUNNING) {
    return { label: "Monitor", detail: "A run is active. Re-open the builder once it clears.", tone: "info" as const };
  }

  if (scenario.status === ScenarioStatus.COMPLETED && scenario.latestRunAt) {
    return { label: "Review output", detail: "Open the builder and continue from the latest run context.", tone: "success" as const };
  }

  if (scenario.status === ScenarioStatus.FAILED) {
    return { label: "Fix and rerun", detail: "Return to the builder and correct the failing input path.", tone: "danger" as const };
  }

  if (scenario.status === ScenarioStatus.ARCHIVED) {
    return { label: "Archived", detail: "Kept for reference. Restore only if this version needs more work.", tone: "surface" as const };
  }

  return { label: "Continue setup", detail: "Finish framing the case, then move into funding and readiness.", tone: "neutral" as const };
}

function buildFamilyStats(scenarios: ScenarioDto[], parcelById: Map<string, ParcelDto>) {
  const families = new Map<string, ScenarioDto[]>();

  for (const scenario of scenarios) {
    const familyKey = getScenarioFamilyKey(scenario);
    const bucket = families.get(familyKey) ?? [];
    bucket.push(scenario);
    families.set(familyKey, bucket);
  }

  const familyStats = new Map<string, FamilyScenarioStats>();

  for (const [familyKey, bucket] of families.entries()) {
    const sorted = [...bucket].sort((left, right) => {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
    const activeSorted = sorted.filter((scenario) => scenario.status !== ScenarioStatus.ARCHIVED);
    const lead = activeSorted[0] ?? sorted[0];
    const linkedParcel = lead.parcelId ? parcelById.get(lead.parcelId) ?? null : null;
    const familyLabel = `${getSiteAnchorLabel(linkedParcel)} / ${strategyTypeLabels[lead.strategyType]}`;
    const olderActiveVariantIds = activeSorted.slice(1).map((scenario) => scenario.id);

    sorted.forEach((scenario) => {
      familyStats.set(scenario.id, {
        familyKey,
        familySize: sorted.length,
        activeFamilySize: activeSorted.length,
        archivedFamilySize: sorted.length - activeSorted.length,
        isLead: scenario.id === lead.id,
        familyLabel,
        olderActiveVariantIds,
        groupedSiteAnchor: isGroupedSite(linkedParcel),
      });
    });
  }

  return familyStats;
}

function matchesScenarioQuery(scenario: ScenarioDto, linkedParcelName: string, query: string) {
  if (!query) return true;
  const haystack = [
    scenario.name,
    scenario.description ?? "",
    linkedParcelName,
    scenario.strategyType,
    scenario.optimizationTarget,
  ].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function buildBoardHref(
  orgSlug: string,
  filters: {
    q?: string;
    scope?: BoardScope;
    strategy?: StrategyType | "ALL";
    anchor?: AnchorScope;
    siteId?: string;
    variantView?: VariantView;
  },
) {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.scope && filters.scope !== "ACTIVE") search.set("scope", filters.scope);
  if (filters.strategy && filters.strategy !== "ALL") search.set("strategy", filters.strategy);
  if (filters.anchor && filters.anchor !== "ALL") search.set("anchor", filters.anchor);
  if (filters.siteId && filters.siteId !== "ALL") search.set("siteId", filters.siteId);
  if (filters.variantView && filters.variantView !== "LEADS") search.set("variantView", filters.variantView);

  const searchString = search.toString();
  return searchString ? `/${orgSlug}/scenarios?${searchString}` : `/${orgSlug}/scenarios`;
}

function matchesAnchorFilter(
  scenario: ScenarioDto,
  linkedParcel: ParcelDto | null,
  anchorFilter: AnchorScope,
  selectedSiteId: string,
) {
  if (selectedSiteId !== "ALL" && scenario.parcelId !== selectedSiteId) {
    return false;
  }

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

export default async function ScenariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{
    error?: string;
    message?: string;
    q?: string;
    scope?: BoardScope;
    strategy?: StrategyType | "ALL";
    anchor?: AnchorScope;
    siteId?: string;
    variantView?: VariantView;
  }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const [scenarios, parcels] = await Promise.all([getScenarios(orgSlug), getParcels(orgSlug)]);
    const parcelById = new Map(parcels.items.map((parcel) => [parcel.id, parcel]));
    const familyStats = buildFamilyStats(scenarios.items, parcelById);
    const searchQuery = resolvedSearchParams?.q?.trim() ?? "";
    const scope = resolvedSearchParams?.scope ?? "ACTIVE";
    const strategyFilter = resolvedSearchParams?.strategy ?? "ALL";
    const anchorFilter = resolvedSearchParams?.anchor ?? "ALL";
    const selectedSiteId = resolvedSearchParams?.siteId ?? "ALL";
    const variantView = scope === "ARCHIVED" ? "ALL" : resolvedSearchParams?.variantView ?? "LEADS";
    const scenarioAnchors = parcels.items
      .filter((parcel) => parcel.isGroupSite || !parcel.parcelGroupId)
      .sort((left, right) => {
        const anchorRank = Number(isGroupedSite(left)) === Number(isGroupedSite(right))
          ? 0
          : isGroupedSite(left) ? -1 : 1;
        if (anchorRank !== 0) return anchorRank;
        return getSiteAnchorLabel(left).localeCompare(getSiteAnchorLabel(right));
      });

    const baseFilteredScenarios = [...scenarios.items]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .filter((scenario) => {
        if (scope === "ACTIVE" && scenario.status === ScenarioStatus.ARCHIVED) return false;
        if (scope === "ARCHIVED" && scenario.status !== ScenarioStatus.ARCHIVED) return false;
        if (strategyFilter !== "ALL" && scenario.strategyType !== strategyFilter) return false;

        const linkedParcel = scenario.parcelId ? parcelById.get(scenario.parcelId) : null;
        const linkedParcelName = linkedParcel?.name ?? linkedParcel?.cadastralId ?? "";
        return matchesScenarioQuery(scenario, linkedParcelName, searchQuery)
          && matchesAnchorFilter(scenario, linkedParcel ?? null, anchorFilter, selectedSiteId);
      });
    const filteredScenarios = baseFilteredScenarios
      .filter((scenario) => {
        if (variantView !== "LEADS") return true;
        return familyStats.get(scenario.id)?.isLead ?? true;
      })
      .sort((left, right) => {
        const leftParcel = left.parcelId ? parcelById.get(left.parcelId) ?? null : null;
        const rightParcel = right.parcelId ? parcelById.get(right.parcelId) ?? null : null;
        const anchorRank = Number(isGroupedSite(rightParcel)) - Number(isGroupedSite(leftParcel));
        if (anchorRank !== 0) return anchorRank;

        const leftLead = familyStats.get(left.id)?.isLead ?? false;
        const rightLead = familyStats.get(right.id)?.isLead ?? false;
        const leadRank = Number(rightLead) - Number(leftLead);
        if (leadRank !== 0) return leadRank;

        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });

    const withLinkedParcel = scenarios.items.filter((scenario) => scenario.parcelId).length;
    const withRunHistory = scenarios.items.filter((scenario) => scenario.latestRunAt).length;
    const activeCases = scenarios.items.filter((scenario) => scenario.status !== ScenarioStatus.ARCHIVED).length;
    const archivedCases = scenarios.items.filter((scenario) => scenario.status === ScenarioStatus.ARCHIVED).length;
    const groupedSiteAnchoredCount = scenarios.items.filter((scenario) => {
      const linkedParcel = scenario.parcelId ? parcelById.get(scenario.parcelId) ?? null : null;
      return isGroupedSite(linkedParcel);
    }).length;
    const standaloneAnchoredCount = withLinkedParcel - groupedSiteAnchoredCount;
    const familyCount = new Set(scenarios.items.map((scenario) => getScenarioFamilyKey(scenario))).size;
    const familyLeadCount = new Set(
      scenarios.items
        .filter((scenario) => familyStats.get(scenario.id)?.isLead)
        .map((scenario) => familyStats.get(scenario.id)?.familyKey),
    ).size;
    const olderVariantCount = scenarios.items.filter((scenario) => {
      const stats = familyStats.get(scenario.id);
      return Boolean(stats && !stats.isLead && scenario.status !== ScenarioStatus.ARCHIVED);
    }).length;
    const workspaceGroupedSiteCount = parcels.items.filter((parcel) => isGroupedSite(parcel)).length;
    const groupedSiteAnchorGap = workspaceGroupedSiteCount > 0 && groupedSiteAnchoredCount === 0;
    const filterHref = buildBoardHref(orgSlug, {
      q: searchQuery,
      scope,
      strategy: strategyFilter,
      anchor: anchorFilter,
      siteId: selectedSiteId,
      variantView,
    });

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Workspace / Scenarios"
          title="Scenario board"
          description="Govern the case set by site, strategy, status, and latest signal."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{scenarios.total} cases</span>
              <span className="meta-chip">{withLinkedParcel} site-linked</span>
              <span className="meta-chip">{groupedSiteAnchoredCount} grouped-site anchored</span>
              <span className="meta-chip">{withRunHistory} with runs</span>
              <span className="meta-chip">{activeCases} active</span>
              <span className="meta-chip">{archivedCases} archived</span>
            </div>
          )}
          actions={(
            <Link className={buttonClasses({ size: "lg" })} href={`/${orgSlug}/scenarios/new`}>
              New scenario
            </Link>
          )}
        />

        {groupedSiteAnchorGap ? (
          <Alert tone="warning">
            <AlertTitle>Grouped sites exist, but scenarios still are not anchored to them</AlertTitle>
            <AlertDescription>Grouped sites are now the intended daily working unit. Start the next cases from a grouped site so site-level planning, readiness, and result continuity stay together.</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "status-request-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Scenario status update failed</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The scenario board could not save the requested status change."}</AlertDescription>
          </Alert>
        ) : null}

        <SectionCard
          className="summary-band summary-band--ledger"
          eyebrow="Operating summary"
          title="Studio scan"
          description="Keep scenario sprawl under control without losing comparison power."
          tone="accent"
          size="compact"
        >
          <div className="ops-summary-grid ops-summary-grid--planning">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Cases</div>
              <div className="ops-summary-item__value">{scenarios.total}</div>
              <div className="ops-summary-item__detail">Current scenario workspace.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Active board</div>
              <div className="ops-summary-item__value">{activeCases}</div>
              <div className="ops-summary-item__detail">Visible working set before archive noise accumulates.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Run history</div>
              <div className="ops-summary-item__value">{withRunHistory}</div>
              <div className="ops-summary-item__detail">Cases with recorded output.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Site anchors</div>
              <div className="ops-summary-item__value">{groupedSiteAnchoredCount}</div>
              <div className="ops-summary-item__detail">{standaloneAnchoredCount} standalone-linked / grouped sites should become the default.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Scenario families</div>
              <div className="ops-summary-item__value">{familyCount}</div>
              <div className="ops-summary-item__detail">{olderVariantCount} older active variant{olderVariantCount === 1 ? "" : "s"} still adding board noise.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Filtered view</div>
              <div className="ops-summary-item__value">{filteredScenarios.length}</div>
              <div className="ops-summary-item__detail">{variantView === "LEADS" ? `${familyLeadCount} current family leads in view.` : "Current set after governance filters."}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="index-surface index-surface--ledger"
          eyebrow="Board controls"
          title="Govern the scenario set"
          description="Filter by site anchor, strategy, and lifecycle, then trim the board to family leads when variants start to sprawl."
          size="compact"
        >
          <form action={`/${orgSlug}/scenarios`} method="GET" className="comparison-toolbar comparison-toolbar--filters">
            <div className="comparison-toolbar__form comparison-toolbar__form--wide">
              <label className="field-stack">
                <span className="field-help">Search</span>
                <input className="ui-input" type="search" name="q" defaultValue={searchQuery} placeholder="Scenario, parcel, strategy" />
              </label>
              <label className="field-stack">
                <span className="field-help">Board scope</span>
                <select name="scope" defaultValue={scope} className="ui-select">
                  <option value="ACTIVE">Active only</option>
                  <option value="ARCHIVED">Archived only</option>
                  <option value="ALL">All cases</option>
                </select>
              </label>
              <label className="field-stack">
                <span className="field-help">Strategy</span>
                <select name="strategy" defaultValue={strategyFilter} className="ui-select">
                  <option value="ALL">All strategies</option>
                  {Object.values(StrategyType).map((value) => (
                    <option key={value} value={value}>{strategyTypeLabels[value]}</option>
                  ))}
                </select>
              </label>
              <label className="field-stack">
                <span className="field-help">Site anchor</span>
                <select name="anchor" defaultValue={anchorFilter} className="ui-select">
                  <option value="ALL">All site anchors</option>
                  <option value="GROUPED_SITE">Grouped sites only</option>
                  <option value="STANDALONE">Standalone parcels only</option>
                  <option value="UNLINKED">Unlinked only</option>
                </select>
              </label>
              <label className="field-stack">
                <span className="field-help">Specific site</span>
                <select name="siteId" defaultValue={selectedSiteId} className="ui-select">
                  <option value="ALL">All grouped sites and parcels</option>
                  {scenarioAnchors.map((parcel) => (
                    <option key={parcel.id} value={parcel.id}>
                      {`${isGroupedSite(parcel) ? "Site" : "Parcel"} / ${getSiteAnchorLabel(parcel)}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-stack">
                <span className="field-help">Variant view</span>
                <select name="variantView" defaultValue={variantView} className="ui-select">
                  <option value="LEADS">Current family leads only</option>
                  <option value="ALL">Show all variants</option>
                </select>
              </label>
              <button className={buttonClasses({ variant: "secondary" })} type="submit">
                Apply filters
              </button>
              <Link className={buttonClasses({ variant: "ghost" })} href={`/${orgSlug}/scenarios`}>
                Clear
              </Link>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          className="index-surface index-surface--ledger"
          eyebrow="Decision workspace"
          title="Scenario studio"
          description="Filter, compare, archive, and reopen the right case fast."
        >
          {filteredScenarios.length ? (
            <div className="content-stack">
              <form id="scenario-compare-form" action={`/${orgSlug}/scenarios/compare`} method="GET" className="comparison-toolbar">
                <div className="comparison-toolbar__summary">
                  <div className="ops-summary-item__label">Comparison</div>
                  <div className="ops-summary-item__value">Select cases to rank and compare</div>
                  <div className="ops-summary-item__detail">Use governance filters first, then compare only the cases still worth discussing.</div>
                </div>
                <div className="comparison-toolbar__form">
                  <label className="field-stack">
                    <span className="field-help">Ranking target</span>
                    <select name="rankingTarget" defaultValue={OptimizationTarget.MIN_REQUIRED_EQUITY} className="ui-select">
                      {Object.values(OptimizationTarget).map((value) => (
                        <option key={value} value={value}>{optimizationTargetLabels[value]}</option>
                      ))}
                    </select>
                  </label>
                  <button className={buttonClasses({ variant: "secondary" })} type="submit">
                    Compare selected
                  </button>
                </div>
              </form>

              <div className="ops-table">
                <div className="ops-table__header ops-table__header--scenarios">
                  <div>Select</div>
                  <div>Scenario</div>
                  <div>Parcel</div>
                  <div>Strategy</div>
                  <div>Funding</div>
                  <div>Status</div>
                  <div>Activity</div>
                  <div>Next</div>
                </div>
                {filteredScenarios.map((scenario) => {
                  const linkedParcel = scenario.parcelId ? parcelById.get(scenario.parcelId) : null;
                  const selectedFundingCount = scenario.fundingVariants.filter((item) => item.isEnabled).length;
                  const selectedFundingLabels = scenario.fundingVariants
                    .filter((item) => item.isEnabled)
                    .slice(0, 2)
                    .map((item) => humanizeTokenLabel(item.financingSourceType));
                  const nextAction = getScenarioNextAction(scenario);
                  const family = familyStats.get(scenario.id);
                  const statusAction = setScenarioStatusAction.bind(
                    null,
                    orgSlug,
                    scenario.id,
                    scenario.status === ScenarioStatus.ARCHIVED ? ScenarioStatus.DRAFT : ScenarioStatus.ARCHIVED,
                    filterHref,
                  );
                  const archiveOlderVariantsAction = archiveScenarioVariantsAction.bind(null, orgSlug, filterHref);
                  const anchorLabel = linkedParcel ? getSiteAnchorLabel(linkedParcel) : "Unlinked";
                  const anchorTypeLabel = linkedParcel ? (isGroupedSite(linkedParcel) ? "Grouped site anchor" : "Standalone parcel anchor") : "Unlinked";
                  const memberCount = linkedParcel && isGroupedSite(linkedParcel)
                    ? linkedParcel.parcelGroup?.memberCount ?? linkedParcel.constituentParcels.length
                    : 0;
                  const assumptionLabel = scenario.assumptionSet?.templateName
                    ?? scenario.assumptionSet?.templateKey
                    ?? "Baseline";

                  return (
                    <div key={scenario.id} className="ops-table__row ops-table__row--scenarios">
                      <div className="ops-table__cell ops-table__cell--select">
                        <label className="compare-checkbox">
                          <input form="scenario-compare-form" type="checkbox" name="scenarioId" value={scenario.id} />
                          <span>Compare</span>
                        </label>
                      </div>

                      <div className="ops-table__cell">
                        <div className="list-row__body">
                          <div className="list-row__title">
                            <span className="list-row__title-text">{scenario.name}</span>
                            <StatusBadge tone={getScenarioStatusTone(scenario.status)}>
                              {scenarioStatusLabels[scenario.status]}
                            </StatusBadge>
                            {scenario.latestRunAt ? <StatusBadge tone="success">Has run</StatusBadge> : null}
                            {scenario.parcelId ? <StatusBadge tone={linkedParcel && isGroupedSite(linkedParcel) ? "accent" : "info"}>{anchorTypeLabel}</StatusBadge> : <StatusBadge tone="warning">Parcel missing</StatusBadge>}
                            {family && family.familySize > 1 ? <StatusBadge tone="surface">{family.familySize} in family</StatusBadge> : null}
                            {family?.isLead && family.familySize > 1 ? <StatusBadge tone="info">Current lead</StatusBadge> : null}
                            {family && !family.isLead && scenario.status !== ScenarioStatus.ARCHIVED ? <StatusBadge tone="warning">Older variant</StatusBadge> : null}
                          </div>

                          {scenario.description ? <div className="list-row__meta list-row__meta--clamped">{scenario.description}</div> : null}

                          <div className="inline-meta">
                            <span className="meta-chip">{assumptionLabel}</span>
                            <span className="meta-chip">{optimizationTargetLabels[scenario.optimizationTarget]}</span>
                            <span className="meta-chip">{formatScenarioSignal(scenario.updatedAt)} update</span>
                            {family?.familySize ? <span className="meta-chip">{family.familyLabel}</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Site anchor</div>
                          <div className="ops-scan__value">{anchorLabel}</div>
                          <div className="ops-scan__detail">
                            {linkedParcel
                              ? isGroupedSite(linkedParcel)
                                ? `${memberCount} parcel member${memberCount === 1 ? "" : "s"} / ${linkedParcel.municipalityName ?? linkedParcel.city ?? "Site context attached"}`
                                : linkedParcel.municipalityName ?? "Standalone parcel context attached"
                              : "Needs site anchor"}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Strategy</div>
                          <div className="ops-scan__value">{strategyTypeLabels[scenario.strategyType]}</div>
                          <div className="ops-scan__detail">{optimizationTargetLabels[scenario.optimizationTarget]}</div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Funding</div>
                          <div className="ops-scan__value">{selectedFundingCount} lane(s)</div>
                          <div className="ops-scan__detail">
                            {selectedFundingLabels.length ? selectedFundingLabels.join(" / ") : "No active stack"}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Status</div>
                          <div className="action-row">
                            <StatusBadge tone={getScenarioStatusTone(scenario.status)}>
                              {scenarioStatusLabels[scenario.status]}
                            </StatusBadge>
                          </div>
                          <div className="ops-scan__detail">
                            {scenario.latestRunAt ? "Run history present" : "No completed run yet"}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Activity</div>
                          <div className="ops-scan__value">
                            {scenario.latestRunAt ? `Ran ${formatScenarioSignal(scenario.latestRunAt)}` : `Updated ${formatScenarioSignal(scenario.updatedAt)}`}
                          </div>
                          <div className="ops-scan__detail">
                            {scenario.latestRunAt ? "Latest engine output recorded" : "Builder edits only"}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__actions ops-table__actions--dense">
                        <div className="action-row">
                          <StatusBadge tone={nextAction.tone}>{nextAction.label}</StatusBadge>
                        </div>
                        <div className="ops-scan__detail">{nextAction.detail}</div>
                        <div className="action-row action-row--compact">
                          {scenario.parcelId ? (
                            <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={`/${orgSlug}/parcels/${scenario.parcelId}`}>
                              {linkedParcel && isGroupedSite(linkedParcel) ? "Site" : "Parcel"}
                            </Link>
                          ) : null}
                          <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/scenarios/${scenario.id}/builder`}>
                            Builder
                          </Link>
                          <form action={statusAction}>
                            <button className={buttonClasses({ variant: "ghost", size: "sm" })} type="submit">
                              {scenario.status === ScenarioStatus.ARCHIVED ? "Restore" : "Archive"}
                            </button>
                          </form>
                          {family && family.isLead && family.olderActiveVariantIds.length ? (
                            <form action={archiveOlderVariantsAction}>
                              {family.olderActiveVariantIds.map((variantId) => (
                                <input key={variantId} type="hidden" name="scenarioId" value={variantId} />
                              ))}
                              <button className={buttonClasses({ variant: "ghost", size: "sm" })} type="submit">
                                Archive older
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState
              eyebrow="No scenarios in this view"
              title="No scenarios match the current governance filters"
              description="Adjust search or status filters, or create a new case from a sourced parcel or grouped site."
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/scenarios/new`}>
                    Create scenario
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                    Clear filters
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
