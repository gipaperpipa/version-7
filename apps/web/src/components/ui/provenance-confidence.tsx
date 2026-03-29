import type { SourceType } from "@repo/contracts";
import { getConfidenceBand, getSourceLabel } from "@/lib/ui/provenance";
import { cx } from "@/lib/ui/cx";
import { Badge } from "./badge";
import { getConfidenceTone } from "./status-badge";

export function ProvenanceConfidence({
  sourceType,
  confidenceScore,
  sourceReference,
  readOnlyLabel,
  variant = "default",
}: {
  sourceType: SourceType | null | undefined;
  confidenceScore: number | null | undefined;
  sourceReference?: string | null;
  readOnlyLabel?: string | null;
  variant?: "default" | "inline";
}) {
  const sourceLabel = getSourceLabel(sourceType);
  const band = getConfidenceBand(confidenceScore);

  return (
    <div className={cx("provenance", variant === "inline" && "provenance--inline")}>
      <div className="provenance__line">
        <Badge variant={getConfidenceTone(band)}>Confidence {band}</Badge>
        {sourceLabel ? <span className="meta-chip">{sourceLabel}</span> : null}
        {readOnlyLabel ? <span className="meta-chip">{readOnlyLabel}</span> : null}
      </div>
      {sourceReference ? <div className="provenance__reference">{sourceReference}</div> : null}
    </div>
  );
}
