import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { WorkflowSteps } from "@/components/ui/workflow-steps";
import { getConfiguredApiBaseUrl, isLocalDevFallbackEnabled, localDevDemoWorkspace } from "@/lib/local-dev";

const workflowSteps = [
  { label: "Parcel intake", description: "Create or open a site record and capture the fallback parcel context needed to begin." },
  { label: "Planning inputs", description: "Record the narrow planning inputs that shape readiness and heuristic buildability." },
  { label: "Scenario setup", description: "Configure strategy, commercial assumptions, costs, and funding selection." },
  { label: "Readiness and run", description: "Resolve blockers, review caveats, and launch the heuristic feasibility run." },
  { label: "Decision result", description: "Review KPIs, drivers, caveats, and the strongest next action." },
];

export default function HomePage() {
  const demoFallbackEnabled = isLocalDevFallbackEnabled();
  const apiBaseUrl = getConfiguredApiBaseUrl();
  const docsUrl = apiBaseUrl ? `${apiBaseUrl}/api/docs` : null;

  return (
    <main className="home-shell">
      <div className="home-frame">
        <section className="home-hero">
          <div className="hero-panel">
            <div className="eyebrow">Feasibility OS</div>
            <h1 className="home-title">Early development feasibility, framed like a serious internal product.</h1>
            <p className="home-subtitle">
              Feasibility OS turns parcel context, planning interpretation, scenario setup, readiness review,
              heuristic execution, and result analysis into one calm working path. Sprint 1 is intentionally narrow,
              but it should already feel like trustworthy software for real project decisions.
            </p>
            <div className="action-row" style={{ marginTop: 26 }}>
              <Link className={buttonClasses({ size: "lg" })} href={`/${localDevDemoWorkspace.slug}/parcels`}>
                Enter demo workspace
              </Link>
              <Link className={buttonClasses({ variant: "secondary", size: "lg" })} href={`/${localDevDemoWorkspace.slug}/scenarios`}>
                Open scenario studio
              </Link>
              {docsUrl ? (
                <a className={buttonClasses({ variant: "ghost", size: "lg" })} href={docsUrl}>
                  API docs
                </a>
              ) : null}
            </div>
          </div>

          <SectionCard
            eyebrow="Workspace entry"
            title={localDevDemoWorkspace.name}
            description={`The demo entry uses /${localDevDemoWorkspace.slug}. Public access without auth cookies is enabled only when demo fallback is intentionally turned on.`}
            tone="accent"
          >
            <div className="content-stack">
              <div className="action-row">
                <Badge variant="accent">Demo org</Badge>
                <Badge variant="surface">Slug /{localDevDemoWorkspace.slug}</Badge>
                <Badge variant={demoFallbackEnabled ? "success" : "warning"}>
                  {demoFallbackEnabled ? "Demo access enabled" : "Auth required unless demo mode is enabled"}
                </Badge>
              </div>
              <p className="muted-copy">
                Use this workspace to test the full thin product loop as one coherent path:
                parcel -&gt; planning -&gt; scenario -&gt; readiness -&gt; run -&gt; result.
              </p>
              <p className="muted-copy">
                The intended product model is source-selected parcels with derived geometry and area. Manual parcel
                intake remains here as a fallback for demo testing and source gaps.
              </p>
              <div className="action-row">
                <Link className={buttonClasses()} href={`/${localDevDemoWorkspace.slug}/parcels`}>
                  Open site pipeline
                </Link>
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${localDevDemoWorkspace.slug}/scenarios/new`}>
                  Create scenario
                </Link>
              </div>
            </div>
          </SectionCard>
        </section>

        <div className="stat-grid">
          <StatBlock label="Entry route" value="/" caption="Primary public landing route" tone="accent" />
          <StatBlock label="Demo workspace" value={`/${localDevDemoWorkspace.slug}`} caption="Seeded demo organization" />
          <StatBlock label="API docs" value={docsUrl ?? "Not configured"} caption="Backend reference surface" />
          <StatBlock label="Workflow scope" value="Parcel -> Result" caption="Current thin decision path" tone="success" />
        </div>

        <div className="content-grid">
          <SectionCard
            eyebrow="Sprint 1 path"
            title="One continuous workflow"
            description="These are the only surfaces intentionally wired today, and they should feel like one connected product."
          >
            <WorkflowSteps steps={workflowSteps} activeStep={1} />
          </SectionCard>

          <SectionCard
            eyebrow="Product direction"
            title="Parcel intake is source-first"
            description="The current UI keeps a manual fallback path, but the long-term product expects sourced parcel selection."
          >
            <div className="content-stack">
              <div className="key-value-grid">
                <div className="key-value-card">
                  <div className="key-value-card__label">Current alpha</div>
                  <div className="key-value-card__value">Manual parcel creation keeps the thin feasibility loop testable end to end.</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Intended parcel model</div>
                  <div className="key-value-card__value">Real product intake should come from sourced parcel IDs, geometry, and derived site area.</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">How to use the demo</div>
                  <div className="key-value-card__value">Treat the demo workspace like a working internal alpha, not a raw route sandbox.</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Diagnostics nearby</div>
                  <div className="key-value-card__value">Use `/api/health` and `/api/docs` while testing the parcel-to-result flow.</div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
