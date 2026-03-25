import type { ScenarioResultExplanationDto } from "@repo/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ResultExplanationCard({ explanation }: { explanation: ScenarioResultExplanationDto | null }) {
  if (!explanation) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Result Explanation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-slate-600">{explanation.summary}</p>
        <div>
          <div className="mb-2 font-medium">Dominant drivers</div>
          <div className="space-y-2">
            {explanation.dominantDrivers.map((item) => (
              <div key={item} className="rounded-md border border-slate-200 p-3">{item}</div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 font-medium">Fallback assumptions</div>
          <div className="space-y-2">
            {explanation.fallbackAssumptions.map((item) => (
              <div key={item} className="rounded-md border border-slate-200 p-3 text-slate-600">{item}</div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
