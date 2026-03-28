import type { HTMLAttributes, PropsWithChildren } from "react";
import { cx } from "@/lib/ui/cx";

export function Alert({
  children,
  className,
  tone = "neutral",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>> & {
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  return (
    <div className={cx("alert", `alert--${tone}`, className)} {...props}>
      {children}
    </div>
  );
}

export function AlertTitle({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLHeadingElement>>) {
  return (
    <h3 className={cx("alert__title", className)} {...props}>
      {children}
    </h3>
  );
}

export function AlertDescription({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cx("alert__description", className)} {...props}>
      {children}
    </div>
  );
}
