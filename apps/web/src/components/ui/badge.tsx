import type { HTMLAttributes, PropsWithChildren } from "react";
import { cx } from "@/lib/ui/cx";

export type BadgeVariant = "neutral" | "surface" | "accent" | "success" | "warning" | "danger" | "info";

export function Badge({
  children,
  className,
  variant = "neutral",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLSpanElement>> & {
  variant?: BadgeVariant;
}) {
  return (
    <span className={cx("badge", `badge--${variant}`, className)} {...props}>
      {children}
    </span>
  );
}
