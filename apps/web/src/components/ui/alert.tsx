import type { HTMLAttributes, PropsWithChildren } from "react";

export function Alert({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function AlertTitle({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLHeadingElement>>) {
  return (
    <h3 className={`font-semibold ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function AlertDescription({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={`mt-1 text-sm ${className}`} {...props}>
      {children}
    </div>
  );
}
