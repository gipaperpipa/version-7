"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getConfiguredApiBaseUrl, localDevDemoWorkspace } from "@/lib/local-dev";
import { cx } from "@/lib/ui/cx";
import { buttonClasses } from "./button";
import { WorkflowSteps } from "./workflow-steps";

function getActiveStep(pathname: string) {
  if (pathname.includes("/results/")) return 5;
  if (pathname.includes("/builder")) return 4;
  if (pathname.includes("/scenarios")) return 3;
  if (pathname.includes("/planning")) return 2;
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
      description: "Site intake, source trust, planning continuity, and scenario handoff.",
      href: `/${orgSlug}/parcels`,
    },
    {
      title: "Scenarios",
      description: "Strategy framing, funding selection, readiness, runs, and result review.",
      href: `/${orgSlug}/scenarios`,
    },
  ];

  const steps = [
    { label: "Parcel intake", description: "Ground the case in a site record and its trust signal.", href: `/${orgSlug}/parcels` },
    { label: "Planning inputs", description: "Interpret buildability and policy constraints for the parcel.", href: `/${orgSlug}/parcels` },
    { label: "Scenario setup", description: "Frame the strategy, revenue, and cost assumptions.", href: `/${orgSlug}/scenarios` },
    { label: "Readiness and run", description: "Resolve blockers, select funding, and launch the heuristic engine.", href: `/${orgSlug}/scenarios` },
    { label: "Decision result", description: "Review KPIs, caveats, and the next action.", href: `/${orgSlug}/scenarios` },
  ];

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div>
          <div className="workspace-badge">Sprint 1</div>
          <div className="workspace-brand__title">Feasibility OS</div>
          <div className="workspace-brand__description">
            A calm internal workspace for sourced parcel context, planning interpretation, scenario design, and
            heuristic feasibility review.
          </div>
        </div>

        <div className="workspace-sidebar__section">
          <div className="workspace-sidebar__label">Workspace</div>
          <div className="workspace-nav__title">/{orgSlug}</div>
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
          <WorkflowSteps title="Workflow" steps={steps} activeStep={activeStep} />
        </div>

        <div className="workspace-sidebar__section">
          <div className="workspace-sidebar__label">Product direction</div>
          <div className="workspace-sidebar__hint">
            Manual parcel creation is still usable here, but the long-term intake model remains source-selected parcels
            with derived geometry and area.
          </div>
        </div>

        <div className="workspace-sidebar__footer">
          <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href="/">
            Product entry
          </Link>
          {docsUrl ? (
            <a className={buttonClasses({ variant: "ghost", size: "sm" })} href={docsUrl}>
              API docs
            </a>
          ) : null}
        </div>
      </aside>

      <div className="workspace-main">
        <div className="workspace-topbar">
          <div>
            <div className="workspace-topbar__label">Current workspace</div>
            <div className="workspace-topbar__value">/{orgSlug}</div>
          </div>
          <div className="workspace-topbar__label">
            Working path: parcel -&gt; planning -&gt; scenario -&gt; readiness -&gt; result
          </div>
        </div>
        <main className="workspace-main-content">
          <div className="workspace-frame">{children}</div>
        </main>
      </div>
    </div>
  );
}
