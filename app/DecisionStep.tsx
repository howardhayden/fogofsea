import { useId, type ReactNode, type Ref } from "react";

export type DecisionStepStatus = "current" | "complete" | "locked";

type DecisionStepProps = {
  number: number;
  title: string;
  status: DecisionStepStatus;
  summary?: string;
  lockedReason?: string;
  note?: string;
  onEdit?: () => void;
  editButtonRef?: Ref<HTMLButtonElement>;
  children?: ReactNode;
};

export default function DecisionStep({
  number,
  title,
  status,
  summary,
  lockedReason,
  note,
  onEdit,
  editButtonRef,
  children,
}: DecisionStepProps) {
  const panelId = useId();
  const headingId = `${panelId}-heading`;
  const label = `${number} · ${title}`;

  if (status === "current") {
    return (
      <li className="decision-step decision-step--current" aria-current="step">
        <div className="decision-step-heading">
          <span id={headingId} role="heading" aria-level={3}>{label}</span>
          <small>CURRENT DECISION</small>
        </div>
        <div id={panelId} className="decision-step-panel" role="group" aria-labelledby={headingId}>
          {children}
        </div>
        {note && <small className="decision-step-note">{note}</small>}
      </li>
    );
  }

  if (status === "complete") {
    return (
      <li className="decision-step decision-step--complete">
        <button
          type="button"
          className="decision-step-summary"
          aria-label={`Change ${title}. Current selection: ${summary}.`}
          aria-expanded="false"
          aria-controls={panelId}
          onClick={onEdit}
          ref={editButtonRef}
        >
          <span className="decision-step-summary-label">{label}</span>
          <strong>{summary}</strong>
          <small>CHANGE</small>
        </button>
        <div id={panelId} hidden />
      </li>
    );
  }

  return (
    <li className="decision-step decision-step--locked">
      <div className="decision-step-summary" aria-disabled="true">
        <span className="decision-step-summary-label">{label}</span>
        {summary && <strong>{summary}</strong>}
        <small>LOCKED · {lockedReason || "Complete the preceding decision."}</small>
      </div>
      <div id={panelId} hidden />
    </li>
  );
}
