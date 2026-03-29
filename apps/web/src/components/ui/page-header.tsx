import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__surface">
        <div className="page-header__body">
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-description">{description}</p> : null}
        </div>
        {actions ? <div className="header-actions page-header__actions">{actions}</div> : null}
        {meta ? <div className="page-meta page-header__meta">{meta}</div> : null}
      </div>
    </header>
  );
}
