"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AcquisitionType,
  OptimizationTarget,
  ScenarioGovernanceStatus,
  StrategyType,
  type ParcelDto,
  type ScenarioAssumptionTemplateDto,
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
  scenarioGovernanceStatusLabels,
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

function getParcelSelectionLabel(parcel: ParcelDto) {
  const base = parcel.name ?? parcel.cadastralId ?? parcel.id;
  const authorityLabel = parcel.provenance?.sourceAuthority === "CADASTRAL_GRADE"
    ? "cadastral"
    : parcel.provenance?.sourceAuthority === "SEARCH_GRADE"
      ? "search-grade"
      : parcel.provenance?.sourceAuthority === "DEMO"
        ? "demo"
        : null;
  if (parcel.isGroupSite) {
    const memberCount = parcel.parcelGroup?.memberCount ?? parcel.constituentParcels.length;
    return `${base} / grouped site / ${memberCount} parcel${memberCount === 1 ? "" : "s"}${authorityLabel ? ` / ${authorityLabel}` : ""}`;
  }

  if (parcel.provenance?.trustMode === "MANUAL_FALLBACK") {
    return `${base} / manual fallback`;
  }

  return `${base} / ${authorityLabel ?? "source-backed"}`;
}

function getParcelSelectionRank(parcel: ParcelDto) {
  if (parcel.isGroupSite) return 0;
  if (parcel.provenance?.sourceAuthority === "CADASTRAL_GRADE") return 1;
  if (parcel.provenance?.sourceAuthority === "SEARCH_GRADE") return 2;
  if (parcel.provenance?.sourceAuthority === "DEMO") return 3;
  if (parcel.provenance?.trustMode === "SOURCE_PRIMARY" || parcel.provenance?.trustMode === "SOURCE_INCOMPLETE") return 1;
  return 4;
}

function getWritableParcelId(parcel: ParcelDto | null | undefined) {
  if (!parcel) return "";
  if (parcel.parcelGroupId && !parcel.isGroupSite) {
    return parcel.parcelGroup?.siteParcelId ?? parcel.id;
  }
  return parcel.id;
}

function getDefaultTemplate(
  templates: ScenarioAssumptionTemplateDto[],
  workspaceDefaultTemplateKey?: string | null,
  initialScenario?: ScenarioDto,
) {
  const assumptionSet = initialScenario?.assumptionSet ?? null;
  if (assumptionSet?.templateKey) {
    return templates.find((template) => template.key === assumptionSet.templateKey) ?? null;
  }

  if (workspaceDefaultTemplateKey) {
    return templates.find((template) => template.key === workspaceDefaultTemplateKey) ?? null;
  }

  if (assumptionSet?.profileKey) {
    return templates.find((template) => template.profileKey === assumptionSet.profileKey) ?? null;
  }

  return templates[0] ?? null;
}

function getSuggestedScenarioName(
  parcel: ParcelDto | null,
  strategyType: StrategyType,
  templateName: string,
) {
  const siteLabel = parcel?.name ?? parcel?.cadastralId ?? "Selected site";
  const strategyLabel = strategyTypeLabels[strategyType];
  return `${siteLabel} / ${strategyLabel} / ${templateName}`;
}

