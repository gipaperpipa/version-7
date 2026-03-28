import type { TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/ui/cx";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("ui-textarea", className)} {...props} />;
}
