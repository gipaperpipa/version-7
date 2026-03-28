import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

export function StatBlock({
  label,
  value,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  return (
    <div className={cx("stat-block", tone !== "neutral" && `stat-block--${tone}`)}>
      <div className="stat-block__label">{label}</div>
      <div className="stat-block__value">{value}</div>
      {caption ? <div className="stat-block__caption">{caption}</div> : null}
    </div>
  );
}
