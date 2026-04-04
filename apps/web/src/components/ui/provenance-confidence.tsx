import type { ParcelProvenanceDto, SourceType } from "@repo/contracts";
import { getConfidenceBand, getSourceLabel, getTrustModeLabel } from "@/lib/ui/provenance";
import { cx } from "@/lib/ui/cx";
import { Badge } from "./badge";
import { getConfidenceTone } from "./status-badge";

export function ProvenanceConfidence({
  sourceType,
  confidenceScore,
  sourceReference,
  provenance,
  providerName,
  providerParcelId,
  showDerivedFlags = false,
  readOnlyLabel,
  variant = "default",
}: {
  sourceType: SourceType | null | undefined;
  confidenceScore: number | null | undefined;
  sourceReference?: string | null;
  provenance?: ParcelProvenanceDto | null;
  providerName?: string | null;
  providerParcelId?: string | null;
  showDerivedFlags?: boolean;
  readOnlyLabel?: string | null;
  variant?: "default" | "inline";
}) {
  const sourceLabel = getSourceLabel(sourceType);
  const band = getConfidenceBand(confidenceScore);
  const trustModeLabel = getTrustModeLabel(provenance?.trustMode);
  const confidenceLabel = confidenceScore != null ? `Confidence ${band} ${confidenceScore}` : `Confidence ${band}`;
  const referenceItems = [providerParcelId ?? provenance?.providerParcelId ?? null, sourceReference].filter(
    (item): item is string => Boolean(item),
  );

  return (
    <div className={cx("provenance", variant === "inline" && "provenance--inline")}>
      <div className="provenance__line">
        <Badge variant={getConfidenceTone(band)}>{confidenceLabel}</Badge>
        {trustModeLabel ? <span className="meta-chip">{trustModeLabel}</span> : null}
        {providerName ?? provenance?.providerName ? <span className="meta-chip">{providerName ?? provenance?.providerName}</span> : null}
        {!trustModeLabel && sourceLabel ? <span className="meta-chip">{sourceLabel}</span> : null}
        {showDerivedFlags && provenance?.geometryDerived ? <span className="meta-chip">Geometry derived</span> : null}
        {showDerivedFlags && provenance?.areaDerived ? <span className="meta-chip">Area derived</span> : null}
        {readOnlyLabel ? <span className="meta-chip">{readOnlyLabel}</span> : null}
      </div>
      {referenceItems.length ? <div className="provenance__reference">{referenceItems.join(" / ")}</div> : null}
    </div>
  );
}
