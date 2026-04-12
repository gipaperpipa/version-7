import Link from "next/link";
import { type ParcelDto } from "@repo/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScenarioEditorForm } from "@/components/scenarios/scenario-editor-form";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getProjects } from "@/lib/api/projects";
import { getScenarioAssumptionTemplates } from "@/lib/api/scenarios";
import { createScenarioAction } from "../actions";

function isGroupedSite(parcel: ParcelDto) {
  return parcel.isGroupSite || parcel.provenance?.trustMode === "GROUP_DERIVED";
}

function getParcelLabel(parcel: ParcelDto) {
  return parcel.name ?? parcel.cadastralId ?? "Unnamed site";
}

function hasMixedAuthority(parcel: ParcelDto) {
  const rawMetadata = parcel.provenance?.rawMetadata;
  if (!rawMetadata || typeof rawMetadata !== "object") return false;
  return "mixedAuthority" in rawMetadata && rawMetadata.mixedAuthority === true;
}

export default async function NewScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ error?: string; parcelId?: string; projectId?: string; message?: string }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const [parcels, projects, assumptionTemplates] = await Promise.all([
      getParcels(orgSlug),
      getProjects(orgSlug),
      getScenarioAssumptionTemplates(orgSlug),
    ]);
    const action = createScenarioAction.bind(null, orgSlug);
    const defaultProject = !resolvedSearchParams?.projectId && !resolvedSearchParams?.parcelId && projects.items.length === 1
      ? projects.items[0]
      : null;
    const effectiveProjectId = resolvedSearchParams?.projectId ?? defaultProject?.id ?? null;
    const selectedProject = effectiveProjectId
      ? projects.items.find((project) => project.id === effectiveProjectId) ?? null
      : null;
    const groupedSites = parcels.items
      .filter((parcel) => isGroupedSite(parcel))
      .sort((left, right) => getParcelLabel(left).localeCompare(getParcelLabel(right)));
    const defaultGroupedSite = !resolvedSearchParams?.projectId && !resolvedSearchParams?.parcelId && !defaultProject && groupedSites.length === 1 ? groupedSites[0] : null;
    const effectiveParcelId = selectedProject?.anchorParcelId ?? resolvedSearchParams?.parcelId ?? defaultGroupedSite?.id ?? null;
    const requestedParcel = effectiveParcelId
      ? parcels.items.find((parcel) => parcel.id === effectiveParcelId) ?? null
      : null;
    const selectedParcel = requestedParcel?.parcelGroupId && !requestedParcel.isGroupSite
      ? parcels.items.find((parcel) => parcel.id === requestedParcel.parcelGroup?.siteParcelId) ?? requestedParcel
      : requestedParcel;
    const sourceBackedCount = parcels.items.filter((parcel) => {
      return parcel.provenance?.trustMode === "SOURCE_PRIMARY" || parcel.provenance?.trustMode === "SOURCE_INCOMPLETE";
    }).length;
    const groupedSiteCount = parcels.items.filter((parcel) => parcel.isGroupSite || parcel.provenance?.trustMode === "GROUP_DERIVED").length;
    const manualFallbackCount = parcels.items.filter((parcel) => parcel.provenance?.trustMode === "MANUAL_FALLBACK").length;
    const projectCount = projects.items.length;
    const projectSelectionMessage = defaultProject
      ? `${defaultProject.name} was preselected because projects are now the higher-level working object above parcel/site anchors.`
      : null;
    const groupedSiteSelectionMessage = defaultGroupedSite
      ? `${getParcelLabel(defaultGroupedSite)} was preselected because grouped sites are the primary downstream scenario anchor once parcel assembly is complete.`
      : null;
    const selectedParcelMessage = selectedParcel
      ? selectedProject
        ? `${selectedProject.name} is anchored to ${selectedParcel.name ?? selectedParcel.cadastralId ?? "this site"} and will carry its own project identity into the scenario workspace.`
        : selectedParcel.isGroupSite
        ? `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This grouped site"} already aggregates ${selectedParcel.parcelGroup?.memberCount ?? selectedParcel.constituentParcels.length} sourced parcels and is ready to carry into case setup.`
        : selectedParcel.provenance?.trustMode === "MANUAL_FALLBACK"
          ? `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This parcel"} remains usable for scenario work, but source-backed parcel identity should stay the default path when available.`
          : `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This parcel"} will carry straight into funding, readiness, and run.`
      : "Choose the project or parcel/site anchor you want to test, save the case, then continue in the builder.";

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario studio"
          title="Create a scenario"
          description="Open a project-linked case from a sourced parcel or grouped site anchor, then continue in the builder."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{projectCount} project{projectCount === 1 ? "" : "s"}</span>
              <span className="meta-chip">{parcels.total} parcel option{parcels.total === 1 ? "" : "s"}</span>
              <span className="meta-chip">{sourceBackedCount} source-backed</span>
              <span className="meta-chip">{groupedSiteCount} grouped sites</span>
              <span className="meta-chip">{manualFallbackCount} fallback manual</span>
            </div>
          )}
          actions={(
            <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
              Back to scenarios
            </Link>
          )}
        />

        {resolvedSearchParams?.error === "invalid-strategy-mix-json" ? (
          <Alert tone="danger">
            <AlertTitle>Invalid mix configuration JSON</AlertTitle>
            <AlertDescription>The temporary mixed-strategy JSON could not be parsed. Please fix the JSON and try again.</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "create-request-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Scenario creation failed</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The API rejected the new scenario request. Review the setup inputs and try again."}</AlertDescription>
          </Alert>
        ) : null}

        {groupedSiteSelectionMessage ? (
          <Alert tone="info">
            <AlertTitle>Grouped site preselected</AlertTitle>
            <AlertDescription>{groupedSiteSelectionMessage}</AlertDescription>
          </Alert>
        ) : null}

        {projectSelectionMessage ? (
          <Alert tone="info">
            <AlertTitle>Project preselected</AlertTitle>
            <AlertDescription>{projectSelectionMessage}</AlertDescription>
          </Alert>
        ) : null}

        {!parcels.items.length ? (
          <EmptyState
            eyebrow="Parcel dependency"
            title="A scenario needs source-backed parcel intake first"
            description="Search and ingest a source-backed parcel or grouped site first so geometry, area, and provenance stay attached to the case. Manual parcel creation remains fallback."
            actions={(
              <>
                <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new`}>
                  Source intake
                </Link>
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new/manual`}>
                  Manual fallback
                </Link>
              </>
            )}
          />
        ) : null}

        {parcels.items.length ? (
          <div className="content-stack">
            <SectionCard
              className="index-surface index-surface--workspace"
              eyebrow="Project workflow"
              title="Start from a project when the site already has working context"
              description="Projects are now the higher-level working object above parcel and grouped-site anchors. Use an existing project when repeated scenario work is already clustered there."
            >
              {projects.items.length ? (
                <div className="ops-table">
                  <div className="ops-table__header ops-table__header--parcels">
                    <div>Project</div>
                    <div>Anchor</div>
                    <div>Scenario set</div>
                    <div>Start</div>
                  </div>
                  {projects.items.map((project) => (
                    <div key={project.id} className="ops-table__row ops-table__row--parcels">
                      <div className="ops-table__cell">
                        <div className="list-row__body">
                          <div className="list-row__title">
                            <span className="list-row__title-text">{project.name}</span>
                            <StatusBadge tone={selectedProject?.id === project.id ? "accent" : "neutral"}>
                              {selectedProject?.id === project.id ? "Selected" : project.status === "ACTIVE" ? "Active" : project.status === "ON_HOLD" ? "On hold" : "Archived"}
                            </StatusBadge>
                          </div>
                          <div className="inline-meta">
                            <span className="meta-chip">{project.anchorParcel.isGroupSite ? "Grouped-site anchor" : "Parcel anchor"}</span>
                            <span className="meta-chip">{project.anchorParcel.landAreaSqm ?? "n/a"} sqm</span>
                            <span className="meta-chip">{project.anchorParcel.municipalityName ?? project.anchorParcel.city ?? "Location pending"}</span>
                          </div>
                          <div className="list-row__meta list-row__meta--clamped">
                            {project.description ?? "Project identity lives above the land anchor so repeated scenario work can stay organized without weakening parcel/site source truth."}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Site anchor</div>
                          <div className="ops-scan__value">{project.anchorParcel.name ?? project.anchorParcel.cadastralId ?? "Unnamed anchor"}</div>
                          <div className="ops-scan__detail">
                            {project.anchorParcel.isGroupSite
                              ? "Grouped-site anchor already assembled from multiple parcels."
                              : "Single-parcel anchor ready to carry project context forward."}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Scenario set</div>
                          <div className="ops-scan__value">{project.activeScenarioCount} active</div>
                          <div className="ops-scan__detail">{project.scenarioCount} total scenario{project.scenarioCount === 1 ? "" : "s"} linked to this project.</div>
                        </div>
                      </div>

                      <div className="ops-table__actions ops-table__actions--dense">
                        <div className="action-row action-row--compact">
                          <Link className={buttonClasses({ size: "sm" })} href={`/${orgSlug}/scenarios/new?projectId=${project.id}`}>
                            Use project
                          </Link>
                          <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/projects/${project.id}`}>
                            Review project
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  eyebrow="No projects yet"
                  title="Projects appear once a parcel or grouped site is promoted into repeated work"
                  description="You can still start from a grouped site or standalone parcel below. The app will create or reuse a project automatically once you open a new scenario."
                  actions={(
                    <Link className={buttonClasses()} href={`/${orgSlug}/parcels`}>
                      Open parcel board
                    </Link>
                  )}
                />
              )}
            </SectionCard>

            <SectionCard
              className="index-surface index-surface--workspace"
              eyebrow="Grouped-site workflow"
              title="Start from a development site"
              description="Grouped sites remain the primary land anchor once parcel assembly is complete. Pair them with a project when you want a higher-level business object above the site."
            >
              {groupedSites.length ? (
                <div className="ops-table">
                  <div className="ops-table__header ops-table__header--parcels">
                    <div>Grouped site</div>
                    <div>Members</div>
                    <div>Source</div>
                    <div>Start</div>
                  </div>
                  {groupedSites.map((parcel) => {
                    const memberCount = parcel.parcelGroup?.memberCount ?? parcel.constituentParcels.length;
                    const mixedAuthority = hasMixedAuthority(parcel);
                    return (
                      <div key={parcel.id} className="ops-table__row ops-table__row--parcels">
                        <div className="ops-table__cell">
                          <div className="list-row__body">
                            <div className="list-row__title">
                              <span className="list-row__title-text">{getParcelLabel(parcel)}</span>
                              <StatusBadge tone={selectedParcel?.id === parcel.id ? "accent" : "neutral"}>
                                {selectedParcel?.id === parcel.id ? "Selected" : "Available"}
                              </StatusBadge>
                            </div>
                            <div className="inline-meta">
                              <span className="meta-chip">{parcel.landAreaSqm ?? "n/a"} sqm</span>
                              <span className="meta-chip">{parcel.city ?? parcel.municipalityName ?? "Location not set"}</span>
                              {mixedAuthority ? <span className="meta-chip">Mixed authority</span> : null}
                            </div>
                            <div className="list-row__meta list-row__meta--clamped">
                              {mixedAuthority
                                ? "This grouped site mixes source authority levels across its member parcels, so downstream trust stays conservative."
                                : "This grouped site is already organized as the working development-site anchor."}
                            </div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Composition</div>
                            <div className="ops-scan__value">{memberCount} parcel{memberCount === 1 ? "" : "s"}</div>
                            <div className="ops-scan__detail">Grouped-site scenario creation will write to the site anchor, not the member parcels.</div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Source</div>
                            <ProvenanceConfidence
                              sourceType={parcel.sourceType}
                              confidenceScore={parcel.confidenceScore}
                              sourceReference={parcel.sourceReference}
                              provenance={parcel.provenance}
                              providerName={parcel.sourceProviderName}
                              providerParcelId={parcel.sourceProviderParcelId}
                              variant="inline"
                            />
                          </div>
                        </div>

                        <div className="ops-table__actions ops-table__actions--dense">
                          <div className="action-row action-row--compact">
                            <Link className={buttonClasses({ size: "sm" })} href={`/${orgSlug}/scenarios/new?parcelId=${parcel.id}`}>
                              Use site
                            </Link>
                            <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/parcels/${parcel.id}`}>
                              Review site
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  eyebrow="No grouped sites yet"
                  title="Grouped sites will show up here once parcels are assembled"
                  description="Scenarios can still start from standalone sourced parcels, but grouped sites are the intended day-to-day development anchor once multiple parcels are in play."
                  actions={(
                    <>
                      <Link className={buttonClasses()} href={`/${orgSlug}/parcels`}>
                        Open parcel board
                      </Link>
                      <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new`}>
                        Source intake
                      </Link>
                    </>
                  )}
                />
              )}
            </SectionCard>

            <div className="detail-grid detail-grid--setup setup-grid">
              <ScenarioEditorForm
                action={action}
                parcels={parcels.items}
                projects={projects.items}
                templates={assumptionTemplates.items}
                workspaceDefaultTemplateKey={assumptionTemplates.workspaceDefaultTemplateKey}
                initialParcelId={effectiveParcelId}
                initialProjectId={effectiveProjectId}
                submitLabel="Create scenario"
                mode="create"
              />

              <div className="sidebar-stack">
                <NextStepPanel
                  className="rail-panel rail-panel--action"
                  title={selectedParcel ? "Start from the selected site" : "Create a parcel-linked case"}
                  description={selectedParcelMessage}
                  size="compact"
                  actions={(
                    <>
                      <Link className={buttonClasses()} href={`/${orgSlug}/parcels`}>
                        Review parcels
                      </Link>
                      <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                        Scenario list
                      </Link>
                    </>
                  )}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Scenario creation unavailable"
          description="The parcel list for new scenarios could not be loaded because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
