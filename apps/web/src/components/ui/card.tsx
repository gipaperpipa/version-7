import type { HTMLAttributes, PropsWithChildren } from "react";
import { cx } from "@/lib/ui/cx";

export function Card({
  children,
  className,
  tone = "default",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>> & {
  tone?: "default" | "muted" | "accent";
}) {
  return (
    <div className={cx("card", tone !== "default" && `card--${tone}`, className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cx("card__header", className)} {...props}>
      {children}
    </div>
  );
}

export function CardEyebrow({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>) {
  return (
    <p className={cx("card__eyebrow", className)} {...props}>
      {children}
    </p>
  );
}

export function CardTitle({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLHeadingElement>>) {
  return (
    <h2 className={cx("card__title", className)} {...props}>
      {children}
    </h2>
  );
}

export function CardDescription({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>) {
  return (
    <p className={cx("card__description", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cx("card__content", className)} {...props}>
      {children}
    </div>
  );
}
