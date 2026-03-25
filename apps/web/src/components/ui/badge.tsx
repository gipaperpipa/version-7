import type { HTMLAttributes, PropsWithChildren } from "react";

export function Badge({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${className}`} {...props}>
      {children}
    </span>
  );
}
