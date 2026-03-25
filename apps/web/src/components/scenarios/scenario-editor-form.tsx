"use client";

import { useState } from "react";
import { AcquisitionType, OptimizationTarget, StrategyType, type ParcelDto, type ScenarioDto } from "@repo/contracts";
import {
  acquisitionTypeLabels,
  optimizationTargetLabels,
  strategyFieldHints,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-8">
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
            <div className="font-medium">{hint.title}</div>
            <div className="mt-1 text-sm text-slate-600">{hint.description}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {hint.requiredFields.map((field) => (
                <span key={field} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">
                  {field}
                </span>
              ))}
            </div>
          </div>

          <section className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Scenario</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={initialScenario?.name ?? ""} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" defaultValue={initialScenario?.description ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parcelId">Parcel</Label>
                <select
                  id="parcelId"
                  name="parcelId"
                  defaultValue={initialScenario?.parcelId ?? initialParcelId ?? ""}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select parcel</option>
                  {parcels.map((parcel) => (
                    <option key={parcel.id} value={parcel.id}>
                      {parcel.name ?? parcel.cadastralId ?? parcel.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="strategyType">Strategy</Label>
                <select
                  id="strategyType"
                  name="strategyType"
                  defaultValue={initialStrategy}
                  onChange={(event) => setStrategyType(event.target.value as StrategyType)}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {Object.values(StrategyType).map((value) => (
                    <option key={value} value={value}>{strategyTypeLabels[value]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="acquisitionType">Acquisition</Label>
                <select
                  id="acquisitionType"
                  name="acquisitionType"
                  defaultValue={initialScenario?.acquisitionType ?? AcquisitionType.BUY}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {Object.values(AcquisitionType).map((value) => (
                    <option key={value} value={value}>{acquisitionTypeLabels[value]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="optimizationTarget">Optimization target</Label>
                <select
                  id="optimizationTarget"
                  name="optimizationTarget"
                  defaultValue={initialScenario?.optimizationTarget ?? OptimizationTarget.MIN_REQUIRED_EQUITY}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {Object.values(OptimizationTarget).map((value) => (
                    <option key={value} value={value}>{optimizationTargetLabels[value]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="strategyMixJson">Temporary mix configuration JSON</Label>
                <Textarea
                  id="strategyMixJson"
                  name="strategyMixJson"
                  defaultValue={initialScenario?.strategyMixJson ? JSON.stringify(initialScenario.strategyMixJson, null, 2) : ""}
                  placeholder='Only needed for "Mixed Strategy (Temporary)" in Sprint 1'
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Revenue</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetMarketRentEurSqm">Market rent EUR/sqm</Label>
                <Input id="targetMarketRentEurSqm" name="targetMarketRentEurSqm" defaultValue={initialScenario?.targetMarketRentEurSqm ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetSubsidizedRentEurSqm">Subsidized rent EUR/sqm</Label>
                <Input id="targetSubsidizedRentEurSqm" name="targetSubsidizedRentEurSqm" defaultValue={initialScenario?.targetSubsidizedRentEurSqm ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subsidizedSharePct">Subsidized share pct</Label>
                <Input id="subsidizedSharePct" name="subsidizedSharePct" defaultValue={initialScenario?.subsidizedSharePct ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetSalesPriceEurSqm">Sales price EUR/sqm</Label>
                <Input id="targetSalesPriceEurSqm" name="targetSalesPriceEurSqm" defaultValue={initialScenario?.targetSalesPriceEurSqm ?? ""} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Finance</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="avgUnitSizeSqm">Average unit size sqm</Label>
                <Input id="avgUnitSizeSqm" name="avgUnitSizeSqm" defaultValue={initialScenario?.avgUnitSizeSqm ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hardCostPerBgfSqm">Hard cost per BGF sqm</Label>
                <Input id="hardCostPerBgfSqm" name="hardCostPerBgfSqm" defaultValue={initialScenario?.hardCostPerBgfSqm ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="landCost">Land cost</Label>
                <Input id="landCost" name="landCost" defaultValue={initialScenario?.landCost ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="softCostPct">Soft cost pct</Label>
                <Input id="softCostPct" name="softCostPct" defaultValue={initialScenario?.softCostPct ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parkingCostPerSpace">Parking cost per space</Label>
                <Input id="parkingCostPerSpace" name="parkingCostPerSpace" defaultValue={initialScenario?.parkingCostPerSpace ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equityTargetPct">Equity target pct</Label>
                <Input id="equityTargetPct" name="equityTargetPct" defaultValue={initialScenario?.equityTargetPct ?? ""} />
              </div>
            </div>
          </section>

          <Button type="submit">{submitLabel}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
