import type {
  ParcelDto,
  PlanningParameterDto,
  ScenarioComparisonEntryDto,
  ScenarioComparisonResponseDto,
  ScenarioDto,
  ScenarioRunDto,
} from "@repo/contracts";
import { humanizeTokenLabel, optimizationTargetLabels } from "@/lib/ui/enum-labels";
import { getConfidenceBand, getSourceAuthorityLabel, getTrustModeLabel } from "@/lib/ui/provenance";

type RecommendationTone = "neutral" | "surface" | "accent" | "success" | "warning" | "danger" | "info";

export interface ScenarioDecisionMemo {
  postureLabel: string;
  postureTone: RecommendationTone;
  cardTone: "default" | "muted" | "accent";
  headline: string;
  summary: string;
  decisionCall: string;
  reviewUse: string;
  confidenceGate: string;
  upgradeLine: string;
  whyNow: string[];
  watchItems: string[];
  nextMoves: string[];
}

export interface ComparisonDecisionMemo {
  postureLabel: string;
  postureTone: RecommendationTone;
  cardTone: "default" | "muted" | "accent";
  headline: string;
  summary: string;
  decisionCall: string;
  leaderContext: string;
  challengerContext: string;
  confidenceGate: string;
  whyLeader: string[];
  changeRisks: string[];
  nextMoves: string[];
}

function takeDistinct(items: Array<string | null | undefined>, limit = 3) {
  const seen = new Set<string>();
  const normalized = items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0 && !seen.has(item) && (seen.add(item), true));

  return normalized.slice(0, limit);
}

function hasPlanningValue(item: PlanningParameterDto) {
  return item.valueNumber !== null || item.valueBoolean !== null || item.valueText !== null || item.geom !== null;
}

function buildAuthorityWatch(parcel: ParcelDto | null) {
  if (!parcel) return null;

  if (parcel.sourceAuthority === "DEMO") {
    return "Parcel identity is still on demo-grade source authority, so the case should remain a screening memo.";
  }

  if (parcel.sourceAuthority === "SEARCH_GRADE") {
    return "Parcel identity is still search-grade rather than parcel-grade, so geometry and area trust should stay directional.";
  }

  if (parcel.provenance?.trustMode === "SOURCE_INCOMPLETE") {
    return "Source-backed parcel context is still incomplete, so planning interpretation should remain caveated.";
  }

  if (parcel.isGroupSite && parcel.provenance?.trustMode === "GROUP_DERIVED") {
    return "Grouped-site identity is derived from member parcels, so mixed completeness across members still matters.";
  }

  return null;
}

function buildUpgradeLine({
  blockers,
  missingDataFlags,
  authorityWatch,
  readinessWarnings,
}: {
  blockers: ScenarioRunDto["readinessIssues"];
  missingDataFlags: string[];
  authorityWatch: string | null;
  readinessWarnings: ScenarioRunDto["readinessIssues"];
}) {
  const blockingMessage = blockers.find((issue) => issue.severity === "BLOCKING")?.message;
  if (blockingMessage) return blockingMessage;

  if (missingDataFlags.length) {
    return `Replace fallback inputs for ${humanizeTokenLabel(missingDataFlags[0])} before treating the scenario as decision-grade.`;
  }

  if (authorityWatch) return authorityWatch;

  const warningMessage = readinessWarnings.find((issue) => issue.severity === "WARNING")?.message;
  if (warningMessage) return warningMessage;

  return "No major upgrade trigger surfaced beyond normal scenario refinement.";
}

