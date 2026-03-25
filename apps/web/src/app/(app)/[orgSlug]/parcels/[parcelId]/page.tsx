import Link from "next/link";
import { getParcel } from "@/lib/api/parcels";
import { updateParcelAction } from "../actions";
import { ParcelEditorForm } from "@/components/parcels/parcel-editor-form";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ParcelDetailPage({
  params,
}: {
  params: { orgSlug: string; parcelId: string };
}) {
  const parcel = await getParcel(params.orgSlug, params.parcelId);
  const action = updateParcelAction.bind(null, params.orgSlug, params.parcelId);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{parcel.name ?? parcel.cadastralId ?? "Parcel"}</h1>
          <p className="text-sm text-slate-600">Edit core parcel data for Sprint 1 feasibility workflows.</p>
        </div>
        <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm" href={`/${params.orgSlug}/parcels/${params.parcelId}/planning`}>
          Planning Inputs
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source and Confidence</CardTitle>
        </CardHeader>
        <CardContent>
          <ProvenanceConfidence
            sourceType={parcel.sourceType}
            confidenceScore={parcel.confidenceScore}
            sourceReference={parcel.sourceReference}
          />
        </CardContent>
      </Card>

      <ParcelEditorForm action={action} initialParcel={parcel} submitLabel="Save Parcel" />
    </div>
  );
}
