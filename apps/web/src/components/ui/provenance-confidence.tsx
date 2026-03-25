import type { SourceType } from "@repo/contracts";
import { getConfidenceBand, getConfidenceBandClasses, getSourceLabel } from "@/lib/ui/provenance";
import { Badge } from "./badge";

export function ProvenanceConfidence({
  sourceType,
  confidenceScore,
  sourceReference,
  readOnlyLabel,
}: {
  sourceType: SourceType | null | undefined;
  confidenceScore: number | null | undefined;
  sourceReference?: string | null;
  readOnlyLabel?: string | null;
}) {
  const sourceLabel = getSourceLabel(sourceType);
  const band = getConfidenceBand(confidenceScore);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={getConfidenceBandClasses(band)}>{band}</Badge>
        {sourceLabel ? <Badge className="border-slate-200 bg-slate-50 text-slate-700">{sourceLabel}</Badge> : null}
        {readOnlyLabel ? <Badge className="border-slate-200 bg-slate-50 text-slate-700">{readOnlyLabel}</Badge> : null}
      </div>
      {sourceReference ? <div className="text-xs text-slate-500">{sourceReference}</div> : null}
    </div>
  );
}
