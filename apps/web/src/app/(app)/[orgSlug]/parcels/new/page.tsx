import Link from "next/link";
import { ParcelEditorForm } from "@/components/parcels/parcel-editor-form";
import { buttonClasses } from "@/components/ui/button";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { WorkflowSteps } from "@/components/ui/workflow-steps";
import { createParcelAction } from "../actions";

export default async function NewParcelPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const action = createParcelAction.bind(null, orgSlug);

  return (
    <div className="workspace-page content-stack">
      <PageHeader
        eyebrow="Parcel intake"
        title="Create a fallback parcel"
        description="Use manual parcel intake when sourced parcel selection is unavailable. The form is intentionally practical, not the intended flagship intake experience."
        actions={(
          <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels`}>
            Back to parcels
          </Link>
        )}
      />

      <div className="detail-grid">
        <ParcelEditorForm action={action} submitLabel="Create parcel" />

        <div className="sidebar-stack">
          <NextStepPanel
            title="Save, then move into planning"
            description="The parcel is only the first step. Planning interpretation should be the next structured move after this fallback intake is saved."
            actions={(
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels`}>
                Return to parcel pipeline
              </Link>
            )}
          />

          <SectionCard
            eyebrow="Workflow"
            title="What happens after parcel creation"
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
            title="Why this form stays restrained"
            description="Manual parcel entry is useful, but it should not become the product center."
            tone="muted"
          >
            <div className="helper-list">
              <div>Real parcel intake is expected to come from source selection and automatic geometry capture.</div>
              <div>Manual land area entry remains a fallback for demo testing and source gaps.</div>
              <div>Planning interpretation and scenario work are the important downstream steps after this screen.</div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
