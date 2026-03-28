import type { ReactNode } from "react";
import { StatusBadge } from "./status-badge";
import { SectionCard } from "./section-card";

export function VerdictPanel({
  eyebrow = "Verdict",
  title,
  summary,
  tone,
  context,
  actions,
}: {
  eyebrow?: string;
  title: string;
  summary: string;
  tone: "neutral" | "surface" | "accent" | "success" | "warning" | "danger" | "info";
  context?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <SectionCard
      eyebrow={eyebrow}
      title={title}
      description={summary}
      tone={tone === "success" || tone === "accent" ? "accent" : tone === "warning" || tone === "danger" ? "muted" : "default"}
      actions={<StatusBadge tone={tone}>{title}</StatusBadge>}
    >
      <div className="content-stack">
        {context ? <div className="verdict-panel__context">{context}</div> : null}
        {actions ? <div className="action-row">{actions}</div> : null}
      </div>
    </SectionCard>
  );
}
