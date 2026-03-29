"use client";

import { useMemo, useState } from "react";
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
  className,
}: {
  id: string;
  label: string;
  helpText?: string;
  defaultValue?: string | null;
  requiredNow?: boolean;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className ?? "field-stack"}>
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
  rows = 4,
  className,
}: {
  id: string;
  label: string;
  helpText?: string;
  defaultValue?: string | null;
  requiredNow?: boolean;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={className ?? "field-stack"}>
      <div className="field-row">
        <Label htmlFor={id}>{label}</Label>
        <FieldTag requiredNow={requiredNow} />
      </div>
      <Textarea id={id} name={id} rows={rows} defaultValue={defaultValue ?? ""} className="ui-textarea--compact" />
      {helpText ? <div className="field-help">{helpText}</div> : null}
    </div>
  );
}

function summarizeRequiredFields(fields: string[]) {
  if (!fields.length) return "No immediate blockers";
  if (fields.length <= 2) return fields.join(" / ");
  return `${fields.slice(0, 2).join(" / ")} +${fields.length - 2}`;
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
  const initialSelectedParcelId = initialScenario?.parcelId ?? initialParcelId ?? "";
  const [strategyType, setStrategyType] = useState<StrategyType>(initialStrategy);
  const [selectedParcelId, setSelectedParcelId] = useState(initialSelectedParcelId);
  const hint = strategyFieldHints[strategyType];
  const isRequiredNow = (label: string) => hint.requiredFields.includes(label);
  const selectedParcel = useMemo(
    () => parcels.find((parcel) => parcel.id === selectedParcelId) ?? null,
    [parcels, selectedParcelId],
  );

  return (
    <form action={action} className="form-stack">
      <SectionCard
        eyebrow="Current input focus"
        title={hint.title}
        description="Anchor the case, cover the core assumptions, then move into funding and readiness."
        tone="accent"
        size="compact"
      >
        <div className="content-stack">
          <div className="ops-summary-grid ops-summary-grid--builder">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Parcel</div>
              <div className="ops-summary-item__value">
                {selectedParcel?.name ?? selectedParcel?.cadastralId ?? "Select parcel"}
              </div>
              <div className="ops-summary-item__detail">Keep the case tied to a real site.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Strategy</div>
              <div className="ops-summary-item__value">{strategyTypeLabels[strategyType]}</div>
              <div className="ops-summary-item__detail">{optimizationTargetLabels[initialScenario?.optimizationTarget ?? OptimizationTarget.MIN_REQUIRED_EQUITY]}</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Core now</div>
              <div className="ops-summary-item__value">{hint.requiredFields.length} field(s)</div>
              <div className="ops-summary-item__detail">{summarizeRequiredFields(hint.requiredFields)}</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Secondary</div>
              <div className="ops-summary-item__value">Acquisition, target, notes</div>
              <div className="ops-summary-item__detail">Useful, but not the first blockers to clear.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Next</div>
              <div className="ops-summary-item__value">Save, fund, run</div>
              <div className="ops-summary-item__detail">Funding stack and readiness sit immediately after save.</div>
            </div>
          </div>

          <div className="chip-row">
            {hint.requiredFields.map((field) => (
              <Badge key={field} variant="accent">{field}</Badge>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Scenario framing"
        title="Case definition"
        description="Cover the few setup fields that shape the case."
        size="compact"
      >
        <div className="content-stack">
          <div className="field-grid field-grid--tri">
            <TextField
              id="name"
              label="Scenario name"
              defaultValue={initialScenario?.name ?? ""}
              requiredNow
              required
            />
          <div className="field-stack">
            <div className="field-row">
              <Label htmlFor="parcelId">Linked parcel</Label>
              <FieldTag requiredNow />
            </div>
            <select
              id="parcelId"
              name="parcelId"
              defaultValue={initialSelectedParcelId}
              onChange={(event) => setSelectedParcelId(event.target.value)}
              className="ui-select"
            >
              <option value="">Select parcel</option>
              {parcels.map((parcel) => (
                <option key={parcel.id} value={parcel.id}>
                  {parcel.name ?? parcel.cadastralId ?? parcel.id}
                </option>
              ))}
            </select>
            <div className="field-help">Keep the case site-linked.</div>
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
            <div className="field-help">Sets which revenue inputs matter now.</div>
          </div>
          </div>

          <TextAreaField
            id="description"
            label="Description"
            defaultValue={initialScenario?.description ?? ""}
            rows={3}
            className="field-stack field-stack--span-full"
          />

          <details className="compact-disclosure" open={Boolean(initialScenario?.description || initialScenario?.strategyMixJson)}>
            <summary className="compact-disclosure__summary">Advanced framing</summary>
            <div className="compact-disclosure__body">
              <div className="field-grid field-grid--tri">
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
                  <div className="field-help">Decision lens.</div>
                </div>

                <TextAreaField
                  id="strategyMixJson"
                  label="Temporary mix configuration JSON"
                  helpText="Only needed for Mixed Strategy in Sprint 1."
                  defaultValue={initialScenario?.strategyMixJson ? JSON.stringify(initialScenario.strategyMixJson, null, 2) : ""}
                  requiredNow={isRequiredNow("Temporary mix configuration JSON")}
                  rows={6}
                  className="field-stack field-stack--span-full"
                />
              </div>
            </div>
          </details>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Revenue assumptions"
        title="Revenue"
        description="Fill only the strategy-critical revenue inputs first."
        size="compact"
      >
        <div className="field-grid field-grid--tri">
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
        description="Cover the few assumptions that most change the result."
        size="compact"
      >
        <div className="field-grid field-grid--tri">
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
        description="Save first, then funding and run."
        tone="muted"
        size="compact"
      >
        <ActionRow spread className="form-footer">
          <div className="field-help">Core badges mark the inputs most likely to block readiness.</div>
          <Button type="submit" size="lg">{submitLabel}</Button>
        </ActionRow>
      </SectionCard>
    </form>
  );
}
