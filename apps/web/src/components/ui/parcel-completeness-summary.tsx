import Link from "next/link";
import type { ParcelCompletenessSummary as ParcelCompletenessSummaryValue } from "@/lib/ui/parcel-completeness";
import { cx } from "@/lib/ui/cx";
import { buttonClasses } from "./button";
import { SectionCard } from "./section-card";
import { StatusBadge } from "./status-badge";

function SummaryRow({
  title,
  label,
  detail,
  tone,
  compact = false,
}: {
  title: string;
  label: string;
  detail: string;
  tone: "neutral" | "surface" | "accent" | "success" | "warning" | "danger" | "info";
  compact?: boolean;
}) {
  return (
    <div className={cx("summary-row", compact && "summary-row--compact")}>
      <div className="content-stack" style={{ gap: 6 }}>
        <div className="field-note-strong">{title}</div>
        {!compact ? <div className="field-help">{detail}</div> : null}
      </div>
      <StatusBadge tone={tone}>{label}</StatusBadge>
    </div>
  );
}

export function ParcelCompletenessSummary({
  summary,
  title = "Parcel completeness",
  description = "Trust, continuity, and next action for this site.",
  primaryActionHref,
  primaryActionLabel,
  secondaryActionHref,
  secondaryActionLabel,
  variant = "default",
}: {
  summary: ParcelCompletenessSummaryValue;
  title?: string;
  description?: string;
  primaryActionHref?: string;
  primaryActionLabel?: string;
  secondaryActionHref?: string;
  secondaryActionLabel?: string;
  variant?: "default" | "compact";
}) {
  const compact = variant === "compact";

  return (
    <SectionCard
      eyebrow={compact ? "Signals" : "Continuity"}
      title={compact ? "Parcel scan" : title}
      description={compact ? undefined : description}
      tone="muted"
      size={compact ? "compact" : "default"}
    >
      <div className="content-stack">
        <SummaryRow
          title={compact ? "Source" : "Source status"}
          label={summary.sourceStatus.label}
          detail={summary.sourceStatus.detail}
          tone={summary.sourceStatus.tone}
          compact={compact}
        />
        <SummaryRow
          title={compact ? "Planning" : "Planning completeness"}
          label={summary.planningCompleteness.label}
          detail={summary.planningCompleteness.detail}
          tone={summary.planningCompleteness.tone}
          compact={compact}
        />
        <SummaryRow
          title={compact ? "Scenario" : "Scenario continuity"}
          label={summary.scenarioContinuity.label}
          detail={summary.scenarioContinuity.detail}
          tone={summary.scenarioContinuity.tone}
          compact={compact}
        />
        <SummaryRow
          title={compact ? "Next" : "Next best action"}
          label={summary.nextBestAction.label}
          detail={summary.nextBestAction.detail}
          tone={summary.nextBestAction.tone}
          compact={compact}
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
