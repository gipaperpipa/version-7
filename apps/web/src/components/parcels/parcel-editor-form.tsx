"use client";

import type { ParcelDto } from "@repo/contracts";
import { ActionRow } from "@/components/ui/action-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";

function ParcelField({
  id,
  label,
  helpText,
  defaultValue,
}: {
  id: string;
  label: string;
  helpText: string;
  defaultValue?: string;
}) {
  return (
    <div className="field-stack">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} defaultValue={defaultValue ?? ""} />
      <div className="field-help">{helpText}</div>
    </div>
  );
}

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
    <form action={action} className="form-stack">
      {initialParcel ? (
        <>
          <input type="hidden" name="existingSourceType" value={initialParcel.sourceType} />
          <input type="hidden" name="existingSourceAuthority" value={initialParcel.provenance?.sourceAuthority ?? initialParcel.sourceAuthority ?? ""} />
          <input type="hidden" name="existingSourceReference" value={initialParcel.sourceReference ?? ""} />
          <input type="hidden" name="existingSourceProviderName" value={initialParcel.sourceProviderName ?? initialParcel.provenance?.providerName ?? ""} />
          <input type="hidden" name="existingSourceProviderParcelId" value={initialParcel.sourceProviderParcelId ?? initialParcel.provenance?.providerParcelId ?? ""} />
          <input type="hidden" name="existingConfidenceScore" value={initialParcel.confidenceScore != null ? String(initialParcel.confidenceScore) : ""} />
        </>
      ) : null}

      <SectionCard
        eyebrow="Fallback parcel intake"
        title="Site identity"
        description="Capture the minimum manual parcel context needed to continue into planning and scenario work."
      >
        <div className="field-grid">
          <div className="field-grid field-grid--single">
            <ParcelField
              id="name"
              label="Parcel name"
              helpText="Use a clear internal site name so the parcel remains legible across planning and scenario work."
              defaultValue={initialParcel?.name ?? ""}
            />
          </div>
          <ParcelField
            id="cadastralId"
            label="Cadastral ID"
            helpText="Useful when the site is currently known through a land-register or parcel reference."
            defaultValue={initialParcel?.cadastralId ?? ""}
          />
          <ParcelField
            id="landAreaSqm"
            label="Land area sqm"
            helpText="Useful for Sprint 1, but long-term product direction expects source-derived geometry and area."
            defaultValue={initialParcel?.landAreaSqm ?? ""}
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Location context"
        title="Place and municipality"
        description="Keep the parcel grounded in place so planning assumptions and scenario review remain interpretable."
      >
        <div className="field-grid">
          <div className="field-grid field-grid--single">
            <ParcelField
              id="addressLine1"
              label="Address"
              helpText="Use the best known site address or descriptive location line."
              defaultValue={initialParcel?.addressLine1 ?? ""}
            />
          </div>
          <ParcelField id="city" label="City" helpText="Primary city or locality." defaultValue={initialParcel?.city ?? ""} />
          <ParcelField id="postalCode" label="Postal code" helpText="Helpful for site review and sourcing context." defaultValue={initialParcel?.postalCode ?? ""} />
          <ParcelField id="stateCode" label="State code" helpText="Use the applicable German state code when known." defaultValue={initialParcel?.stateCode ?? ""} />
          <ParcelField id="countryCode" label="Country code" helpText="Defaults to DE for the current demo workflow." defaultValue={initialParcel?.countryCode ?? "DE"} />
          <ParcelField id="municipalityName" label="Municipality" helpText="Administrative context for planning and subsidy interpretation." defaultValue={initialParcel?.municipalityName ?? ""} />
          <ParcelField id="districtName" label="District" helpText="Optional district or neighborhood identifier." defaultValue={initialParcel?.districtName ?? ""} />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Guardrails"
        title="Why this form stays narrow"
        description="The parcel workflow should remain usable without over-investing in manual site authoring."
        tone="muted"
      >
        <div className="content-stack">
          <div className="field-help">
            Geometry editing stays out of the web flow. Real parcel intake is expected to come from source-selected
            parcel IDs, geometry, and derived area, while this form remains a practical fallback.
          </div>
          <ActionRow spread className="form-footer">
            <div className="field-help">Save the parcel, then continue into planning inputs or scenario creation.</div>
            <Button type="submit" size="lg">{submitLabel}</Button>
          </ActionRow>
        </div>
      </SectionCard>
    </form>
  );
}
