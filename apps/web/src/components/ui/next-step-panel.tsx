import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { SectionCard } from "./section-card";

export function NextStepPanel({
  eyebrow = "Next step",
  title,
  description,
  actions,
  tone = "muted",
  size = "default",
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  tone?: "default" | "muted" | "accent";
  size?: "default" | "compact";
  className?: string;
}) {
  return (
    <SectionCard eyebrow={eyebrow} title={title} description={description} tone={tone} size={size} className={cx(className)}>
      <div className="content-stack">
        {actions ? <div className="action-row">{actions}</div> : null}
      </div>
    </SectionCard>
  );
}
