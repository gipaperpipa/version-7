import type { ReactNode } from "react";
import type { BadgeVariant } from "./badge";
import { Badge } from "./badge";

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeVariant;
}) {
  return <Badge variant={tone}>{children}</Badge>;
}

export function getReadinessTone(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "READY":
      return "success";
    case "READY_WITH_WARNINGS":
      return "warning";
    case "BLOCKED":
      return "danger";
    default:
      return "neutral";
  }
}

export function getRunStatusTone(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "danger";
    case "RUNNING":
      return "info";
    case "QUEUED":
      return "accent";
    default:
      return "neutral";
  }
}

export function getScenarioStatusTone(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "READY":
    case "COMPLETED":
      return "success";
    case "RUNNING":
      return "accent";
    case "FAILED":
      return "danger";
    case "ARCHIVED":
      return "surface";
    case "DRAFT":
    default:
      return "neutral";
  }
}

export function getIssueTone(severity: string | null | undefined): BadgeVariant {
  switch (severity) {
    case "BLOCKING":
      return "danger";
    case "WARNING":
      return "warning";
    default:
      return "neutral";
  }
}

export function getConfidenceTone(band: string): BadgeVariant {
  switch (band) {
    case "High":
      return "success";
    case "Medium":
      return "warning";
    case "Low":
      return "danger";
    default:
      return "neutral";
  }
}
