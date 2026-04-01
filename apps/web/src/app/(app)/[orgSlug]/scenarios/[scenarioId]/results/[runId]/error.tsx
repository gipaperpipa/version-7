"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

function getBuilderHref(pathname: string) {
  const match = pathname.match(/^\/([^/]+)\/scenarios\/([^/]+)\/results\/([^/]+)/);
  if (!match) return "/demo/scenarios";
  const [, orgSlug, scenarioId] = match;
  return `/${orgSlug}/scenarios/${scenarioId}/builder`;
}

function getScenarioListHref(pathname: string) {
  const match = pathname.match(/^\/([^/]+)\/scenarios\//);
  if (!match) return "/demo/scenarios";
  return `/${match[1]}/scenarios`;
}

export default function ScenarioResultError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const builderHref = getBuilderHref(pathname);
  const scenarioListHref = getScenarioListHref(pathname);

  return (
    <div className="workspace-page content-stack">
      <EmptyState
        eyebrow="Result unavailable"
        title="This result page could not be assembled"
        description="The run may have completed with an unexpected payload shape or a downstream rendering issue. Return to the builder, review the scenario, then try the run again."
        actions={(
          <>
            <button type="button" className={buttonClasses()} onClick={() => reset()}>
              Retry load
            </button>
            <Link className={buttonClasses({ variant: "secondary" })} href={builderHref}>
              Back to builder
            </Link>
            <Link className={buttonClasses({ variant: "ghost" })} href={scenarioListHref}>
              Scenario list
            </Link>
          </>
        )}
      />
    </div>
  );
}
