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
  return <Badge variant={requiredNow ? "accent" : "surface"}>{requiredNow ? "Required now" : "Optional"}</Badge>;
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
  helpText: string;
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
      <div className="field-help">{helpText}</div>
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
  helpText: string;
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
      <div className="field-help">{helpText}</div>
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
        title="Core case definition"
        description="Anchor the decision case in a parcel, strategy, and optimization lens."
      >
        <div className="field-grid">
          <div className="field-grid field-grid--single">
            <TextField
              id="name"
              label="Scenario name"
              helpText="Use a clear case name that remains legible in lists and results."
              defaultValue={initialScenario?.name ?? ""}
              requiredNow
              required
            />
          </div>

          <div className="field-grid field-grid--single">
            <TextAreaField
              id="description"
              label="Description"
              helpText="Capture the intent of the case, not a long working note."
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
            <div className="field-help">The scenario must stay attached to a real site context.</div>
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
            <div className="field-help">The selected strategy changes the readiness-critical revenue fields.</div>
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
            <div className="field-help">Use the deal posture you want this scenario to test.</div>
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
            <div className="field-help">Choose the output lens that best matches the decision you need.</div>
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
        title="Commercial outputs"
        description="Tell the engine what revenue logic this scenario should support."
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
            helpText="Required for subsidized rental scenarios."
            defaultValue={initialScenario?.targetSubsidizedRentEurSqm ?? ""}
            requiredNow={isRequiredNow("Subsidized rent EUR/sqm")}
          />
          <TextField
            id="subsidizedSharePct"
            label="Subsidized share pct"
            helpText="Needed when only part of the scheme is assumed to qualify."
            defaultValue={initialScenario?.subsidizedSharePct ?? ""}
            requiredNow={isRequiredNow("Subsidized share pct")}
          />
          <TextField
            id="targetSalesPriceEurSqm"
            label="Sales price EUR/sqm"
            helpText="Critical for build-to-sell scenarios."
            defaultValue={initialScenario?.targetSalesPriceEurSqm ?? ""}
            requiredNow={isRequiredNow("Sales price EUR/sqm")}
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Finance and delivery"
        title="Cost and program assumptions"
        description="These values shape unitization, development cost, and capital need before funding is applied."
      >
        <div className="field-grid">
          <TextField
            id="avgUnitSizeSqm"
            label="Average unit size sqm"
            helpText="Helps estimate unit count and parking demand."
            defaultValue={initialScenario?.avgUnitSizeSqm ?? ""}
            requiredNow={isRequiredNow("Average unit size sqm")}
          />
          <TextField
            id="hardCostPerBgfSqm"
            label="Hard cost per BGF sqm"
            helpText="A major cost driver in Sprint 1 feasibility."
            defaultValue={initialScenario?.hardCostPerBgfSqm ?? ""}
            requiredNow={isRequiredNow("Hard cost per BGF sqm")}
          />
          <TextField
            id="landCost"
            label="Land cost"
            helpText="Important for meaningful break-even outputs."
            defaultValue={initialScenario?.landCost ?? ""}
            requiredNow={isRequiredNow("Land cost")}
          />
          <TextField
            id="softCostPct"
            label="Soft cost pct"
            helpText="Overhead multiplier layered onto hard costs."
            defaultValue={initialScenario?.softCostPct ?? ""}
          />
          <TextField
            id="parkingCostPerSpace"
            label="Parking cost per space"
            helpText="Useful when parking materially shapes the cost profile."
            defaultValue={initialScenario?.parkingCostPerSpace ?? ""}
          />
          <TextField
            id="equityTargetPct"
            label="Equity target pct"
            helpText="Use when the case needs a preferred equity posture."
            defaultValue={initialScenario?.equityTargetPct ?? ""}
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Save"
        title="Commit the scenario inputs"
        description="Save first, then use the funding and readiness rail to move into a run."
        tone="muted"
      >
        <ActionRow spread className="form-footer">
          <div className="field-help">
            Fields marked "Required now" are the ones most likely to block readiness for the selected strategy.
          </div>
          <Button type="submit" size="lg">{submitLabel}</Button>
        </ActionRow>
      </SectionCard>
    </form>
  );
}
