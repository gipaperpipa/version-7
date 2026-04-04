import Link from "next/link";
import { ParcelEditorForm } from "@/components/parcels/parcel-editor-form";
import { buttonClasses } from "@/components/ui/button";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { WorkflowSteps } from "@/components/ui/workflow-steps";
import { createParcelAction } from "../../actions";

export default async function ManualParcelPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const action = createParcelAction.bind(null, orgSlug);

  return (
    <div className="workspace-page content-stack">
      <PageHeader
        eyebrow="Fallback parcel intake"
        title="Create a manual fallback parcel"
        description="Use this only when source-backed parcel selection is unavailable. The intended parcel identity still comes from source-derived geometry and area."
        actions={(
          <>
            <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new`}>
              Source intake
            </Link>
            <Link className={buttonClasses({ variant: "ghost" })} href={`/${orgSlug}/parcels`}>
              Back to parcels
            </Link>
          </>
        )}
      />

      <div className="detail-grid">
        <ParcelEditorForm action={action} submitLabel="Create fallback parcel" />

        <div className="sidebar-stack">
          <NextStepPanel
            title="Save, then move into planning"
            description="Manual intake remains a usable bridge into planning and scenario work, but it should not replace source-selected parcel identity."
            actions={(
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels`}>
                Return to parcel board
              </Link>
            )}
          />

          <SectionCard
            eyebrow="Workflow"
            title="What happens after fallback intake"
            description="The current product loop stays intentionally linear and testable."
          >
            <WorkflowSteps
              activeStep={1}
              steps={[
                { label: "Parcel intake", description: "Capture the minimum site context needed for downstream work." },
                { label: "Planning inputs", description: "Interpret the narrow buildability and policy keys used by Sprint 1." },
                { label: "Scenario setup", description: "Carry the parcel into a decision case with funding and run logic." },
              ]}
            />
          </SectionCard>

          <SectionCard
            eyebrow="Product direction"
            title="Why manual entry stays secondary"
            description="The parcel workflow should center on sourced parcel IDs, geometry, and area."
            tone="muted"
          >
            <div className="helper-list">
              <div>Source-selected parcels are the intended main model.</div>
              <div>Manual parcel entry remains useful for source gaps, local testing, or exceptional cases.</div>
              <div>Planning interpretation and scenario work remain the important downstream steps after this fallback path.</div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
