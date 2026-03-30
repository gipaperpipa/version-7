"use client";

import { useMemo, useState } from "react";
import {
  AcquisitionType,
  AssumptionProfileKey,
  OptimizationTarget,
  StrategyType,
  type ParcelDto,
  type ScenarioDto,
} from "@repo/contracts";
import { ActionRow } from "@/components/ui/action-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import { cx } from "@/lib/ui/cx";
import {
  acquisitionTypeLabels,
  assumptionProfileLabels,
  optimizationTargetLabels,
  strategyFieldHints,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";

type FormMode = "create" | "builder";

type FieldConfig = {
  id: string;
  label: string;
  helpText?: string;
  defaultValue?: string | null;
  requiredNow?: boolean;
  required?: boolean;
};

function FieldTag({ requiredNow }: { requiredNow: boolean }) {
  return <Badge variant={requiredNow ? "accent" : "surface"}>{requiredNow ? "Core now" : "Later"}</Badge>;
}

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function partitionFields<T extends FieldConfig>(fields: T[], shouldShow: (field: T) => boolean) {
  const visible = fields.filter(shouldShow);
  const hidden = fields.filter((field) => !shouldShow(field));

  return { visible, hidden };
}

function renderTextField(field: FieldConfig, className?: string) {
  return (
    <div key={field.id} className={className ?? "field-stack"}>
      <div className="field-row">
        <Label htmlFor={field.id}>{field.label}</Label>
        <FieldTag requiredNow={Boolean(field.requiredNow)} />
      </div>
      <Input id={field.id} name={field.id} defaultValue={field.defaultValue ?? ""} required={field.required} />
      {field.helpText ? <div className="field-help">{field.helpText}</div> : null}
    </div>
  );
}

function summarizeRequiredFields(fields: string[]) {
  if (!fields.length) return "No immediate blockers";
  if (fields.length <= 2) return fields.join(" / ");
  return `${fields.slice(0, 2).join(" / ")} +${fields.length - 2}`;
}

function countFilledFields(fields: FieldConfig[]) {
  return fields.filter((field) => hasValue(field.defaultValue)).length;
}

export function ScenarioEditorForm({
  action,
  parcels,
  initialScenario,
  initialParcelId,
  submitLabel,
  mode = initialScenario ? "builder" : "create",
}: {
  action: (formData: FormData) => void | Promise<void>;
  parcels: ParcelDto[];
  initialScenario?: ScenarioDto;
  initialParcelId?: string | null;
  submitLabel: string;
  mode?: FormMode;
}) {
  const initialStrategy = initialScenario?.strategyType ?? StrategyType.FREE_MARKET_RENTAL;
  const initialSelectedParcelId = initialScenario?.parcelId ?? initialParcelId ?? "";
  const initialAssumptionSet = initialScenario?.assumptionSet ?? null;
  const [strategyType, setStrategyType] = useState<StrategyType>(initialStrategy);
  const [selectedParcelId, setSelectedParcelId] = useState(initialSelectedParcelId);
  const [assumptionProfileKey, setAssumptionProfileKey] = useState<AssumptionProfileKey>(
    initialAssumptionSet?.profileKey ?? AssumptionProfileKey.BASELINE,
  );
  const hint = strategyFieldHints[strategyType];
  const isRequiredNow = (label: string) => hint.requiredFields.includes(label);
  const selectedParcel = useMemo(
    () => parcels.find((parcel) => parcel.id === selectedParcelId) ?? null,
    [parcels, selectedParcelId],
  );

  const caseFields: FieldConfig[] = [
    {
      id: "name",
      label: "Scenario name",
      defaultValue: initialScenario?.name ?? "",
      requiredNow: true,
      required: true,
    },
  ];

  const revenueFields: FieldConfig[] = [
    {
      id: "targetMarketRentEurSqm",
      label: "Market rent EUR/sqm",
      helpText: "Critical for free-market rental and student housing.",
      defaultValue: initialScenario?.targetMarketRentEurSqm ?? "",
      requiredNow: isRequiredNow("Market rent EUR/sqm"),
    },
    {
      id: "targetSubsidizedRentEurSqm",
      label: "Subsidized rent EUR/sqm",
      helpText: "Required for subsidized rental cases.",
      defaultValue: initialScenario?.targetSubsidizedRentEurSqm ?? "",
      requiredNow: isRequiredNow("Subsidized rent EUR/sqm"),
    },
    {
      id: "subsidizedSharePct",
      label: "Subsidized share pct",
      helpText: "Needed when only part of the scheme qualifies.",
      defaultValue: initialScenario?.subsidizedSharePct ?? "",
      requiredNow: isRequiredNow("Subsidized share pct"),
    },
    {
      id: "targetSalesPriceEurSqm",
      label: "Sales price EUR/sqm",
      helpText: "Critical for build-to-sell cases.",
      defaultValue: initialScenario?.targetSalesPriceEurSqm ?? "",
      requiredNow: isRequiredNow("Sales price EUR/sqm"),
    },
  ];

  const financeFields: Array<FieldConfig & { priority?: boolean }> = [
    {
      id: "avgUnitSizeSqm",
      label: "Average unit size sqm",
      helpText: "Used for unit count and parking.",
      defaultValue: initialScenario?.avgUnitSizeSqm ?? "",
      requiredNow: isRequiredNow("Average unit size sqm"),
      priority: true,
    },
    {
      id: "hardCostPerBgfSqm",
      label: "Hard cost per BGF sqm",
      helpText: "Major cost driver.",
      defaultValue: initialScenario?.hardCostPerBgfSqm ?? "",
      requiredNow: isRequiredNow("Hard cost per BGF sqm"),
      priority: true,
    },
    {
      id: "landCost",
      label: "Land cost",
      helpText: "Critical for meaningful break-even output.",
      defaultValue: initialScenario?.landCost ?? "",
      requiredNow: isRequiredNow("Land cost"),
      priority: true,
    },
    {
      id: "softCostPct",
      label: "Soft cost pct",
      helpText: "Overhead on hard costs.",
      defaultValue: initialScenario?.softCostPct ?? "",
    },
    {
      id: "parkingCostPerSpace",
      label: "Parking cost per space",
      helpText: "Useful when parking materially changes cost.",
      defaultValue: initialScenario?.parkingCostPerSpace ?? "",
    },
    {
      id: "equityTargetPct",
      label: "Equity target pct",
      helpText: "Use when the case targets a specific equity posture.",
      defaultValue: initialScenario?.equityTargetPct ?? "",
    },
  ];

  const advancedFieldsOpen = Boolean(initialScenario?.description || initialScenario?.strategyMixJson);
  const revenuePartition = partitionFields(revenueFields, (field) => field.requiredNow || hasValue(field.defaultValue));
  const financePartition = partitionFields(financeFields, (field) => field.priority || field.requiredNow || hasValue(field.defaultValue));
  const visibleRevenueFields = revenuePartition.visible.length ? revenuePartition.visible : revenueFields.slice(0, 1);
  const hiddenRevenueFields = revenuePartition.visible.length ? revenuePartition.hidden : revenueFields.slice(1);
  const focusChips = hint.requiredFields.slice(0, 3);
  const focusOverflow = Math.max(hint.requiredFields.length - focusChips.length, 0);
  const builderRevenueFields = revenueFields.filter((field) => field.requiredNow);
  const builderRevenuePrimaryFields = builderRevenueFields.length ? builderRevenueFields : revenueFields.slice(0, 1);
  const builderRevenueExtensions = revenueFields.filter((field) => !builderRevenuePrimaryFields.some((candidate) => candidate.id === field.id));
  const builderFinancePrimaryFields = financeFields.filter((field) => field.priority || field.requiredNow);
  const builderFinanceExtensions = financeFields.filter((field) => !builderFinancePrimaryFields.some((candidate) => candidate.id === field.id));
  const assumptionOverrideCount = Object.values(initialAssumptionSet?.overrides ?? {}).filter((value) => value !== null).length;
  const assumptionFieldsOperating: FieldConfig[] = [
    {
      id: "assumptionPlanningBufferPct",
      label: "Planning buffer pct",
      helpText: "Discount usable BGF to reflect entitlement slippage.",
      defaultValue: initialAssumptionSet?.overrides.planningBufferPct ?? "",
    },
    {
      id: "assumptionEfficiencyFactorPct",
      label: "Efficiency factor pct",
      helpText: "Net-to-gross efficiency used for revenue and unit estimates.",
      defaultValue: initialAssumptionSet?.overrides.efficiencyFactorPct ?? "",
    },
    {
      id: "assumptionVacancyPct",
      label: "Vacancy pct",
      helpText: "Used in rental and student revenue sizing.",
      defaultValue: initialAssumptionSet?.overrides.vacancyPct ?? "",
    },
    {
      id: "assumptionOperatingCostPerNlaSqmYear",
      label: "Operating cost / NLA sqm / year",
      helpText: "Annual opex burden in rental cases.",
      defaultValue: initialAssumptionSet?.overrides.operatingCostPerNlaSqmYear ?? "",
    },
    {
      id: "assumptionAcquisitionClosingCostPct",
      label: "Acquisition closing cost pct",
      helpText: "Added on top of land cost.",
      defaultValue: initialAssumptionSet?.overrides.acquisitionClosingCostPct ?? "",
    },
    {
      id: "assumptionContingencyPct",
      label: "Contingency pct",
      helpText: "Applied to delivery costs.",
      defaultValue: initialAssumptionSet?.overrides.contingencyPct ?? "",
    },
  ];
  const assumptionFieldsCommercial: FieldConfig[] = [
    {
      id: "assumptionDeveloperFeePct",
      label: "Developer fee pct",
      helpText: "Adds delivery overhead on top of total uses.",
      defaultValue: initialAssumptionSet?.overrides.developerFeePct ?? "",
    },
    {
      id: "assumptionTargetProfitPct",
      label: "Target profit pct",
      helpText: "Capitalized return layer for break-even logic.",
      defaultValue: initialAssumptionSet?.overrides.targetProfitPct ?? "",
    },
    {
      id: "assumptionExitCapRatePct",
      label: "Exit cap rate pct",
      helpText: "Used for rental IRR and terminal value.",
      defaultValue: initialAssumptionSet?.overrides.exitCapRatePct ?? "",
    },
    {
      id: "assumptionSalesClosingCostPct",
      label: "Sales closing cost pct",
      helpText: "Applied to gross sale proceeds.",
      defaultValue: initialAssumptionSet?.overrides.salesClosingCostPct ?? "",
    },
    {
      id: "assumptionParkingRevenuePerSpaceMonth",
      label: "Parking revenue / space / month",
      helpText: "Rental parking income assumption.",
      defaultValue: initialAssumptionSet?.overrides.parkingRevenuePerSpaceMonth ?? "",
    },
    {
      id: "assumptionParkingSalePricePerSpace",
      label: "Parking sale price / space",
      helpText: "Sale-side parking monetization assumption.",
      defaultValue: initialAssumptionSet?.overrides.parkingSalePricePerSpace ?? "",
    },
  ];
  const assumptionSalesAbsorptionDefault = initialAssumptionSet?.overrides.salesAbsorptionMonths != null
    ? String(initialAssumptionSet.overrides.salesAbsorptionMonths)
    : "";

  return (
    <form action={action} className="form-stack form-stack--dense">
      {mode === "create" ? (
        <div className="scenario-focus-strip">
          <div className="scenario-focus-strip__body">
            <div className="scenario-focus-strip__title">{hint.title}</div>
            <div className="scenario-focus-strip__description">Create fast, then continue in the builder.</div>
          </div>
          <div className="scenario-focus-strip__signals">
            <span className="meta-chip">{selectedParcel?.name ?? selectedParcel?.cadastralId ?? "Select parcel"}</span>
            <span className="meta-chip">{strategyTypeLabels[strategyType]}</span>
            <span className="meta-chip">{assumptionProfileLabels[assumptionProfileKey]}</span>
            <span className="meta-chip">{summarizeRequiredFields(hint.requiredFields)}</span>
          </div>
          <div className="chip-row">
            {focusChips.map((field) => (
              <Badge key={field} variant="accent">{field}</Badge>
            ))}
            {focusOverflow ? <Badge variant="surface">+{focusOverflow} more</Badge> : null}
          </div>
        </div>
      ) : null}

      <SectionCard
        className={cx("editor-panel", mode === "builder" ? "editor-panel--framing" : "editor-panel--primary")}
        eyebrow="Scenario framing"
        title="Case definition"
        description="Anchor parcel, strategy, and decision lens."
        size="compact"
        actions={mode === "builder" ? (
          <div className="action-row action-row--compact">
            <Badge variant="surface">{selectedParcel?.name ?? selectedParcel?.cadastralId ?? "Select parcel"}</Badge>
            <Badge variant="accent">{strategyTypeLabels[strategyType]}</Badge>
          </div>
        ) : undefined}
      >
        <div className="content-stack">
          <div className="field-grid field-grid--quad">
            {caseFields.map((field) => renderTextField(field))}

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
              <div className="field-help">Sets which revenue inputs matter.</div>
            </div>

            <div className="field-stack">
              <div className="field-row">
                <Label htmlFor="optimizationTarget">Optimization target</Label>
                <FieldTag requiredNow={mode === "create"} />
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
          </div>

          <details className="compact-disclosure" open={advancedFieldsOpen}>
            <summary className="compact-disclosure__summary">Additional framing</summary>
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

                <div className="field-stack field-stack--span-full">
                  <div className="field-row">
                    <Label htmlFor="description">Description</Label>
                    <FieldTag requiredNow={false} />
                  </div>
                  <Textarea
                    id="description"
                    name="description"
                    rows={3}
                    defaultValue={initialScenario?.description ?? ""}
                    className="ui-textarea--compact"
                  />
                </div>

                <div className="field-stack field-stack--span-full">
                  <div className="field-row">
                    <Label htmlFor="strategyMixJson">Temporary mix configuration JSON</Label>
                    <FieldTag requiredNow={isRequiredNow("Temporary mix configuration JSON")} />
                  </div>
                  <Textarea
                    id="strategyMixJson"
                    name="strategyMixJson"
                    rows={6}
                    defaultValue={initialScenario?.strategyMixJson ? JSON.stringify(initialScenario.strategyMixJson, null, 2) : ""}
                    className="ui-textarea--compact"
                  />
                  <div className="field-help">Only needed for Mixed Strategy in Sprint 1.</div>
                </div>
              </div>
            </div>
          </details>
        </div>
      </SectionCard>

      <SectionCard
        className={cx("editor-panel", mode === "builder" ? "editor-panel--framing" : "editor-panel--primary")}
        eyebrow="Assumption set"
        title="Assumption posture"
        description="Explicitly manage the baseline heuristic posture before comparing outputs."
        size="compact"
        actions={(
          <div className="action-row action-row--compact">
            <Badge variant="accent">{assumptionProfileLabels[assumptionProfileKey]}</Badge>
            <Badge variant="surface">{assumptionOverrideCount} override{assumptionOverrideCount === 1 ? "" : "s"}</Badge>
          </div>
        )}
      >
        <div className="content-stack">
          <div className="field-grid field-grid--tri">
            <div className="field-stack">
              <div className="field-row">
                <Label htmlFor="assumptionProfileKey">Profile</Label>
                <FieldTag requiredNow={mode === "builder"} />
              </div>
              <select
                id="assumptionProfileKey"
                name="assumptionProfileKey"
                defaultValue={initialAssumptionSet?.profileKey ?? AssumptionProfileKey.BASELINE}
                onChange={(event) => setAssumptionProfileKey(event.target.value as AssumptionProfileKey)}
                className="ui-select"
              >
                {Object.values(AssumptionProfileKey).map((value) => (
                  <option key={value} value={value}>{assumptionProfileLabels[value]}</option>
                ))}
              </select>
              <div className="field-help">Choose the default realism posture, then override only what is case-specific.</div>
            </div>

            <div className="field-stack field-stack--span-full">
              <div className="field-row">
                <Label htmlFor="assumptionNotes">Assumption notes</Label>
                <FieldTag requiredNow={false} />
              </div>
              <Textarea
                id="assumptionNotes"
                name="assumptionNotes"
                rows={3}
                defaultValue={initialAssumptionSet?.notes ?? ""}
                className="ui-textarea--compact"
              />
            </div>
          </div>

          <div className="editor-extension-grid">
            <details className="editor-extension-panel" open={mode === "builder" || assumptionFieldsOperating.some((field) => hasValue(field.defaultValue))}>
              <summary className="editor-extension-panel__summary">
                <span>Planning and operating overrides</span>
                <span className="editor-extension-panel__meta">
                  {countFilledFields(assumptionFieldsOperating)}/{assumptionFieldsOperating.length} filled
                </span>
              </summary>
              <div className="editor-extension-panel__body">
                <div className="field-grid field-grid--quad">
                  {assumptionFieldsOperating.map((field) => renderTextField(field))}
                </div>
              </div>
            </details>

            <details className="editor-extension-panel" open={mode === "builder" || assumptionFieldsCommercial.some((field) => hasValue(field.defaultValue)) || Boolean(assumptionSalesAbsorptionDefault)}>
              <summary className="editor-extension-panel__summary">
                <span>Commercial and exit overrides</span>
                <span className="editor-extension-panel__meta">
                  {countFilledFields(assumptionFieldsCommercial) + (assumptionSalesAbsorptionDefault ? 1 : 0)}/{assumptionFieldsCommercial.length + 1} filled
                </span>
              </summary>
              <div className="editor-extension-panel__body">
                <div className="field-grid field-grid--quad">
                  {assumptionFieldsCommercial.map((field) => renderTextField(field))}
                  <div className="field-stack">
                    <div className="field-row">
                      <Label htmlFor="assumptionSalesAbsorptionMonths">Sales absorption months</Label>
                      <FieldTag requiredNow={false} />
                    </div>
                    <Input
                      id="assumptionSalesAbsorptionMonths"
                      name="assumptionSalesAbsorptionMonths"
                      type="number"
                      min={1}
                      defaultValue={assumptionSalesAbsorptionDefault}
                    />
                    <div className="field-help">Used when build-to-sell outputs estimate sale-side IRR timing.</div>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </SectionCard>

      {mode === "builder" ? (
        <>
          <SectionCard
            className="editor-panel editor-panel--core"
            eyebrow="Operating assumptions"
            title="Core assumptions"
            description="Edit the few inputs most likely to move readiness and output."
            size="compact"
            actions={(
              <div className="action-row">
                <Badge variant="accent">{countFilledFields(builderRevenuePrimaryFields)}/{builderRevenuePrimaryFields.length} revenue</Badge>
                <Badge variant="surface">{countFilledFields(builderFinancePrimaryFields)}/{builderFinancePrimaryFields.length} cost/program</Badge>
              </div>
            )}
          >
            <div className="editor-core-grid">
              <div className="editor-core-group">
                <div className="editor-core-group__header">
                  <div>
                    <div className="editor-core-group__eyebrow">Revenue signal</div>
                    <div className="editor-core-group__title">Strategy-critical revenue</div>
                  </div>
                  <Badge variant="surface">{builderRevenueExtensions.length} extension{builderRevenueExtensions.length === 1 ? "" : "s"}</Badge>
                </div>
                <div className="field-grid field-grid--quad">
                  {builderRevenuePrimaryFields.map((field) => renderTextField(field))}
                </div>
              </div>

              <div className="editor-core-group">
                <div className="editor-core-group__header">
                  <div>
                    <div className="editor-core-group__eyebrow">Cost and program</div>
                    <div className="editor-core-group__title">Primary delivery inputs</div>
                  </div>
                  <Badge variant="surface">{builderFinanceExtensions.length} extension{builderFinanceExtensions.length === 1 ? "" : "s"}</Badge>
                </div>
                <div className="field-grid field-grid--quad">
                  {builderFinancePrimaryFields.map((field) => renderTextField(field))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            className="editor-panel editor-panel--extensions"
            eyebrow="Model extensions"
            title="Secondary assumptions"
            description="Keep lower-priority inputs available without letting them dominate the page."
            size="compact"
          >
            <div className="editor-extension-grid">
              <details className="editor-extension-panel" open={builderRevenueExtensions.some((field) => hasValue(field.defaultValue))}>
                <summary className="editor-extension-panel__summary">
                  <span>Revenue extensions</span>
                  <span className="editor-extension-panel__meta">
                    {countFilledFields(builderRevenueExtensions)}/{builderRevenueExtensions.length} filled
                  </span>
                </summary>
                <div className="editor-extension-panel__body">
                  <div className="field-grid field-grid--quad">
                    {builderRevenueExtensions.map((field) => renderTextField(field))}
                  </div>
                </div>
              </details>

              <details className="editor-extension-panel" open={builderFinanceExtensions.some((field) => hasValue(field.defaultValue))}>
                <summary className="editor-extension-panel__summary">
                  <span>Cost and program extensions</span>
                  <span className="editor-extension-panel__meta">
                    {countFilledFields(builderFinanceExtensions)}/{builderFinanceExtensions.length} filled
                  </span>
                </summary>
                <div className="editor-extension-panel__body">
                  <div className="field-grid field-grid--quad">
                    {builderFinanceExtensions.map((field) => renderTextField(field))}
                  </div>
                </div>
              </details>
            </div>
          </SectionCard>
        </>
      ) : (
        <div className="editor-secondary-grid">
          <SectionCard
            className="editor-panel editor-panel--core"
            eyebrow="Revenue assumptions"
            title="Revenue"
            description="Fill the strategy-critical inputs first."
            size="compact"
          >
            <div className="content-stack">
              <div className="field-grid field-grid--quad">
                {visibleRevenueFields.map((field) => renderTextField(field))}
              </div>

              {hiddenRevenueFields.length ? (
                <details className="compact-disclosure" open={hiddenRevenueFields.some((field) => hasValue(field.defaultValue))}>
                  <summary className="compact-disclosure__summary">Additional revenue inputs ({hiddenRevenueFields.length})</summary>
                  <div className="compact-disclosure__body">
                    <div className="field-grid field-grid--quad">
                      {hiddenRevenueFields.map((field) => renderTextField(field))}
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            className="editor-panel editor-panel--core"
            eyebrow="Finance and delivery"
            title="Cost and program"
            description="Cover the assumptions that move the result most."
            size="compact"
          >
            <div className="content-stack">
              <div className="field-grid field-grid--quad">
                {financePartition.visible.map((field) => renderTextField(field))}
              </div>

              {financePartition.hidden.length ? (
                <details className="compact-disclosure" open={financePartition.hidden.some((field) => hasValue(field.defaultValue))}>
                  <summary className="compact-disclosure__summary">Additional cost inputs ({financePartition.hidden.length})</summary>
                  <div className="compact-disclosure__body">
                    <div className="field-grid field-grid--quad">
                      {financePartition.hidden.map((field) => renderTextField(field))}
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          </SectionCard>
        </div>
      )}

      <ActionRow spread className={cx("form-actions-bar", mode === "builder" && "form-actions-bar--builder")}>
        <div className="field-help">Core now badges mark the inputs most likely to block readiness.</div>
        <Button type="submit" size="lg">{submitLabel}</Button>
      </ActionRow>
    </form>
  );
}
