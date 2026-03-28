import Link from "next/link";
import { getConfiguredApiBaseUrl } from "@/lib/local-dev";
import { buttonClasses } from "./button";
import { SectionCard } from "./section-card";
import { WorkflowSteps } from "./workflow-steps";

export function ApiUnreachableState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const apiBaseUrl = getConfiguredApiBaseUrl();
  const healthUrl = apiBaseUrl ? `${apiBaseUrl}/api/health` : null;
  const docsUrl = apiBaseUrl ? `${apiBaseUrl}/api/docs` : null;

  return (
    <div className="workspace-page content-stack">
      <SectionCard
        eyebrow="API diagnostics"
        title={title}
        description={description}
        tone="muted"
      >
        <div className="content-stack">
          <p className="muted-copy">
            The web app could not reach the configured API. Check the deployment diagnostics below, then reload the page.
          </p>
          <div className="action-row">
            <Link className={buttonClasses()} href="/">
              Back to product entry
            </Link>
            {healthUrl ? (
              <a className={buttonClasses({ variant: "secondary" })} href={healthUrl}>
                Check API health
              </a>
            ) : null}
            {docsUrl ? (
              <a className={buttonClasses({ variant: "ghost" })} href={docsUrl}>
                Open API docs
              </a>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Expected checks"
        title="Recovery steps"
        description="Use the same health and docs checks documented in the README."
      >
        <WorkflowSteps
          steps={[
            { label: "Check API docs", description: "Open the configured /api/docs route to confirm the Nest app is listening." },
            { label: "Check health", description: "Open the configured /api/health route and confirm you get a 200 response." },
            { label: "Check startup logs", description: "Look for the successful startup log line with the final API base URL." },
          ]}
          activeStep={1}
        />
      </SectionCard>
    </div>
  );
}
