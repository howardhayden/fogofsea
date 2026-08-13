type RecapDatum = {
  label: string;
  value: string;
};

type PlanningRecapProps = {
  operation: string;
  location: string;
  brief: string;
  environment: RecapDatum[];
  decisions: RecapDatum[];
  force?: RecapDatum[];
  selectedForce?: string[];
};

function RecapList({ items }: { items: RecapDatum[] }) {
  return (
    <dl>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A read-only record of decisions made before command begins. Keeping this in a
 * native disclosure lets players consult their plan without reopening any of
 * the selection interfaces that created it.
 */
export default function PlanningRecap({
  operation,
  location,
  brief,
  environment,
  decisions,
  force,
  selectedForce = [],
}: PlanningRecapProps) {
  return (
    <details className="planning-recap">
      <summary>
        <span>REVIEW PLANNING RECAP</span>
        <small>Mission · environment · decisions{force ? " · force" : ""}</small>
      </summary>
      <div className="planning-recap-content" data-testid="planning-recap-content">
        <section aria-labelledby="recap-mission-title">
          <h3 id="recap-mission-title">MISSION</h3>
          <strong>OPERATION {operation}</strong>
          <small>{location}</small>
          <p>{brief}</p>
        </section>
        <section aria-labelledby="recap-environment-title">
          <h3 id="recap-environment-title">ENVIRONMENT</h3>
          <RecapList items={environment} />
        </section>
        <section aria-labelledby="recap-decisions-title">
          <h3 id="recap-decisions-title">RECORDED DECISIONS</h3>
          <RecapList items={decisions} />
        </section>
        {force && (
          <section aria-labelledby="recap-force-title">
            <h3 id="recap-force-title">FORCE &amp; READINESS</h3>
            <RecapList items={force} />
            <p className="planning-recap-force-list">
              <b>SELECTED FORCE</b>
              {selectedForce.length ? selectedForce.join(" · ") : "No force selections recorded."}
            </p>
          </section>
        )}
      </div>
    </details>
  );
}
