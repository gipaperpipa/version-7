import Link from "next/link";
import type { ParcelCompletenessSummary as ParcelCompletenessSummaryValue } from "@/lib/ui/parcel-completeness";
import { buttonClasses } from "./button";
import { SectionCard } from "./section-card";
import { StatusBadge } from "./status-badge";

function SummaryRow({
  title,
  label,
  detail,
  tone,
}: {
  title: string;
  label: string;
  detail: string;
  tone: "neutral" | "surface" | "accent" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="summary-row">
      <div className="content-stack" style={{ gap: 6 }}>
        <div className="field-note-strong">{title}</div>
        <div className="field-help">{detail}</div>
      </div>
      <StatusBadge tone={tone}>{label}</StatusBadge>
    </div>
  );
}

export function ParcelCompletenessSummary({
  summary,
  title = "Parcel completeness",
  description = "Use this to understand trust, downstream continuity, and the best next move for this site.",
  primaryActionHref,
  primaryActionLabel,
  secondaryActionHref,
  secondaryActionLabel,
}: {
  summary: ParcelCompletenessSummaryValue;
  title?: string;
  description?: string;
  primaryActionHref?: string;
  primaryActionLabel?: string;
  secondaryActionHref?: string;
  secondaryActionLabel?: string;
}) {
  return (
    <SectionCard
      eyebrow="Continuity"
      title={title}
      description={description}
      tone="muted"
    >
      <div className="content-stack">
        <SummaryRow
          title="Source status"
          label={summary.sourceStatus.label}
          detail={summary.sourceStatus.detail}
          tone={summary.sourceStatus.tone}
        />
        <SummaryRow
          title="Planning completeness"
          label={summary.planningCompleteness.label}
          detail={summary.planningCompleteness.detail}
          tone={summary.planningCompleteness.tone}
        />
        <SummaryRow
          title="Scenario continuity"
          label={summary.scenarioContinuity.label}
          detail={summary.scenarioContinuity.detail}
          tone={summary.scenarioContinuity.tone}
        />
        <SummaryRow
          title="Next best action"
          label={summary.nextBestAction.label}
          detail={summary.nextBestAction.detail}
          tone={summary.nextBestAction.tone}
        />

        {primaryActionHref || secondaryActionHref ? (
          <div className="action-row">
            {primaryActionHref && primaryActionLabel ? (
              <Link className={buttonClasses()} href={primaryActionHref}>
                {primaryActionLabel}
              </Link>
            ) : null}
            {secondaryActionHref && secondaryActionLabel ? (
              <Link className={buttonClasses({ variant: "secondary" })} href={secondaryActionHref}>
                {secondaryActionLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
