import type { ReactNode } from "react";

export function DiagnosticGroup({
  title,
  emptyLabel,
  children,
}: {
  title: string;
  emptyLabel?: string;
  children?: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="content-stack">
      <div className="field-note-strong">{title}</div>
      {hasChildren ? children : <div className="field-help">{emptyLabel ?? "No diagnostic items were returned."}</div>}
    </div>
  );
}
