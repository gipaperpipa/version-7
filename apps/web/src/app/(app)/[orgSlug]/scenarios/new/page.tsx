import Link from "next/link";
import { getParcels } from "@/lib/api/parcels";
import { createScenarioAction } from "../actions";
import { ScenarioEditorForm } from "@/components/scenarios/scenario-editor-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function NewScenarioPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string };
  searchParams?: { error?: string; parcelId?: string };
}) {
  const parcels = await getParcels(params.orgSlug);
  const action = createScenarioAction.bind(null, params.orgSlug);

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">New Scenario</h1>
        <p className="text-sm text-slate-600">Create a thin Sprint 1 scenario and continue into the builder.</p>
      </div>

      {searchParams?.error === "invalid-strategy-mix-json" ? (
        <Alert className="border-red-300 bg-red-50 text-red-950">
          <AlertTitle>Invalid mix configuration JSON</AlertTitle>
          <AlertDescription>The temporary mixed-strategy JSON could not be parsed. Please fix the JSON and try again.</AlertDescription>
        </Alert>
      ) : null}

      {!parcels.items.length ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <AlertTitle>No parcels yet</AlertTitle>
          <AlertDescription>
            Create a parcel first so new scenarios can reference a real site.
            <div className="mt-3">
              <Link className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm" href={`/${params.orgSlug}/parcels/new`}>
                Create Parcel
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScenarioEditorForm
        action={action}
        parcels={parcels.items}
        initialParcelId={searchParams?.parcelId ?? null}
        submitLabel="Create Scenario"
      />
    </div>
  );
}
