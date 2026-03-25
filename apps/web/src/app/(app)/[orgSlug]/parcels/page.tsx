import Link from "next/link";
import { getParcels } from "@/lib/api/parcels";
import { ParcelDto } from "@repo/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";

function ParcelCard({ orgSlug, parcel }: { orgSlug: string; parcel: ParcelDto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{parcel.name ?? parcel.cadastralId ?? "Untitled Parcel"}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-2 text-sm text-slate-600">
          <div>Land area: {parcel.landAreaSqm ?? "n/a"} sqm</div>
          <div>City: {parcel.city ?? "n/a"}</div>
          <div>Municipality: {parcel.municipalityName ?? "n/a"}</div>
          <ProvenanceConfidence
            sourceType={parcel.sourceType}
            confidenceScore={parcel.confidenceScore}
            sourceReference={parcel.sourceReference}
          />
        </div>
        <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm" href={`/${orgSlug}/parcels/${parcel.id}`}>
          Open Parcel
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function ParcelsPage({ params }: { params: { orgSlug: string } }) {
  const parcels = await getParcels(params.orgSlug);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Parcels</h1>
          <p className="text-sm text-slate-600">Thin Sprint 1 parcel intake so scenarios do not depend on seeded sites.</p>
        </div>
        <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" href={`/${params.orgSlug}/parcels/new`}>
          New Parcel
        </Link>
      </div>

      <div className="grid gap-4">
        {parcels.items.length ? parcels.items.map((parcel) => (
          <ParcelCard key={parcel.id} orgSlug={params.orgSlug} parcel={parcel} />
        )) : (
          <Card>
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <div className="text-sm text-slate-600">
                No parcels yet. Create one to unlock scenario creation against a real site.
              </div>
              <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" href={`/${params.orgSlug}/parcels/new`}>
                Create Parcel
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