export function buildScenarioDecisionMemo({
  scenario,
  run,
  parcel,
  planningParameters,
}: {
  scenario: ScenarioDto;
  run: ScenarioRunDto;
  parcel: ParcelDto | null;
  planningParameters: PlanningParameterDto[];
}): ScenarioDecisionMemo {
  const result = run.financialResult;
  const explanation = result?.explanation ?? null;
  const blockers = run.readinessIssues.filter((issue) => issue.severity === "BLOCKING");
  const readinessWarnings = run.readinessIssues.filter((issue) => issue.severity === "WARNING");
  const heuristicWarnings = run.warnings ?? [];
  const missingDataFlags = run.missingDataFlags ?? [];
  const outputConfidenceBand = getConfidenceBand(run.confidence?.outputConfidencePct);
  const savedPlanningCount = planningParameters.filter(hasPlanningValue).length;
  const authorityWatch = buildAuthorityWatch(parcel);
  const authorityLabel = getSourceAuthorityLabel(parcel?.sourceAuthority);
  const trustModeLabel = getTrustModeLabel(parcel?.provenance?.trustMode);
  const totalWarnings = readinessWarnings.length + heuristicWarnings.length;

  let postureLabel = "Advance for internal review";
  let postureTone: RecommendationTone = "accent";
  let cardTone: ScenarioDecisionMemo["cardTone"] = "accent";
  let headline = "Advance this case as the current working recommendation";
  let summary = "The scenario is coherent enough for internal decision discussion, but the caveats below should stay attached to the memo.";
  let decisionCall = "Use this as the current working case for internal review and refine it from the targeted next steps below.";
  let reviewUse = scenario.isCurrentBest ? "Current family lead for review" : "Active candidate for review";

  if (run.status === "FAILED") {
    postureLabel = "Rework before review";
    postureTone = "danger";
    cardTone = "muted";
    headline = "Do not rely on this case until the run path is fixed";
    summary = "The latest run failed, so this memo should stay operational rather than decision-facing.";
    decisionCall = "Return to the builder, fix the failing path, and rerun before using this case in any recommendation discussion.";
    reviewUse = "Builder-only until the run succeeds";
  } else if (run.status === "QUEUED" || run.status === "RUNNING") {
    postureLabel = "Hold pending run";
    postureTone = "warning";
    cardTone = "muted";
    headline = "Keep this memo provisional until the run completes";
    summary = "The scenario has not finished running, so the decision call should remain explicitly temporary.";
    decisionCall = "Wait for the latest run to complete before treating this memo as a recommendation surface.";
    reviewUse = "Progress check only";
  } else if (blockers.length > 0) {
    postureLabel = "Directional only";
    postureTone = "warning";
    cardTone = "muted";
    headline = "Use this case only as a directional screen for now";
    summary = "Execution blockers are still attached, so the scenario can inform discussion but should not anchor a stronger decision yet.";
    decisionCall = "Keep the case in play only as a directional option until the blocking issues are closed.";
    reviewUse = "Directional screening only";
  } else if (outputConfidenceBand === "Low" || missingDataFlags.length >= 2 || parcel?.sourceAuthority === "DEMO") {
    postureLabel = "Directional only";
    postureTone = "warning";
    cardTone = "muted";
    headline = "The economics are useful, but trust is still too thin for a stronger call";
    summary = "The run can still guide what to test next, but missing-data and trust burden remain too high for a firmer recommendation.";
    decisionCall = "Use this case to frame the next analysis pass, not as the final recommendation.";
    reviewUse = "Directional memo only";
  } else if (totalWarnings > 0 || parcel?.sourceAuthority === "SEARCH_GRADE" || parcel?.provenance?.trustMode === "SOURCE_INCOMPLETE") {
    postureLabel = "Advance with caveats";
    postureTone = "accent";
    cardTone = "default";
    headline = "Advance this case, but keep the caveats attached";
    summary = "The scenario is decision-useful for internal review, yet its trust posture still depends on explicit caveat handling.";
    decisionCall = "Keep this scenario active for review, but treat the caveat list as part of the recommendation rather than footnotes.";
    reviewUse = scenario.isCurrentBest ? "Current lead with caveats" : "Active candidate with caveats";
  } else if (scenario.isCurrentBest) {
    postureLabel = "Advance current lead";
    postureTone = "success";
    cardTone = "accent";
    headline = "Advance this case as the current lead recommendation";
    summary = "This scenario is currently the strongest governed case in its family and can anchor the next internal decision conversation.";
    decisionCall = "Use this scenario as the current lead recommendation while continuing targeted refinement rather than broad rework.";
    reviewUse = "Current family lead";
  }

  const confidenceGate = takeDistinct([
    blockers.length ? `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} still weaken readiness.` : null,
    totalWarnings ? `${totalWarnings} warning signal${totalWarnings === 1 ? "" : "s"} still shape the decision posture.` : null,
    missingDataFlags.length ? `${missingDataFlags.length} missing-data flag${missingDataFlags.length === 1 ? "" : "s"} still rely on fallback inputs.` : null,
    authorityLabel ? `${authorityLabel} parcel authority is currently attached to the site context.` : null,
    trustModeLabel ? `Trust mode: ${trustModeLabel}.` : null,
    outputConfidenceBand !== "Unscored" ? `Latest run output confidence is ${outputConfidenceBand.toLowerCase()}.` : "No numeric output-confidence score was returned.",
  ], 2).join(" ");

  const whyNow = takeDistinct([
    scenario.isCurrentBest ? "Marked as the current lead within its governed family." : null,
    blockers.length === 0 ? "No execution blockers were carried into the latest run." : null,
    outputConfidenceBand === "High" ? "The latest run returned high directional confidence." : null,
    explanation?.dominantDrivers?.[0],
    explanation?.dominantDrivers?.[1],
    savedPlanningCount > 0 ? `${savedPlanningCount} planning inputs are already carried into the case.` : null,
  ]);

  const watchItems = takeDistinct([
    blockers[0]?.message,
    readinessWarnings[0]?.message,
    heuristicWarnings[0]?.message,
    authorityWatch,
    explanation?.weakestLinks?.[0],
    explanation?.tradeoffs?.[0],
    missingDataFlags[0] ? `Missing data still matters for ${humanizeTokenLabel(missingDataFlags[0])}.` : null,
  ]);

  const nextMoves = takeDistinct([
    explanation?.nextActions?.[0],
    explanation?.nextActions?.[1],
    blockers[0] ? `Resolve the top blocker first: ${blockers[0].message}` : null,
    missingDataFlags[0] ? `Replace fallback assumptions for ${humanizeTokenLabel(missingDataFlags[0])}.` : null,
    authorityWatch ? "Strengthen parcel/site trust before treating the memo as decision-grade." : null,
  ]);

  return {
    postureLabel,
    postureTone,
    cardTone,
    headline,
    summary,
    decisionCall,
    reviewUse,
    confidenceGate,
    upgradeLine: buildUpgradeLine({
      blockers,
      missingDataFlags,
      authorityWatch,
      readinessWarnings,
    }),
    whyNow,
    watchItems,
    nextMoves,
  };
}

