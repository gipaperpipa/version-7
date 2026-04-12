import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getProjects } from "@/lib/api/projects";

function getAnchorLabel(project: Awaited<ReturnType<typeof getProjects>>["items"][number]) {
  return project.anchorParcel.name ?? project.anchorParcel.cadastralId ?? "Unnamed site";
}

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ error?: string; message?: string }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const projects = await getProjects(orgSlug);
    const activeCount = projects.items.filter((project) => project.status === "ACTIVE").length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Workspace / Projects"
          title="Development projects"
          description="Projects are the higher-level working object above parcel/site anchors. Each project keeps its own identity while scenarios still run against the anchored parcel/site underneath."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{projects.total} project{projects.total === 1 ? "" : "s"}</span>
              <span className="meta-chip">{activeCount} active</span>
            </div>
          )}
          actions={(
            <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels`}>
              Open parcel board
            </Link>
          )}
        />

        {resolvedSearchParams?.error === "project-create-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Project creation failed</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The API could not create or reuse a project for that parcel/site anchor."}</AlertDescription>
          </Alert>
        ) : null}

        {!projects.items.length ? (
          <EmptyState
            eyebrow="No projects yet"
            title="Create a project from a parcel or grouped site"
            description="Parcels remain the base entity. Projects become the higher business object once you decide that parcel or grouped site is worth carrying into repeated scenario work."
            actions={(
              <Link className={buttonClasses()} href={`/${orgSlug}/parcels`}>
                Open parcel board
              </Link>
            )}
          />
        ) : (
          <SectionCard
            eyebrow="Project workspace"
            title="One project per site anchor"
            description="Projects stay separate from parcels, but each one remains grounded in a real parcel or grouped-site anchor so planning and scenario continuity do not drift."
          >
            <div className="ops-table">
              <div className="ops-table__header ops-table__header--parcels">
                <div>Project</div>
                <div>Anchor</div>
                <div>Scenarios</div>
                <div>Open</div>
              </div>
              {projects.items.map((project) => (
                <div key={project.id} className="ops-table__row ops-table__row--parcels">
                  <div className="ops-table__cell">
                    <div className="list-row__body">
                      <div className="list-row__title">
                        <span className="list-row__title-text">{project.name}</span>
                        <StatusBadge tone={project.status === "ACTIVE" ? "accent" : project.status === "ON_HOLD" ? "warning" : "surface"}>
                          {project.status === "ACTIVE" ? "Active" : project.status === "ON_HOLD" ? "On hold" : "Archived"}
                        </StatusBadge>
                      </div>
                      <div className="inline-meta">
                        <span className="meta-chip">{project.anchorParcel.isGroupSite ? "Grouped-site anchor" : "Parcel anchor"}</span>
                        <span className="meta-chip">{project.anchorParcel.landAreaSqm ?? "n/a"} sqm</span>
                        <span className="meta-chip">{project.anchorParcel.municipalityName ?? project.anchorParcel.city ?? "Location not set"}</span>
                      </div>
                      <div className="list-row__meta list-row__meta--clamped">
                        {project.description ?? "Project metadata stays here, while the underlying parcel/site anchor continues to hold land identity and provenance."}
                      </div>
                    </div>
                  </div>
                  <div className="ops-table__cell">
                    <div className="ops-cell-stack">
                      <div className="ops-scan__label">Site anchor</div>
                      <div className="ops-scan__value">{getAnchorLabel(project)}</div>
                      <div className="ops-scan__detail">
                        {project.anchorParcel.isGroupSite
                          ? "Grouped site / multi-parcel development anchor."
                          : "Single parcel / direct project anchor."}
                      </div>
                    </div>
                  </div>
                  <div className="ops-table__cell">
                    <div className="ops-cell-stack">
                      <div className="ops-scan__label">Scenario set</div>
                      <div className="ops-scan__value">{project.scenarioCount}</div>
                      <div className="ops-scan__detail">{project.activeScenarioCount} active candidate{project.activeScenarioCount === 1 ? "" : "s"}.</div>
                    </div>
                  </div>
                  <div className="ops-table__actions ops-table__actions--dense">
                    <div className="action-row action-row--compact">
                      <Link className={buttonClasses({ size: "sm" })} href={`/${orgSlug}/projects/${project.id}`}>
                        Open project
                      </Link>
                      <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/scenarios/new?projectId=${project.id}`}>
                        New scenario
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Projects unavailable"
          description="The project workspace could not reach the API. Restore the API first, then reload this page."
        />
      );
    }

    throw error;
  }
}
