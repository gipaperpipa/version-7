import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cx } from "@/lib/ui/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "default" | "lg";

export function buttonClasses({
  variant = "primary",
  size = "default",
  fullWidth = false,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
} = {}) {
  const normalizedVariant = variant === "outline" ? "secondary" : variant;

  return cx(
    "button",
    `button--${normalizedVariant}`,
    `button--${size}`,
    fullWidth && "button--full",
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  size = "default",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={cx(buttonClasses({ variant, size }), className)} {...props}>
      {children}
    </button>
  );
}
