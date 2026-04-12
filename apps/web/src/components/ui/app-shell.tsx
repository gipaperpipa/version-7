"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getConfiguredApiBaseUrl, localDevDemoWorkspace } from "@/lib/local-dev";
import { cx } from "@/lib/ui/cx";
import { buttonClasses } from "./button";
import { WorkflowSteps } from "./workflow-steps";

function getActiveStep(pathname: string) {
  if (pathname.includes("/results/")) return 6;
  if (pathname.includes("/builder")) return 5;
  if (pathname.includes("/scenarios")) return 4;
  if (pathname.includes("/planning")) return 3;
  if (pathname.includes("/projects")) return 2;
  if (pathname.includes("/parcels")) return 1;
  return 1;
}

export function AppShell({ children, orgSlug }: { children: ReactNode; orgSlug: string }) {
  const pathname = usePathname();
  const activeStep = getActiveStep(pathname);
  const apiBaseUrl = getConfiguredApiBaseUrl();
  const docsUrl = apiBaseUrl ? `${apiBaseUrl}/api/docs` : null;
  const navItems = [
    {
      title: "Parcels",
      description: "Trust, planning, continuity.",
      href: `/${orgSlug}/parcels`,
    },
    {
      title: "Projects",
      description: "Business object above site anchors.",
      href: `/${orgSlug}/projects`,
    },
    {
      title: "Scenarios",
      description: "Strategy, funding, verdicts.",
      href: `/${orgSlug}/scenarios`,
    },
  ];

  const steps = [
    { label: "Parcel intake", description: "Ground the case in a site record.", href: `/${orgSlug}/parcels` },
    { label: "Project anchor", description: "Separate project from parcel identity.", href: `/${orgSlug}/projects` },
    { label: "Planning inputs", description: "Interpret buildability for the anchor site.", href: `/${orgSlug}/parcels` },
    { label: "Scenario setup", description: "Frame the case and assumptions.", href: `/${orgSlug}/scenarios` },
    { label: "Readiness and run", description: "Resolve blockers and launch.", href: `/${orgSlug}/scenarios` },
    { label: "Decision result", description: "Review verdict, KPIs, and next move.", href: `/${orgSlug}/scenarios` },
  ];
  const activeStage = steps[Math.max(activeStep - 1, 0)]?.label ?? "Parcel intake";

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar__head">
          <div className="workspace-badge">Parcel-led alpha</div>
          <div className="workspace-brand__title">Feasibility OS</div>
          <div className="workspace-brand__description">Premium internal workspace for parcel-led planning, scenarios, and heuristic review.</div>
        </div>

        <div className="workspace-sidebar__section">
          <div className="workspace-sidebar__label">Workspace</div>
          <div className="workspace-sidebar__workspace">/{orgSlug}</div>
          <div className="workspace-sidebar__hint">
            {orgSlug === localDevDemoWorkspace.slug
              ? `${localDevDemoWorkspace.name} demo workspace`
              : "Organization workspace"}
          </div>
        </div>

        <div className="workspace-sidebar__section">
          <div className="workspace-sidebar__label">Navigate</div>
          <nav className="workspace-nav">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.title}
                  className={cx("workspace-nav__link", isActive && "workspace-nav__link--active")}
                  href={item.href}
                >
                  <div className="workspace-nav__title">{item.title}</div>
                  <div className="workspace-nav__description">{item.description}</div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="workspace-sidebar__section">
          <div className="workspace-sidebar__label">Workflow</div>
          <div className="workspace-sidebar__focus">
            <span className="workspace-sidebar__focus-label">Current stage</span>
            <span className="workspace-sidebar__focus-value">{activeStage}</span>
          </div>
          <WorkflowSteps steps={steps} activeStep={activeStep} />
        </div>

        <div className="workspace-sidebar__section workspace-sidebar__section--product">
          <div className="workspace-sidebar__label">Product mode</div>
          <div className="workspace-sidebar__hint">Source-selected parcels stay primary. Manual parcel entry stays fallback.</div>
          <div className="action-row">
            <span className="meta-chip">Source-first</span>
            <span className="meta-chip">Derived geometry</span>
            <span className="meta-chip">Fallback edit</span>
          </div>
        </div>

        <div className="workspace-sidebar__footer">
          <div className="workspace-sidebar__footer-note">Heuristic outputs stay directional. Trust signals stay attached to every step.</div>
        </div>
      </aside>

      <div className="workspace-main">
        <div className="workspace-topbar">
          <div className="workspace-topbar__context">
            <div className="workspace-topbar__label">Workspace</div>
            <div className="workspace-topbar__value">/{orgSlug}</div>
            <div className="workspace-topbar__summary">Parcel-first feasibility workflow with planning, scenario, readiness, and result continuity.</div>
          </div>
          <div className="workspace-topbar__rail">
            <div className="workspace-topbar__trail">
              {steps.map((step, index) => {
                const stepNumber = index + 1;
                const stateClass =
                  stepNumber < activeStep
                    ? "workspace-topbar__stage workspace-topbar__stage--complete"
                    : stepNumber === activeStep
                      ? "workspace-topbar__stage workspace-topbar__stage--current"
                      : "workspace-topbar__stage";

                return (
                  <span key={step.label} className={stateClass}>
                    <span className="workspace-topbar__stage-index">{stepNumber}</span>
                    <span>{step.label.replace(" inputs", "").replace(" and run", "")}</span>
                  </span>
                );
              })}
            </div>
            <div className="workspace-topbar__focus">
              <span className="workspace-topbar__focus-label">Current stage</span>
              <span className="workspace-topbar__focus-value">{activeStage}</span>
            </div>
          </div>

          <div className="workspace-topbar__actions">
            <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href="/">
              Entry
            </Link>
            {docsUrl ? (
              <a className={buttonClasses({ variant: "ghost", size: "sm" })} href={docsUrl}>
                API docs
              </a>
            ) : null}
          </div>
        </div>
        <main className="workspace-main-content">
          <div className="workspace-frame">{children}</div>
        </main>
      </div>
    </div>
  );
}
