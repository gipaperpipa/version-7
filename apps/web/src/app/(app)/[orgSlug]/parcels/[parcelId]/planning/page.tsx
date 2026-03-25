import Link from "next/link";
import { getParcel } from "@/lib/api/parcels";
import { getPlanningParameters } from "@/lib/api/planning";
import { savePlanningParametersAction } from "./actions";
import { PlanningParameterForm } from "@/components/planning/planning-parameter-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { sprint1PlanningFieldDefinitions } from "@/lib/ui/planning-field-definitions";

export default async function ParcelPlanningPage({
  params,
}: {
  params: { orgSlug: string; parcelId: string };
}) {
  const [parcel, planningParameters] = await Promise.all([
    getParcel(params.orgSlug, params.parcelId),
    getPlanningParameters(params.orgSlug, params.parcelId),
  ]);

  const action = savePlanningParametersAction.bind(null, params.orgSlug, params.parcelId);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Planning Inputs</h1>
          <p className="text-sm text-slate-600">
            Parcel {parcel.name ?? parcel.cadastralId ?? parcel.id}
          </p>
        </div>
        <div className="flex gap-3">
          <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm" href={`/${params.orgSlug}/parcels/${params.parcelId}`}>
            Back to Parcel
          </Link>
          <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" href={`/${params.orgSlug}/scenarios/new?parcelId=${params.parcelId}`}>
            Continue to Scenario
          </Link>
        </div>
      </div>

      <Alert className="border-sky-200 bg-sky-50 text-sky-950">
        <AlertTitle>Thin Sprint 1 planning coverage</AlertTitle>
        <AlertDescription>
          This page only captures the core planning keys used by readiness checks and the heuristic v0 feasibility engine.
        </AlertDescription>
      </Alert>

      <PlanningParameterForm
        action={action}
        definitions={sprint1PlanningFieldDefinitions}
        items={planningParameters.items}
      />
    </div>
  );
}
