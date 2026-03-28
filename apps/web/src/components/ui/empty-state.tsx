import type { ReactNode } from "react";
import { Card, CardContent } from "./card";

export function EmptyState({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Card tone="muted">
      <CardContent>
        <div className="empty-state">
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h2 className="empty-state__title">{title}</h2>
          <p className="empty-state__description">{description}</p>
          {actions ? <div className="action-row">{actions}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
