import { createParcelAction } from "../actions";
import { ParcelEditorForm } from "@/components/parcels/parcel-editor-form";

export default function NewParcelPage({ params }: { params: { orgSlug: string } }) {
  const action = createParcelAction.bind(null, params.orgSlug);

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">New Parcel</h1>
        <p className="text-sm text-slate-600">Create a parcel with the minimum data needed for Sprint 1 feasibility workflows.</p>
      </div>
      <ParcelEditorForm action={action} submitLabel="Create Parcel" />
    </div>
  );
}
