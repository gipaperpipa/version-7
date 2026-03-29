"use client";

import { useMemo, useState } from "react";
import {
  FinancingSourceType,
  FundingProviderType,
  type FundingProgramDto,
  type FundingProgramVariantDto,
  type ScenarioFundingVariantDto,
} from "@repo/contracts";
import { ActionRow } from "@/components/ui/action-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cx } from "@/lib/ui/cx";

function flattenOptions(programs: FundingProgramDto[], providerType: FundingProviderType) {
  return programs
    .filter((program) => program.providerType === providerType)
    .flatMap((program) =>
      program.variants.map((variant) => ({
        id: variant.id,
        label: `${program.name} / ${variant.name}`,
        variant,
      })),
    );
}

function buildMetadataChips(variant: FundingProgramVariantDto | undefined) {
  if (!variant) return [];

  return [
    variant.interestRatePct || variant.termMonths
      ? `Interest / Term: ${variant.interestRatePct ?? "n/a"}${variant.termMonths ? ` / ${variant.termMonths}m` : ""}`
      : null,
    variant.maxLoanPct ? `Max Loan %: ${variant.maxLoanPct}` : null,
    variant.maxLoanPerSqm ? `Max Loan / sqm: ${variant.maxLoanPerSqm}` : null,
    variant.rentCapEurSqm ? `Rent Cap: ${variant.rentCapEurSqm}` : null,
    variant.subsidyEligibleSharePct ? `Eligible Share: ${variant.subsidyEligibleSharePct}` : null,
    variant.allowsKfwCombination ? "KfW Combo: Allowed" : null,
  ].filter((item): item is string => Boolean(item));
}

function FundingLane({
  label,
  description,
  checkboxName,
  selectName,
  options,
  selectedVariantId,
  defaultChecked,
  onSelectChange,
}: {
  label: string;
  description: string;
  checkboxName: string;
  selectName: string;
  options: Array<{ id: string; label: string; variant: FundingProgramVariantDto }>;
  selectedVariantId: string;
  defaultChecked: boolean;
  onSelectChange: (value: string) => void;
}) {
  const selectedOption = options.find((option) => option.id === selectedVariantId);
  const chips = buildMetadataChips(selectedOption?.variant);

  return (
    <div className={cx("funding-lane", selectedOption && "funding-lane--selected")}>
      <div className="funding-lane__header">
        <Label className="ui-label">
          <input type="checkbox" name={checkboxName} defaultChecked={defaultChecked} />
          {label}
        </Label>
        <StatusBadge tone={selectedOption ? "success" : "neutral"}>
          {selectedOption ? "Selected" : "Optional"}
        </StatusBadge>
      </div>
      <p className="funding-lane__description">{description}</p>
      <select
        name={selectName}
        value={selectedVariantId}
        onChange={(event) => onSelectChange(event.target.value)}
        className="ui-select"
      >
        <option value="">Select variant</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      {chips.length ? (
        <div className="chip-row">
          {chips.map((chip) => (
            <Badge key={chip} variant="surface">{chip}</Badge>
          ))}
        </div>
      ) : (
        <div className="field-help">Choose a variant to show terms.</div>
      )}
    </div>
  );
}

export function FundingStackForm({
  action,
  fundingPrograms,
  selectedItems,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fundingPrograms: FundingProgramDto[];
  selectedItems: ScenarioFundingVariantDto[];
}) {
  const selectedState = selectedItems.find((item) => item.financingSourceType === FinancingSourceType.STATE_SUBSIDY);
  const selectedKfw = selectedItems.find((item) => item.financingSourceType === FinancingSourceType.KFW);
  const selectedFree = selectedItems.find((item) => item.financingSourceType === FinancingSourceType.FREE_FINANCING);
  const stateOptions = useMemo(() => flattenOptions(fundingPrograms, FundingProviderType.STATE_SUBSIDY_BANK), [fundingPrograms]);
  const kfwOptions = useMemo(() => flattenOptions(fundingPrograms, FundingProviderType.KFW), [fundingPrograms]);
  const freeOptions = useMemo(() => flattenOptions(fundingPrograms, FundingProviderType.COMMERCIAL_BANK), [fundingPrograms]);
  const [stateVariantId, setStateVariantId] = useState(selectedState?.fundingProgramVariantId ?? "");
  const [kfwVariantId, setKfwVariantId] = useState(selectedKfw?.fundingProgramVariantId ?? "");
  const [freeVariantId, setFreeVariantId] = useState(selectedFree?.fundingProgramVariantId ?? "");

  return (
    <SectionCard
      eyebrow="Funding stack"
      title="Funding lanes"
      description="Sprint 1 replaces the full stack in one save."
      size="compact"
    >
      <form action={action} className="form-stack">
        <FundingLane
          label="State subsidy"
          description="Subsidy-bank anchor."
          checkboxName="stateSubsidyEnabled"
          selectName="stateSubsidyVariantId"
          options={stateOptions}
          selectedVariantId={stateVariantId}
          defaultChecked={Boolean(selectedState)}
          onSelectChange={setStateVariantId}
        />

        <FundingLane
          label="KfW"
          description="Program debt layer."
          checkboxName="kfwEnabled"
          selectName="kfwVariantId"
          options={kfwOptions}
          selectedVariantId={kfwVariantId}
          defaultChecked={Boolean(selectedKfw)}
          onSelectChange={setKfwVariantId}
        />

        <FundingLane
          label="Free financing"
          description="Flexible market-rate layer."
          checkboxName="freeFinancingEnabled"
          selectName="freeFinancingVariantId"
          options={freeOptions}
          selectedVariantId={freeVariantId}
          defaultChecked={Boolean(selectedFree)}
          onSelectChange={setFreeVariantId}
        />

        <ActionRow spread className="form-footer">
          <div className="field-help">Whole-stack replacement only in Sprint 1.</div>
          <Button type="submit" variant="secondary">Save stack</Button>
        </ActionRow>
      </form>
    </SectionCard>
  );
}
