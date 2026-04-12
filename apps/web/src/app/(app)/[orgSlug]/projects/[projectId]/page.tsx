import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getProject } from "@/lib/api/projects";
import { getScenarios } from "@/lib/api/scenarios";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;

  try {
    const [project, scenarios] = await Promise.all([
      getProject(orgSlug, projectId),
      getScenarios(orgSlug),
    ]);
    const projectScenarios = scenarios.items
      .filter((scenario) => scenario.projectId === project.id)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Workspace / Projects"
          title={project.name}
          description="Project metadata lives here, separate from the underlying parcel/site anchor."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{project.anchorParcel.isGroupSite ? "Grouped-site anchor" : "Parcel anchor"}</span>
              <span className="meta-chip">{project.scenarioCount} scenario{project.scenarioCount === 1 ? "" : "s"}</span>
              <span className="meta-chip">{project.anchorParcel.landAreaSqm ?? "n/a"} sqm</span>
            </div>
          )}
          actions={(
            <>
              <Link className={buttonClasses()} href={`/${orgSlug}/scenarios/new?projectId=${project.id}`}>
                New scenario
              </Link>
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/${project.anchorParcelId}`}>
                Open anchor
              </Link>
            </>
          )}
        />

        <SectionCard
          eyebrow="Project identity"
          title="Separate project, grounded site anchor"
          description="The project is the working business object. The parcel or grouped site remains the underlying land anchor for source truth, planning continuity, and scenario runs."
        >
          <div className="ops-summary-grid ops-summary-grid--planning">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Project status</div>
              <div className="ops-summary-item__value">{project.status === "ON_HOLD" ? "On hold" : project.status === "ARCHIVED" ? "Archived" : "Active"}</div>
              <div className="ops-summary-item__detail">{project.description ?? "Add richer project metadata in a later pass."}</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Anchor type</div>
              <div className="ops-summary-item__value">{project.anchorParcel.isGroupSite ? "Grouped site" : "Parcel"}</div>
              <div className="ops-summary-item__detail">{project.anchorParcel.name ?? project.anchorParcel.cadastralId ?? "Unnamed anchor"}</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Scenario set</div>
              <div className="ops-summary-item__value">{project.activeScenarioCount} active</div>
              <div className="ops-summary-item__detail">{project.scenarioCount} total scenario{project.scenarioCount === 1 ? "" : "s"} linked to this project.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Latest run</div>
              <div className="ops-summary-item__value">{project.latestScenarioRunAt ? new Date(project.latestScenarioRunAt).toLocaleDateString("en-US") : "None yet"}</div>
              <div className="ops-summary-item__detail">Project-level review becomes easier because scenarios can now cluster under one higher-level object.</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Anchor context"
          title="Underlying parcel/site"
          description="The anchor still carries land identity, geometry, source trust, and grouped-site membership underneath the project."
        >
          <div className="helper-list">
            <div>Anchor: {project.anchorParcel.name ?? project.anchorParcel.cadastralId ?? "Unnamed site"}</div>
            <div>Location: {project.anchorParcel.municipalityName ?? project.anchorParcel.city ?? "Location not set"}</div>
            <div>Area: {project.anchorParcel.landAreaSqm ?? "n/a"} sqm</div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Scenario set"
          title="Project-linked scenarios"
          description="Scenarios now belong to the project while still using the anchored parcel/site for feasibility calculations."
        >
          {projectScenarios.length ? (
            <div className="ops-table">
              <div className="ops-table__header ops-table__header--parcels">
                <div>Scenario</div>
                <div>Lifecycle</div>
                <div>Family</div>
                <div>Open</div>
              </div>
              {projectScenarios.map((scenario) => (
                <div key={scenario.id} className="ops-table__row ops-table__row--parcels">
                  <div className="ops-table__cell">
                    <div className="list-row__body">
                      <div className="list-row__title">
                        <span className="list-row__title-text">{scenario.name}</span>
                        {scenario.isCurrentBest ? <StatusBadge tone="accent">Current lead</StatusBadge> : null}
                      </div>
                      <div className="list-row__meta list-row__meta--clamped">
                        {scenario.project?.name ?? project.name} / {scenario.familyKey}
                      </div>
                    </div>
                  </div>
                  <div className="ops-table__cell">
                    <StatusBadge tone={scenario.governanceStatus === "ACTIVE_CANDIDATE" ? "accent" : scenario.governanceStatus === "DRAFT" ? "surface" : "warning"}>
                      {scenario.governanceStatus === "ACTIVE_CANDIDATE" ? "Active candidate" : scenario.governanceStatus === "DRAFT" ? "Draft" : "Archived"}
                    </StatusBadge>
                  </div>
                  <div className="ops-table__cell">
                    <div className="ops-cell-stack">
                      <div className="ops-scan__label">Family</div>
                      <div className="ops-scan__value">v{scenario.familyVersion}</div>
                      <div className="ops-scan__detail">{scenario.strategyType.replaceAll("_", " ")}</div>
                    </div>
                  </div>
                  <div className="ops-table__actions ops-table__actions--dense">
                    <div className="action-row action-row--compact">
                      <Link className={buttonClasses({ size: "sm" })} href={`/${orgSlug}/scenarios/${scenario.id}/builder`}>
                        Builder
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert tone="info">
              <AlertTitle>No scenarios yet</AlertTitle>
              <AlertDescription>Create the first scenario from this project to begin repeated analysis against its anchored parcel/site.</AlertDescription>
            </Alert>
          )}
        </SectionCard>
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Project unavailable"
          description="The project detail page could not reach the API. Restore the API first, then reload this page."
        />
      );
    }

    throw error;
  }
}
