import type { LabelHTMLAttributes } from "react";
import { cx } from "@/lib/ui/cx";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cx("ui-label", className)} {...props} />;
}
