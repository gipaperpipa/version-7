import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { getConfiguredApiBaseUrl, isLocalDevFallbackEnabled, localDevDemoWorkspace } from "@/lib/local-dev";

const workflowStages = ["Parcel", "Planning", "Scenario", "Readiness", "Run", "Result"];

const overviewItems = [
  {
    label: "What enters the system",
    value: "Parcel first",
    detail: "The real product model is source-selected parcels with derived geometry and area.",
  },
  {
    label: "What stays visible",
    value: "Trust on every step",
    detail: "Provenance, confidence, blockers, caveats, and next action stay attached to the workflow.",
  },
  {
    label: "What the alpha proves",
    value: "One thin decision loop",
    detail: "Parcel -> planning -> scenario -> readiness -> run -> result already works end to end.",
  },
  {
    label: "What remains fallback",
    value: "Manual parcel intake",
    detail: "Manual parcel creation stays available for demo testing and source gaps, not as the future model.",
  },
];

export default function HomePage() {
  const demoFallbackEnabled = isLocalDevFallbackEnabled();
  const apiBaseUrl = getConfiguredApiBaseUrl();
  const docsUrl = apiBaseUrl ? `${apiBaseUrl}/api/docs` : null;

  return (
    <main className="home-shell">
      <div className="home-frame">
        <section className="home-command-deck">
          <div className="home-command-bar">
            <div className="home-command-bar__brand">
              <div className="eyebrow">Feasibility OS</div>
              <div className="home-command-bar__note">Early development feasibility arranged like a serious internal operating surface.</div>
            </div>
            <div className="chip-row">
              <Badge variant="surface">Thin alpha live</Badge>
              <Badge variant="accent">Parcel-first product</Badge>
              <Badge variant={demoFallbackEnabled ? "success" : "warning"}>
                {demoFallbackEnabled ? "Demo entry open" : "Demo access gated"}
              </Badge>
            </div>
          </div>

          <div className="home-command-grid">
            <section className="home-command-hero">
              <div className="home-command-hero__body">
                <div className="eyebrow home-command-hero__eyebrow">Parcel -&gt; Planning -&gt; Scenario -&gt; Result</div>
                <h1 className="home-title">Parcel-to-feasibility, compressed into one working path.</h1>
                <p className="home-subtitle">
                  Open parcel context, confirm planning interpretation, shape a scenario, review readiness, run the
                  heuristic engine, and read a directional result without losing trust signals along the way.
                </p>
                <div className="action-row home-command-actions">
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

              <div className="home-route-strip" aria-label="Workflow overview">
                {workflowStages.map((label, index) => (
                  <div className="home-route-step" key={label}>
                    <span className="home-route-step__index">{index + 1}</span>
                    <span className="home-route-step__label">{label}</span>
                  </div>
                ))}
              </div>
            </section>

            <aside className="home-launch-panel">
              <div className="home-launch-panel__header">
                <div>
                  <div className="home-launch-panel__eyebrow">Workspace entry</div>
                  <h2 className="home-launch-panel__title">{localDevDemoWorkspace.name}</h2>
                </div>
                <Badge variant="accent">/{localDevDemoWorkspace.slug}</Badge>
              </div>

              <div className="action-row action-row--compact">
                <Badge variant="surface">Demo org</Badge>
                <Badge variant={demoFallbackEnabled ? "success" : "warning"}>
                  {demoFallbackEnabled ? "Public demo path enabled" : "Auth required unless demo mode is on"}
                </Badge>
              </div>

              <div className="home-launch-list">
                <div className="home-launch-row">
                  <div className="home-launch-row__label">Start</div>
                  <div>
                    <div className="home-launch-row__value">/{localDevDemoWorkspace.slug}/parcels</div>
                    <div className="home-launch-row__detail">Seeded parcel pipeline with trust, completeness, and next action already surfaced.</div>
                  </div>
                </div>
                <div className="home-launch-row">
                  <div className="home-launch-row__label">Studio</div>
                  <div>
                    <div className="home-launch-row__value">/{localDevDemoWorkspace.slug}/scenarios</div>
                    <div className="home-launch-row__detail">Scenario index, builder, readiness review, and result surfaces stay in one connected flow.</div>
                  </div>
                </div>
                <div className="home-launch-row">
                  <div className="home-launch-row__label">Trust</div>
                  <div>
                    <div className="home-launch-row__value">Provenance + readiness stay nearby</div>
                    <div className="home-launch-row__detail">The UI keeps directional confidence, blockers, warnings, and next move visible instead of hiding them in the result.</div>
                  </div>
                </div>
                <div className="home-launch-row">
                  <div className="home-launch-row__label">Parcel model</div>
                  <div>
                    <div className="home-launch-row__value">Source-derived in product, manual only in fallback</div>
                    <div className="home-launch-row__detail">Manual parcel intake keeps the alpha testable, but sourced parcel selection remains the intended intake model.</div>
                  </div>
                </div>
              </div>

              <div className="action-row home-launch-actions">
                <Link className={buttonClasses()} href={`/${localDevDemoWorkspace.slug}/parcels`}>
                  Open site pipeline
                </Link>
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${localDevDemoWorkspace.slug}/scenarios/new`}>
                  Create scenario
                </Link>
              </div>
            </aside>
          </div>

          <div className="home-overview-band">
            {overviewItems.map((item) => (
              <div className="home-overview-item" key={item.label}>
                <div className="home-overview-item__label">{item.label}</div>
                <div className="home-overview-item__value">{item.value}</div>
                <div className="home-overview-item__detail">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
