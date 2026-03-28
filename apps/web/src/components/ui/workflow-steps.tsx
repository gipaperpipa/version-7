import Link from "next/link";

type WorkflowStep = {
  label: string;
  description: string;
  href?: string;
};

export function WorkflowSteps({
  title,
  steps,
  activeStep,
}: {
  title?: string;
  steps: WorkflowStep[];
  activeStep?: number;
}) {
  return (
    <div className="workflow-card">
      {title ? <div className="workspace-sidebar__label">{title}</div> : null}
      <div className="workflow-steps">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const stateClass = activeStep
            ? stepNumber < activeStep
              ? "workflow-step workflow-step--complete"
              : stepNumber === activeStep
                ? "workflow-step workflow-step--current"
                : "workflow-step"
            : "workflow-step";

          const content = (
            <>
              <div className="workflow-step__index">{stepNumber}</div>
              <div>
                <div className="workflow-step__label">{step.label}</div>
                <div className="workflow-step__description">{step.description}</div>
              </div>
            </>
          );

          return step.href ? (
            <Link key={step.label} className={stateClass} href={step.href}>
              {content}
            </Link>
          ) : (
            <div key={step.label} className={stateClass}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
