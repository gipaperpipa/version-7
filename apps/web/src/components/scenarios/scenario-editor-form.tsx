"use client";

import { useState } from "react";
import { AcquisitionType, OptimizationTarget, StrategyType, type ParcelDto, type ScenarioDto } from "@repo/contracts";
import { ActionRow } from "@/components/ui/action-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import {
  acquisitionTypeLabels,
  optimizationTargetLabels,
  strategyFieldHints,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";

function FieldTag({ requiredNow }: { requiredNow: boolean }) {
  return <Badge variant={requiredNow ? "accent" : "surface"}>{requiredNow ? "Core now" : "Later"}</Badge>;
}

function TextField({
  id,
  label,
  helpText,
  defaultValue,
  requiredNow = false,
  required = false,
}: {
  id: string;
  label: string;
  helpText?: string;
  defaultValue?: string | null;
  requiredNow?: boolean;
  required?: boolean;
}) {
  return (
    <div className="field-stack">
      <div className="field-row">
        <Label htmlFor={id}>{label}</Label>
        <FieldTag requiredNow={requiredNow} />
      </div>
      <Input id={id} name={id} defaultValue={defaultValue ?? ""} required={required} />
      {helpText ? <div className="field-help">{helpText}</div> : null}
    </div>
  );
}

function TextAreaField({
  id,
  label,
  helpText,
  defaultValue,
  requiredNow = false,
}: {
  id: string;
  label: string;
  helpText?: string;
  defaultValue?: string | null;
  requiredNow?: boolean;
}) {
  return (
    <div className="field-stack">
      <div className="field-row">
        <Label htmlFor={id}>{label}</Label>
        <FieldTag requiredNow={requiredNow} />
      </div>
      <Textarea id={id} name={id} defaultValue={defaultValue ?? ""} />
      {helpText ? <div className="field-help">{helpText}</div> : null}
    </div>
  );
}

