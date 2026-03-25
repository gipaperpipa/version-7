import type { ParcelDto } from "@repo/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ParcelEditorForm({
  action,
  initialParcel,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initialParcel?: ParcelDto;
  submitLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parcel</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-8">
          <section className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Basics</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={initialParcel?.name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cadastralId">Cadastral ID</Label>
                <Input id="cadastralId" name="cadastralId" defaultValue={initialParcel?.cadastralId ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="landAreaSqm">Land area sqm</Label>
                <Input id="landAreaSqm" name="landAreaSqm" defaultValue={initialParcel?.landAreaSqm ?? ""} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Location</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="addressLine1">Address</Label>
                <Input id="addressLine1" name="addressLine1" defaultValue={initialParcel?.addressLine1 ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={initialParcel?.city ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal code</Label>
                <Input id="postalCode" name="postalCode" defaultValue={initialParcel?.postalCode ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stateCode">State code</Label>
                <Input id="stateCode" name="stateCode" defaultValue={initialParcel?.stateCode ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="countryCode">Country code</Label>
                <Input id="countryCode" name="countryCode" defaultValue={initialParcel?.countryCode ?? "DE"} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="municipalityName">Municipality</Label>
                <Input id="municipalityName" name="municipalityName" defaultValue={initialParcel?.municipalityName ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="districtName">District</Label>
                <Input id="districtName" name="districtName" defaultValue={initialParcel?.districtName ?? ""} />
              </div>
            </div>
          </section>

          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Sprint 1 parcel form captures core feasibility inputs only. Polygon and MultiPolygon GeoJSON normalization is supported in the API, but geometry editing stays out of the thin web form for now.
          </div>

          <Button type="submit">{submitLabel}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
