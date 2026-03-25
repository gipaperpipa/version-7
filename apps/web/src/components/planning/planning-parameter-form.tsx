"use client";

import { useMemo, useState } from "react";
import type { PlanningParameterDto } from "@repo/contracts";
import type { PlanningFieldDefinition } from "@/lib/ui/planning-field-definitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { Badge } from "@/components/ui/badge";

type FieldValue = string;

function buildInitialState(definitions: PlanningFieldDefinition[], items: PlanningParameterDto[]) {
  const state: Record<string, FieldValue> = {};

  for (const definition of definitions) {
    const existing = items.find((item) => item.keySlug === definition.keySlug);

    if (definition.storageKind === "valueBoolean") {
      state[definition.keySlug] = existing?.valueBoolean === true
        ? "true"
        : existing?.valueBoolean === false
          ? "false"
          : "unspecified";
      continue;
    }

    state[definition.keySlug] = existing?.valueNumber ?? "";
  }

  return state;
}

export function PlanningParameterForm({
  action,
  definitions,
  items,
}: {
  action: (formData: FormData) => void | Promise<void>;
  definitions: PlanningFieldDefinition[];
  items: PlanningParameterDto[];
}) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() => buildInitialState(definitions, items));
  const sections = useMemo(
    () => ["Buildability", "Capacity", "Policy"] as const,
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning Inputs</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-8">
          {sections.map((section) => {
            const sectionDefinitions = definitions.filter((definition) => definition.section === section);
            return (
              <section key={section} className="space-y-4">
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">{section}</div>
                <div className="space-y-4">
                  {sectionDefinitions.map((definition) => {
                    const existing = items.find((item) => item.keySlug === definition.keySlug);
                    const currentValue = values[definition.keySlug] ?? "";
                    const isCleared = definition.storageKind === "valueBoolean"
                      ? Boolean(existing) && existing.valueBoolean !== null && currentValue === "unspecified"
                      : Boolean(existing) && definition.storageKind === "valueNumber" && currentValue.trim() === "";

                    if (definition.storageKind === "readonlyValueNumber" && !existing) {
                      return null;
                    }

                    return (
                      <div key={definition.keySlug} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Label htmlFor={definition.keySlug}>{definition.label}</Label>
                              {definition.unit ? (
                                <Badge className="border-slate-200 bg-slate-50 text-slate-700">{definition.unit}</Badge>
                              ) : null}
                              {definition.affectsReadiness ? (
                                <Badge className="border-sky-200 bg-sky-50 text-sky-800">
                                  {definition.readinessUsageLabel}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="text-sm text-slate-600">{definition.helpText}</div>
                          </div>

                          <ProvenanceConfidence
                            sourceType={existing?.sourceType}
                            confidenceScore={existing?.confidenceScore}
                            sourceReference={existing?.sourceReference}
                            readOnlyLabel={definition.storageKind === "readonlyValueNumber" ? "Read-only" : null}
                          />
                        </div>

                        <div className="mt-4 space-y-2">
                          {definition.storageKind === "valueNumber" ? (
                            <Input
                              id={definition.keySlug}
                              name={definition.keySlug}
                              value={currentValue}
                              onChange={(event) => setValues((state) => ({ ...state, [definition.keySlug]: event.target.value }))}
                            />
                          ) : null}

                          {definition.storageKind === "valueBoolean" ? (
                            <select
                              id={definition.keySlug}
                              name={definition.keySlug}
                              value={currentValue}
                              onChange={(event) => setValues((state) => ({ ...state, [definition.keySlug]: event.target.value }))}
                              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                            >
                              <option value="unspecified">Unspecified</option>
                              <option value="true">Eligible</option>
                              <option value="false">Not eligible</option>
                            </select>
                          ) : null}

                          {definition.storageKind === "readonlyValueNumber" ? (
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                              <div className="font-medium">{existing?.valueNumber ?? "n/a"}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Derived/source-backed planning input. Read-only in Sprint 1 web flow.
                              </div>
                            </div>
                          ) : null}

                          {isCleared ? (
                            <div className="text-xs text-amber-700">Will clear saved value</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <Button type="submit">Save Planning Inputs</Button>
        </form>
      </CardContent>
    </Card>
  );
}
