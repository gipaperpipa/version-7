import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/ui/cx";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("ui-input", className)} {...props} />;
}
