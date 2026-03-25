import type { ScenarioRunDto } from "@repo/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function RunDiagnosticsPanel({ run }: { run: ScenarioRunDto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge className="border-slate-200 bg-slate-50 text-slate-700">Input Confidence: {run.confidence.inputConfidencePct ?? "n/a"}</Badge>
          <Badge className="border-slate-200 bg-slate-50 text-slate-700">Output Confidence: {run.confidence.outputConfidencePct ?? "n/a"}</Badge>
          <Badge className="border-slate-200 bg-slate-50 text-slate-700">Status: {run.status}</Badge>
        </div>
        <div className="space-y-2 text-sm">
          {run.warnings.length ? run.warnings.map((warning) => (
            <div key={warning.code} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
              {warning.message}
            </div>
          )) : <div className="text-slate-600">No warnings.</div>}
        </div>
        {run.missingDataFlags.length ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Missing-data flags</div>
            <div className="flex flex-wrap gap-2">
              {run.missingDataFlags.map((flag) => (
                <Badge key={flag} className="border-rose-200 bg-rose-50 text-rose-900">{flag}</Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