function buildLeaderDecisionCall({
  leader,
  closestChallenger,
}: {
  leader: ScenarioComparisonEntryDto;
  closestChallenger: ScenarioComparisonEntryDto | null;
}) {
  const leaderConfidenceBand = getConfidenceBand(leader.latestRun?.confidence.outputConfidencePct);

  if (leader.blockerCount > 0) {
    return {
      postureLabel: "Keep leader provisional",
      postureTone: "warning" as RecommendationTone,
      cardTone: "muted" as const,
      headline: `${leader.scenario.name} leads, but not cleanly enough to lock in`,
      summary: "The current leader is still carrying blocker burden, so the comparison should be treated as directional rather than final.",
      decisionCall: `Use ${leader.scenario.name} as the front-runner, but do not lock the recommendation until its blocker burden is reduced.`,
    };
  }

  if (leaderConfidenceBand === "Low" || leader.missingDataCount >= 2) {
    return {
      postureLabel: "Directional front-runner",
      postureTone: "warning" as RecommendationTone,
      cardTone: "muted" as const,
      headline: `${leader.scenario.name} is ahead, but the signal is still thin`,
      summary: "The ranking has a current front-runner, but missing-data or low-confidence burden still weakens the call.",
      decisionCall: `Keep ${leader.scenario.name} as the working leader while focusing the next pass on trust and missing-data reduction.`,
    };
  }

  if (closestChallenger?.deltaToLeader != null && closestChallenger.deltaToLeader !== "0") {
    return {
      postureLabel: "Advance current candidate",
      postureTone: "success" as RecommendationTone,
      cardTone: "accent" as const,
      headline: `${leader.scenario.name} is the clearest current candidate`,
      summary: "The leader is ahead on the chosen objective and the comparison burden is low enough to make a stronger recommendation.",
      decisionCall: `Advance ${leader.scenario.name} as the current candidate while monitoring the closest challenger for meaningful closing movement.`,
    };
  }

  return {
    postureLabel: "Advance current candidate",
    postureTone: "success" as RecommendationTone,
    cardTone: "accent" as const,
    headline: `${leader.scenario.name} is the current recommendation`,
    summary: "The comparison set has a usable leader with no obvious burden forcing a weaker call.",
    decisionCall: `Advance ${leader.scenario.name} as the current recommendation for internal review.`,
  };
}

