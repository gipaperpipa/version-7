import type { SourceParcelSearchResultDto } from "../../generated-contracts/parcels";
import { calculateMultiPolygonAreaSqm, calculateMultiPolygonCentroid } from "../../common/geo/geometry-metrics";

export type NormalizedSourceParcelRecord = SourceParcelSearchResultDto;

export function normalizeConfidenceScore(score: number | null | undefined) {
  if (score == null || !Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getParcelConfidenceBand(score: number | null | undefined): SourceParcelSearchResultDto["confidenceBand"] {
  if (score == null) return "UNSCORED";
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  if (score > 0) return "LOW";
  return "UNSCORED";
}

export function toNullableDecimalString(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return String(Math.round(value * 100) / 100);
}

export function buildNormalizedSourceSearchResult(
  record: Omit<
    SourceParcelSearchResultDto,
    | "landAreaSqm"
    | "confidenceScore"
    | "confidenceBand"
    | "centroid"
    | "sourceReference"
    | "hasGeometry"
    | "hasLandArea"
    | "workspaceState"
    | "regroupingEligible"
    | "lockReason"
    | "existingParcelId"
    | "existingSite"
    | "downstreamWork"
    | "rawMetadata"
  > & {
    landAreaSqm?: string | null;
    confidenceScore?: number | null;
    rawMetadata?: Record<string, unknown> | null;
  },
): NormalizedSourceParcelRecord {
  const resolvedArea = record.landAreaSqm ?? (() => {
    const area = calculateMultiPolygonAreaSqm(record.geom);
    return toNullableDecimalString(area);
  })();
  const normalizedConfidence = normalizeConfidenceScore(record.confidenceScore);

  return {
    ...record,
    landAreaSqm: resolvedArea,
    confidenceScore: normalizedConfidence,
    confidenceBand: getParcelConfidenceBand(normalizedConfidence),
    centroid: calculateMultiPolygonCentroid(record.geom),
    sourceReference: `${record.providerName}:${record.providerParcelId}`,
    hasGeometry: Boolean(record.geom),
    hasLandArea: Boolean(resolvedArea),
    workspaceState: "NEW",
    regroupingEligible: true,
    lockReason: "NONE",
    existingParcelId: null,
    existingSite: null,
    downstreamWork: {
      planningValueCount: 0,
      scenarioCount: 0,
      scenarios: [],
    },
    rawMetadata: record.rawMetadata ?? null,
  };
}