export function ScenarioEditorForm({
  action,
  parcels,
  templates,
  workspaceDefaultTemplateKey,
  initialScenario,
  initialParcelId,
  submitLabel,
  mode = initialScenario ? "builder" : "create",
}: {
  action: (formData: FormData) => void | Promise<void>;
  parcels: ParcelDto[];
  templates: ScenarioAssumptionTemplateDto[];
  workspaceDefaultTemplateKey?: string | null;
  initialScenario?: ScenarioDto;
  initialParcelId?: string | null;
  submitLabel: string;
  mode?: FormMode;
}) {
  const initialStrategy = initialScenario?.strategyType ?? StrategyType.FREE_MARKET_RENTAL;
  const initialSelectedParcelId = useMemo(() => {
    const requestedParcelId = initialScenario?.parcelId ?? initialParcelId ?? "";
    if (!requestedParcelId) return "";

    const requestedParcel = parcels.find((parcel) => parcel.id === requestedParcelId) ?? null;
    return getWritableParcelId(requestedParcel) || requestedParcelId;
  }, [initialParcelId, initialScenario?.parcelId, parcels]);
  const initialAssumptionSet = initialScenario?.assumptionSet ?? null;
  const defaultTemplate = getDefaultTemplate(templates, workspaceDefaultTemplateKey, initialScenario);
  const [strategyType, setStrategyType] = useState<StrategyType>(initialStrategy);
  const [selectedParcelId, setSelectedParcelId] = useState(initialSelectedParcelId);
  const [governanceStatus, setGovernanceStatus] = useState<ScenarioGovernanceStatus>(
    initialScenario?.governanceStatus ?? ScenarioGovernanceStatus.DRAFT,
  );
  const [isCurrentBest, setIsCurrentBest] = useState(initialScenario?.isCurrentBest ?? false);
  const hint = strategyFieldHints[strategyType];
  const isRequiredNow = (label: string) => hint.requiredFields.includes(label);
  const selectableParcels = useMemo(
    () => parcels.filter((parcel) => parcel.isGroupSite || !parcel.parcelGroupId),
    [parcels],
  );
  const selectedParcel = useMemo(
    () => selectableParcels.find((parcel) => parcel.id === selectedParcelId) ?? null,
    [selectableParcels, selectedParcelId],
  );
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(defaultTemplate?.key ?? "");
  const sortedParcels = useMemo(
    () => [...selectableParcels].sort((left, right) => {
      const rankDiff = getParcelSelectionRank(left) - getParcelSelectionRank(right);
      if (rankDiff !== 0) return rankDiff;

      const leftLabel = left.name ?? left.cadastralId ?? left.id;
      const rightLabel = right.name ?? right.cadastralId ?? right.id;
      return leftLabel.localeCompare(rightLabel);
    }),
    [selectableParcels],
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === selectedTemplateKey) ?? defaultTemplate,
    [defaultTemplate, selectedTemplateKey, templates],
  );
  const selectedTemplateName = selectedTemplate?.name ?? (initialAssumptionSet?.templateName ?? "Baseline Standard");
  const assumptionProfileKey = selectedTemplate?.profileKey ?? initialAssumptionSet?.profileKey ?? "BASELINE";
  const [nameEdited, setNameEdited] = useState(Boolean(initialScenario?.name));
  const suggestedScenarioName = useMemo(
    () => getSuggestedScenarioName(selectedParcel, strategyType, selectedTemplateName),
    [selectedParcel, strategyType, selectedTemplateName],
  );
  const [nameValue, setNameValue] = useState(initialScenario?.name ?? suggestedScenarioName);
  useEffect(() => {
    if (!nameEdited) {
      setNameValue(suggestedScenarioName);
    }
  }, [nameEdited, suggestedScenarioName]);
  useEffect(() => {
    if (governanceStatus !== ScenarioGovernanceStatus.ACTIVE_CANDIDATE) {
      setIsCurrentBest(false);
    }
  }, [governanceStatus]);
  const selectedParcelSignal = selectedParcel
    ? selectedParcel.isGroupSite
      ? "Grouped site"
      : selectedParcel.provenance?.trustMode === "MANUAL_FALLBACK"
        ? "Manual fallback"
        : "Source-backed"
    : "Select parcel";
  const selectedTemplateIsWorkspaceDefault = selectedTemplate?.key === workspaceDefaultTemplateKey;

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
            <span className="meta-chip">{selectedParcelSignal}</span>
            <span className="meta-chip">{strategyTypeLabels[strategyType]}</span>
            <span className="meta-chip">{selectedTemplateName}</span>
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
            <div className="field-stack">
              <div className="field-row">
                <Label htmlFor="name">Scenario name</Label>
                <FieldTag requiredNow />
              </div>
              <Input
                id="name"
                name="name"
                value={nameValue}
                onChange={(event) => {
                  setNameValue(event.target.value);
                  setNameEdited(Boolean(event.target.value.trim()));
                }}
                required
              />
              <div className="field-help">Defaults to parcel, strategy, and template so scenario sets stay readable as the board grows.</div>
            </div>

            <div className="field-stack">
              <div className="field-row">
                <Label htmlFor="parcelId">Linked site</Label>
                <FieldTag requiredNow />
              </div>
              <select
                id="parcelId"
                name="parcelId"
                defaultValue={initialSelectedParcelId}
                onChange={(event) => setSelectedParcelId(event.target.value)}
                className="ui-select"
              >
                <option value="">Select parcel or grouped site</option>
                {sortedParcels.map((parcel) => (
                  <option key={parcel.id} value={parcel.id}>
                    {getParcelSelectionLabel(parcel)}
                  </option>
                ))}
              </select>
              <input type="hidden" name="parcelGroupId" value={selectedParcel?.parcelGroupId ?? initialScenario?.parcelGroupId ?? ""} />
              <input type="hidden" name="selectedParcelLabel" value={selectedParcel?.name ?? selectedParcel?.cadastralId ?? ""} />
              <div className="field-help">Grouped sites and source-backed parcels are listed first so the case stays tied to sourced site identity before feasibility work begins.</div>
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

          <div className="field-grid field-grid--tri">
            <div className="field-stack">
              <div className="field-row">
                <Label htmlFor="governanceStatus">Lifecycle</Label>
                <FieldTag requiredNow={mode === "builder"} />
              </div>
              <select
                id="governanceStatus"
                name="governanceStatus"
                value={governanceStatus}
                onChange={(event) => setGovernanceStatus(event.target.value as ScenarioGovernanceStatus)}
                className="ui-select"
              >
                {Object.values(ScenarioGovernanceStatus).map((value) => (
                  <option key={value} value={value}>{scenarioGovernanceStatusLabels[value]}</option>
                ))}
              </select>
              <div className="field-help">
                Draft keeps exploratory cases out of the default working set. Archive variants once they are no longer part of the live decision set.
              </div>
            </div>

            <div className="field-stack">
              <div className="field-row">
                <Label htmlFor="isCurrentBest">Family lead</Label>
                <FieldTag requiredNow={false} />
              </div>
              <label className="checkbox-row" htmlFor="isCurrentBest">
                <input
                  id="isCurrentBest"
                  name="isCurrentBest"
                  type="checkbox"
                  checked={isCurrentBest}
                  disabled={governanceStatus !== ScenarioGovernanceStatus.ACTIVE_CANDIDATE}
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    setIsCurrentBest(nextChecked);
                    if (nextChecked) {
                      setGovernanceStatus(ScenarioGovernanceStatus.ACTIVE_CANDIDATE);
                    }
                  }}
                />
                <span>Mark this case as the current lead in its family</span>
              </label>
              <div className="field-help">
                Leads should stay rare and explicit. Only active candidates can be treated as the current best case for a site-strategy family.
              </div>
            </div>

            <div className="field-stack">
              <div className="field-row">
                <Label>Scenario family</Label>
                <FieldTag requiredNow={false} />
              </div>
              <div className="chip-row">
                <Badge variant={selectedParcel?.isGroupSite ? "accent" : "surface"}>{selectedParcelSignal}</Badge>
                <Badge variant="surface">{strategyTypeLabels[strategyType]}</Badge>
                {initialScenario?.familyVersion ? <Badge variant="surface">v{initialScenario.familyVersion}</Badge> : null}
                {initialScenario?.isCurrentBest ? <Badge variant="accent">Current lead</Badge> : null}
              </div>
              <div className="field-help">
                Families group scenarios by site anchor, strategy, and decision target so variants stay understandable as the workspace grows.
              </div>
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
            <Badge variant="accent">{selectedTemplateName}</Badge>
            <Badge variant="surface">{assumptionProfileLabels[assumptionProfileKey]}</Badge>
            {selectedTemplateIsWorkspaceDefault ? <Badge variant="surface">Workspace default</Badge> : null}
            <Badge variant="surface">{assumptionOverrideCount} override{assumptionOverrideCount === 1 ? "" : "s"}</Badge>
          </div>
        )}
      >
        <div className="content-stack">
          <div className="field-grid field-grid--tri">
            <div className="field-stack">
              <div className="field-row">
                <Label htmlFor="assumptionTemplateKey">Template</Label>
                <FieldTag requiredNow={mode === "builder"} />
              </div>
              <select
                id="assumptionTemplateKey"
                name="assumptionTemplateKey"
                value={selectedTemplateKey}
                onChange={(event) => setSelectedTemplateKey(event.target.value)}
                className="ui-select"
              >
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.name}{template.isWorkspaceDefault ? " / workspace default" : ""}
                  </option>
                ))}
              </select>
              <input type="hidden" name="assumptionProfileKey" value={assumptionProfileKey} />
              <input type="hidden" name="assumptionTemplateName" value={selectedTemplateName} />
              <div className="field-help">
                {selectedTemplate
                  ? `${selectedTemplate.description} Uses the ${assumptionProfileLabels[selectedTemplate.profileKey].toLowerCase()} posture as the reusable base.${selectedTemplateIsWorkspaceDefault ? " This is also the current workspace default." : ""}`
                  : "Choose the reusable base posture, then override only what is case-specific."}
              </div>
            </div>

            <div className="field-stack">
              <div className="field-row">
                <Label htmlFor="applyWorkspaceDefaultTemplate">Workspace default</Label>
                <FieldTag requiredNow={false} />
              </div>
              <label className="checkbox-row" htmlFor="applyWorkspaceDefaultTemplate">
                <input
                  id="applyWorkspaceDefaultTemplate"
                  name="applyWorkspaceDefaultTemplate"
                  type="checkbox"
                  defaultChecked={false}
                />
                <span>Set the selected template as the workspace default</span>
              </label>
              <div className="field-help">
                Use this sparingly. It changes the default assumption posture for new scenario setup across the workspace.
              </div>
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

          {selectedTemplate ? (
            <div className="chip-row">
              <Badge variant="surface">Planning buffer {selectedTemplate.defaults.planningBufferPct}</Badge>
              <Badge variant="surface">Efficiency {selectedTemplate.defaults.efficiencyFactorPct}</Badge>
              <Badge variant="surface">Vacancy {selectedTemplate.defaults.vacancyPct}</Badge>
              <Badge variant="surface">Contingency {selectedTemplate.defaults.contingencyPct}</Badge>
            </div>
          ) : null}

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