export function buildComparisonDecisionMemo({
  comparison,
  assumptionDiffLabels,
}: {
  comparison: ScenarioComparisonResponseDto;
  assumptionDiffLabels: string[];
}): ComparisonDecisionMemo {
  const rankedEntries = comparison.entries
    .filter((entry) => entry.rank !== null)
    .sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER));
  const leader = rankedEntries.find((entry) => entry.scenario.id === comparison.leaderScenarioId) ?? rankedEntries[0] ?? null;
  const closestChallenger = rankedEntries.find((entry) => entry.rank === 2) ?? null;

  if (!leader) {
    return {
      postureLabel: "No clear call",
      postureTone: "warning",
      cardTone: "muted",
      headline: "The current comparison set does not yet support a recommendation",
      summary: "At least one scenario is missing enough comparable evidence that the ranking cannot support a clean memo recommendation.",
      decisionCall: "Run or complete the missing scenarios before treating the comparison as a decision surface.",
      leaderContext: "No current leader is available.",
      challengerContext: "No challenger context is available.",
      confidenceGate: "A complete leader/rank relationship is required before the comparison memo can support a recommendation.",
      whyLeader: [],
      changeRisks: [],
      nextMoves: ["Complete the missing runs before ranking again."],
    };
  }

  const leadDecision = buildLeaderDecisionCall({ leader, closestChallenger });
  const leaderConfidenceBand = getConfidenceBand(leader.latestRun?.confidence.outputConfidencePct);
  const leaderSourceLine = leader.parcel?.sourceType ? `Source posture is ${humanizeTokenLabel(leader.parcel.sourceType)}.` : null;
  const challengerGap = closestChallenger?.deltaToLeader != null && closestChallenger.deltaToLeader !== "0"
    ? `${closestChallenger.scenario.name} is ${closestChallenger.deltaToLeader} behind the leader on ${optimizationTargetLabels[comparison.rankingTarget].toLowerCase()}.`
    : closestChallenger
      ? `${closestChallenger.scenario.name} is currently the closest challenger.`
      : "No ranked challenger is currently behind the leader.";

  const whyLeader = takeDistinct([
    leader.recommendation,
    leader.topDrivers[0],
    leader.topDrivers[1],
    leader.blockerCount === 0 ? "The leader is not carrying execution blockers into the latest run." : null,
    leaderConfidenceBand === "High" ? "The latest run returned high directional confidence." : null,
  ]);

  const changeRisks = takeDistinct([
    leader.latestRun?.financialResult?.explanation?.weakestLinks?.[0],
    leader.latestRun?.financialResult?.explanation?.tradeoffs?.[0],
    leader.missingDataCount ? `${leader.missingDataCount} missing-data flag${leader.missingDataCount === 1 ? "" : "s"} still sit under the leader.` : null,
    comparison.mixedOptimizationTargets ? "Mixed optimization targets still add interpretation friction to the ranking." : null,
    closestChallenger?.recommendation,
  ]);

  const nextMoves = takeDistinct([
    assumptionDiffLabels[0] ? `Stress-test the recommendation around ${assumptionDiffLabels.slice(0, 2).join(" and ")}.` : null,
    closestChallenger ? `Run a focused follow-up comparing ${leader.scenario.name} against ${closestChallenger.scenario.name}.` : null,
    leader.latestRun?.financialResult?.explanation?.nextActions?.[0],
    leader.latestRun?.financialResult?.explanation?.nextActions?.[1],
    leader.blockerCount ? "Reduce the leader's blocker burden before locking the recommendation." : null,
  ]);

  return {
    postureLabel: leadDecision.postureLabel,
    postureTone: leadDecision.postureTone,
    cardTone: leadDecision.cardTone,
    headline: leadDecision.headline,
    summary: leadDecision.summary,
    decisionCall: leadDecision.decisionCall,
    leaderContext: `${leader.scenario.name} on ${leader.parcel?.name ?? leader.parcel?.cadastralId ?? "the linked site"} is currently ranked #${leader.rank ?? "?"}.`,
    challengerContext: challengerGap,
    confidenceGate: takeDistinct([
      leader.blockerCount ? `${leader.blockerCount} blocker${leader.blockerCount === 1 ? "" : "s"} still sit under the leader.` : null,
      leader.warningCount ? `${leader.warningCount} warning${leader.warningCount === 1 ? "" : "s"} still shape the leader case.` : null,
      leader.missingDataCount ? `${leader.missingDataCount} missing-data flag${leader.missingDataCount === 1 ? "" : "s"} still sit under the leader.` : null,
      leaderConfidenceBand !== "Unscored" ? `Leader output confidence is ${leaderConfidenceBand.toLowerCase()}.` : null,
      leaderSourceLine,
    ], 3).join(" "),
    whyLeader,
    changeRisks,
    nextMoves,
  };
}
