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
  inline = false,
}: {
  title: string;
  label: string;
  detail: string;
  tone: "neutral" | "surface" | "accent" | "success" | "warning" | "danger" | "info";
  compact?: boolean;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="ops-scan__item">
        <div className="ops-scan__label">{title}</div>
        <div className="ops-scan__value">
          <StatusBadge tone={tone}>{label}</StatusBadge>
        </div>
        <div className="ops-scan__detail">{detail}</div>
      </div>
    );
  }

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
  variant?: "default" | "compact" | "inline";
}) {
  const compact = variant === "compact";
  const inline = variant === "inline";

  if (inline) {
    return (
      <div className="ops-scan ops-scan--parcel">
        <SummaryRow
          title="Source"
          label={summary.sourceStatus.label}
          detail={summary.sourceStatus.detail}
          tone={summary.sourceStatus.tone}
          inline
        />
        <SummaryRow
          title="Planning"
          label={summary.planningCompleteness.label}
          detail={summary.planningCompleteness.detail}
          tone={summary.planningCompleteness.tone}
          inline
        />
        <SummaryRow
          title="Scenario"
          label={summary.scenarioContinuity.label}
          detail={summary.scenarioContinuity.detail}
          tone={summary.scenarioContinuity.tone}
          inline
        />
        <SummaryRow
          title="Next"
          label={summary.nextBestAction.label}
          detail={summary.nextBestAction.detail}
          tone={summary.nextBestAction.tone}
          inline
        />
      </div>
    );
  }

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
