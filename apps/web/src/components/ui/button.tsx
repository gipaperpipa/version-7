import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: "default" | "outline";
  size?: "default" | "sm";
};

export function Button({ children, className = "", variant = "default", size = "default", ...props }: ButtonProps) {
  const variantClass = variant === "outline"
    ? "border border-slate-300 bg-white text-slate-900"
    : "bg-slate-900 text-white";
  const sizeClass = size === "sm" ? "h-9 px-3 text-sm" : "h-10 px-4 text-sm";

  return (
    <button
      className={`inline-flex items-center justify-center rounded-md ${sizeClass} ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
