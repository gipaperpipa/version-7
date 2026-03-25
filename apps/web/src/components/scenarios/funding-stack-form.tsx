"use client";

import { useMemo, useState } from "react";
import {
  FinancingSourceType,
  FundingProviderType,
  type FundingProgramDto,
  type FundingProgramVariantDto,
  type ScenarioFundingVariantDto,
} from "@repo/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

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
      ? `Interest/Term: ${variant.interestRatePct ?? "n/a"}${variant.termMonths ? ` / ${variant.termMonths}m` : ""}`
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
  checkboxName,
  selectName,
  options,
  selectedVariantId,
  defaultChecked,
  onSelectChange,
}: {
  label: string;
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
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <input type="checkbox" name={checkboxName} defaultChecked={defaultChecked} />
        {label}
      </Label>
      <select
        name={selectName}
        value={selectedVariantId}
        onChange={(event) => onSelectChange(event.target.value)}
        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">Select variant</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      {chips.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Badge key={chip} className="border-slate-200 bg-slate-50 text-slate-700">{chip}</Badge>
          ))}
        </div>
      ) : null}
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
    <Card>
      <CardHeader>
        <CardTitle>Funding</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-slate-600">
          Sprint 1 temporary flow: this replaces the entire funding stack in one action instead of editing individual line items.
        </p>

        <form action={action} className="space-y-6">
          <FundingLane
            label="State subsidy"
            checkboxName="stateSubsidyEnabled"
            selectName="stateSubsidyVariantId"
            options={stateOptions}
            selectedVariantId={stateVariantId}
            defaultChecked={Boolean(selectedState)}
            onSelectChange={setStateVariantId}
          />
          <FundingLane
            label="KfW"
            checkboxName="kfwEnabled"
            selectName="kfwVariantId"
            options={kfwOptions}
            selectedVariantId={kfwVariantId}
            defaultChecked={Boolean(selectedKfw)}
            onSelectChange={setKfwVariantId}
          />
          <FundingLane
            label="Free financing"
            checkboxName="freeFinancingEnabled"
            selectName="freeFinancingVariantId"
            options={freeOptions}
            selectedVariantId={freeVariantId}
            defaultChecked={Boolean(selectedFree)}
            onSelectChange={setFreeVariantId}
          />
          <Button type="submit" variant="outline">Replace Funding Stack</Button>
        </form>
      </CardContent>
    </Card>
  );
}
