import type { HTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { Card, CardContent, CardDescription, CardEyebrow, CardHeader, CardTitle } from "./card";

export function SectionCard({
  children,
  className,
  eyebrow,
  title,
  description,
  actions,
  tone = "default",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>> & {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  tone?: "default" | "muted" | "accent";
}) {
  return (
    <Card className={cx("section-card", className)} tone={tone} {...props}>
      <CardHeader>
        <div>
          {eyebrow ? <CardEyebrow>{eyebrow}</CardEyebrow> : null}
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
