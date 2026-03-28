import type { HTMLAttributes, PropsWithChildren } from "react";
import { cx } from "@/lib/ui/cx";

export function ActionRow({
  children,
  className,
  spread = false,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>> & {
  spread?: boolean;
}) {
  return (
    <div className={cx("action-row", spread && "action-row--spread", className)} {...props}>
      {children}
    </div>
  );
}