export function ScenarioEditorForm({
  action,
  parcels,
  initialScenario,
  initialParcelId,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  parcels: ParcelDto[];
  initialScenario?: ScenarioDto;
  initialParcelId?: string | null;
  submitLabel: string;
}) {
  const initialStrategy = initialScenario?.strategyType ?? StrategyType.FREE_MARKET_RENTAL;
  const [strategyType, setStrategyType] = useState<StrategyType>(initialStrategy);
  const hint = strategyFieldHints[strategyType];
  const isRequiredNow = (label: string) => hint.requiredFields.includes(label);

  return (
    <form action={action} className="form-stack">
      <section className="scenario-hint">
        <div className="eyebrow">Decision framing</div>
        <h2 className="scenario-hint__title">{hint.title}</h2>
        <p className="scenario-hint__description">{hint.description}</p>
        <div className="chip-row" style={{ marginTop: 16 }}>
          {hint.requiredFields.map((field) => (
            <Badge key={field} variant="accent">{field}</Badge>
          ))}
        </div>
      </section>

      <SectionCard
        eyebrow="Scenario framing"
        title="Case definition"
        description="Anchor parcel, strategy, and decision lens."
        size="compact"
      >
        <div className="field-grid">
          <div className="field-grid field-grid--single">
            <TextField
              id="name"
              label="Scenario name"
              defaultValue={initialScenario?.name ?? ""}
              requiredNow
              required
            />
          </div>

          <div className="field-grid field-grid--single">
            <TextAreaField
              id="description"
              label="Description"
              defaultValue={initialScenario?.description ?? ""}
            />
          </div>

          <div className="field-stack">
            <div className="field-row">
              <Label htmlFor="parcelId">Linked parcel</Label>
              <FieldTag requiredNow />
            </div>
            <select
              id="parcelId"
              name="parcelId"
              defaultValue={initialScenario?.parcelId ?? initialParcelId ?? ""}
              className="ui-select"
            >
              <option value="">Select parcel</option>
              {parcels.map((parcel) => (
                <option key={parcel.id} value={parcel.id}>
                  {parcel.name ?? parcel.cadastralId ?? parcel.id}
                </option>
              ))}
            </select>
            <div className="field-help">Keep the case anchored to a real site.</div>
          </div>

          <div className="field-stack">
            <div className="field-row">
              <Label htmlFor="strategyType">Strategy</Label>
              <FieldTag requiredNow />
            </div>
            <select
              id="strategyType"
              name="strategyType"
              defaultValue={initialStrategy}
              onChange={(event) => setStrategyType(event.target.value as StrategyType)}
              className="ui-select"
            >
              {Object.values(StrategyType).map((value) => (
                <option key={value} value={value}>{strategyTypeLabels[value]}</option>
              ))}
            </select>
            <div className="field-help">Changes which revenue inputs matter now.</div>
          </div>

          <div className="field-stack">
            <div className="field-row">
              <Label htmlFor="acquisitionType">Acquisition</Label>
              <FieldTag requiredNow={false} />
            </div>
            <select
              id="acquisitionType"
              name="acquisitionType"
              defaultValue={initialScenario?.acquisitionType ?? AcquisitionType.BUY}
              className="ui-select"
            >
              {Object.values(AcquisitionType).map((value) => (
                <option key={value} value={value}>{acquisitionTypeLabels[value]}</option>
              ))}
            </select>
          </div>

          <div className="field-stack">
            <div className="field-row">
              <Label htmlFor="optimizationTarget">Optimization target</Label>
              <FieldTag requiredNow={false} />
            </div>
            <select
              id="optimizationTarget"
              name="optimizationTarget"
              defaultValue={initialScenario?.optimizationTarget ?? OptimizationTarget.MIN_REQUIRED_EQUITY}
              className="ui-select"
            >
              {Object.values(OptimizationTarget).map((value) => (
                <option key={value} value={value}>{optimizationTargetLabels[value]}</option>
              ))}
            </select>
            <div className="field-help">Choose the decision lens.</div>
          </div>

          <div className="field-grid field-grid--single">
            <TextAreaField
              id="strategyMixJson"
              label="Temporary mix configuration JSON"
              helpText="Only needed for Mixed Strategy in Sprint 1."
              defaultValue={initialScenario?.strategyMixJson ? JSON.stringify(initialScenario.strategyMixJson, null, 2) : ""}
              requiredNow={isRequiredNow("Temporary mix configuration JSON")}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Revenue assumptions"
        title="Revenue"
        description="Set the commercial logic the case should support."
        size="compact"
      >
        <div className="field-grid">
          <TextField
            id="targetMarketRentEurSqm"
            label="Market rent EUR/sqm"
            helpText="Critical for free-market rental and student housing."
            defaultValue={initialScenario?.targetMarketRentEurSqm ?? ""}
            requiredNow={isRequiredNow("Market rent EUR/sqm")}
          />
          <TextField
            id="targetSubsidizedRentEurSqm"
            label="Subsidized rent EUR/sqm"
            helpText="Required for subsidized rental cases."
            defaultValue={initialScenario?.targetSubsidizedRentEurSqm ?? ""}
            requiredNow={isRequiredNow("Subsidized rent EUR/sqm")}
          />
          <TextField
            id="subsidizedSharePct"
            label="Subsidized share pct"
            helpText="Needed when only part of the scheme qualifies."
            defaultValue={initialScenario?.subsidizedSharePct ?? ""}
            requiredNow={isRequiredNow("Subsidized share pct")}
          />
          <TextField
            id="targetSalesPriceEurSqm"
            label="Sales price EUR/sqm"
            helpText="Critical for build-to-sell cases."
            defaultValue={initialScenario?.targetSalesPriceEurSqm ?? ""}
            requiredNow={isRequiredNow("Sales price EUR/sqm")}
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Finance and delivery"
        title="Cost and program"
        description="Shape unitization, cost, and capital need before funding."
        size="compact"
      >
        <div className="field-grid">
          <TextField
            id="avgUnitSizeSqm"
            label="Average unit size sqm"
            helpText="Used for unit count and parking."
            defaultValue={initialScenario?.avgUnitSizeSqm ?? ""}
            requiredNow={isRequiredNow("Average unit size sqm")}
          />
          <TextField
            id="hardCostPerBgfSqm"
            label="Hard cost per BGF sqm"
            helpText="Major cost driver."
            defaultValue={initialScenario?.hardCostPerBgfSqm ?? ""}
            requiredNow={isRequiredNow("Hard cost per BGF sqm")}
          />
          <TextField
            id="landCost"
            label="Land cost"
            helpText="Critical for meaningful break-even output."
            defaultValue={initialScenario?.landCost ?? ""}
            requiredNow={isRequiredNow("Land cost")}
          />
          <TextField
            id="softCostPct"
            label="Soft cost pct"
            helpText="Overhead on hard costs."
            defaultValue={initialScenario?.softCostPct ?? ""}
          />
          <TextField
            id="parkingCostPerSpace"
            label="Parking cost per space"
            helpText="Useful when parking materially changes cost."
            defaultValue={initialScenario?.parkingCostPerSpace ?? ""}
          />
          <TextField
            id="equityTargetPct"
            label="Equity target pct"
            helpText="Use when the case targets a specific equity posture."
            defaultValue={initialScenario?.equityTargetPct ?? ""}
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Save"
        title="Save"
        description="Save first. Then funding, readiness, run."
        tone="muted"
        size="compact"
      >
        <ActionRow spread className="form-footer">
          <div className="field-help">Core badges mark the fields most likely to block readiness.</div>
          <Button type="submit" size="lg">{submitLabel}</Button>
        </ActionRow>
      </SectionCard>
    </form>
  );
}
