import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { StatusBadge } from "./status-badge";
import { SectionCard } from "./section-card";

export function VerdictPanel({
  eyebrow = "Verdict",
  title,
  summary,
  tone,
  context,
  actions,
  size = "default",
  className,
}: {
  eyebrow?: string;
  title: string;
  summary: string;
  tone: "neutral" | "surface" | "accent" | "success" | "warning" | "danger" | "info";
  context?: ReactNode;
  actions?: ReactNode;
  size?: "default" | "compact";
  className?: string;
}) {
  return (
    <SectionCard
      className={cx(className)}
      eyebrow={eyebrow}
      title={title}
      description={summary}
      tone={tone === "success" || tone === "accent" ? "accent" : tone === "warning" || tone === "danger" ? "muted" : "default"}
      actions={<StatusBadge tone={tone}>{title}</StatusBadge>}
      size={size}
    >
      <div className="content-stack">
        {context ? <div className="verdict-panel__context">{context}</div> : null}
        {actions ? <div className="action-row">{actions}</div> : null}
      </div>
    </SectionCard>
  );
}
