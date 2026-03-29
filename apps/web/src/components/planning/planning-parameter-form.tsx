"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlanningParameterDto } from "@repo/contracts";
import { ActionRow } from "@/components/ui/action-row";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cx } from "@/lib/ui/cx";
import type { PlanningFieldDefinition } from "@/lib/ui/planning-field-definitions";

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

function getFieldState(definition: PlanningFieldDefinition, existing: PlanningParameterDto | undefined, currentValue: string) {
  if (definition.storageKind === "readonlyValueNumber") {
    return { label: "Derived", tone: "info" as const, isCleared: false };
  }

  if (definition.storageKind === "valueBoolean") {
    if (currentValue === "unspecified") {
      return existing
        ? { label: "Cleared", tone: "warning" as const, isCleared: true }
        : { label: "Empty", tone: "neutral" as const, isCleared: false };
    }

    return { label: "Filled", tone: "success" as const, isCleared: false };
  }

  if (currentValue.trim()) {
    return { label: "Filled", tone: "success" as const, isCleared: false };
  }

  if (existing) {
    return { label: "Cleared", tone: "warning" as const, isCleared: true };
  }

  return { label: "Empty", tone: "neutral" as const, isCleared: false };
}

const sectionDescriptions: Record<string, string> = {
  Buildability: "Core buildability inputs.",
  Capacity: "Unit and parking refinements.",
  Policy: "Program and policy overlays.",
};

export function PlanningParameterForm({
  action,
  definitions,
  items,
  continueHref,
}: {
  action: (formData: FormData) => void | Promise<void>;
  definitions: PlanningFieldDefinition[];
  items: PlanningParameterDto[];
  continueHref?: string;
}) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() => buildInitialState(definitions, items));
  const sections = useMemo(() => ["Buildability", "Capacity", "Policy"] as const, []);

  return (
    <form action={action} className="form-stack">
      {sections.map((section) => {
        const sectionDefinitions = definitions.filter((definition) => definition.section === section);

        return (
          <SectionCard
            className="planning-section"
            key={section}
            eyebrow={`Planning / ${section}`}
            title={section}
            description={sectionDescriptions[section]}
            size="compact"
          >
            <div className="field-grid planning-field-grid">
              {sectionDefinitions.map((definition) => {
                const existing = items.find((item) => item.keySlug === definition.keySlug);
                const currentValue = values[definition.keySlug] ?? "";
                const fieldState = getFieldState(definition, existing, currentValue);

                if (definition.storageKind === "readonlyValueNumber" && !existing) {
                  return null;
                }

                return (
                  <div
                    key={definition.keySlug}
                    className={cx(
                      "planning-field",
                      fieldState.isCleared && "planning-field--cleared",
                      definition.storageKind === "readonlyValueNumber" && "planning-field--derived",
                    )}
                  >
                    <div className="planning-field__header">
                      <div className="content-stack" style={{ gap: 8 }}>
                        <div className="action-row">
                          <Label htmlFor={definition.keySlug}>{definition.label}</Label>
                          {definition.unit ? <Badge variant="surface">{definition.unit}</Badge> : null}
                          <StatusBadge tone={fieldState.tone}>{fieldState.label}</StatusBadge>
                          {definition.affectsReadiness && definition.readinessUsageLabel ? (
                            <StatusBadge tone="info">{definition.readinessUsageLabel}</StatusBadge>
                          ) : null}
                        </div>
                        <div className="field-help">{definition.helpText}</div>
                      </div>

                      <ProvenanceConfidence
                        sourceType={existing?.sourceType}
                        confidenceScore={existing?.confidenceScore}
                        sourceReference={existing?.sourceReference}
                        readOnlyLabel={definition.storageKind === "readonlyValueNumber" ? "Read-only" : null}
                        variant="inline"
                      />
                    </div>

                    <div className="planning-field__body">
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
                          className="ui-select"
                        >
                          <option value="unspecified">Unspecified</option>
                          <option value="true">Eligible</option>
                          <option value="false">Not eligible</option>
                        </select>
                      ) : null}

                      {definition.storageKind === "readonlyValueNumber" ? (
                        <div className="readonly-block">
                          <div className="readonly-block__value">{existing?.valueNumber ?? "n/a"}</div>
                          <div className="field-help">Source-derived geometry. Read-only in Sprint 1.</div>
                        </div>
                      ) : null}

                      {fieldState.isCleared ? (
                        <div className="field-help field-note-strong">Will clear the saved value on save.</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })}

      <ActionRow spread className="form-actions-bar">
        <div className="field-help">Readiness-relevant fields are flagged inline.</div>
        <div className="action-row">
          {continueHref ? (
            <Link className={buttonClasses({ variant: "secondary" })} href={continueHref}>
              Continue to scenario
            </Link>
          ) : null}
          <Button type="submit" size="lg">Save planning inputs</Button>
        </div>
      </ActionRow>
    </form>
  );
}
