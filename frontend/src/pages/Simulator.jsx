import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { api, DURATIONS, messageFor, money } from "@/api";
import {
  ErrorState, EvidenceChip, LoadingState, Metric, SectionHeading, StatusBadge,
} from "@/components/primitives";

function ScoreJourney({ result }) {
  return (
    <section className="score-journey panel" data-testid="score-journey">
      <SectionHeading eyebrow="RESILIENCE JOURNEY" title="From exposure to action" action={<span className="mono">CONFIDENCE {Math.round(result.confidence * 100)}%</span>} />
      <div className="journey-values">
        <div data-testid="journey-baseline">
          <span>BASELINE</span>
          <strong>{result.baseline_score}</strong>
        </div>
        <ArrowRight size={18} />
        <div className="exposed" data-testid="journey-absence">
          <span>DURING ABSENCE</span>
          <strong>{result.simulated_score}</strong>
        </div>
        <ArrowRight size={18} />
        <div className="improved" data-testid="journey-mitigated">
          <span>AFTER MITIGATION</span>
          <strong>{result.mitigated_score}</strong>
        </div>
      </div>
      <p className="journey-note">
        The {result.score_drop}-point drop is concentrated in process continuity and backup ownership.
        Completing the recovery plan lifts the scenario to {result.mitigated_score}.
      </p>
    </section>
  );
}

function Comparison({ runs, active }) {
  const entries = DURATIONS.filter((option) => runs[option.days]);
  if (entries.length < 2) return null;
  return (
    <section className="panel comparison" data-testid="scenario-comparison">
      <SectionHeading eyebrow="SCENARIO COMPARISON" title="Duration changes the damage" />
      <div className="comparison-grid">
        {entries.map((option) => {
          const run = runs[option.days];
          return (
            <div
              key={option.days}
              className={`comparison-col ${option.days === active ? "active" : ""}`}
              data-testid={`comparison-${option.days}`}
            >
              <span>{option.label}</span>
              <div className="comparison-bar">
                <i style={{ height: `${run.simulated_score}%` }} />
              </div>
              <strong>{run.simulated_score}</strong>
              <small>mitigated {run.mitigated_score}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Simulator() {
  const { personId = "sarah-mitchell" } = useParams();
  const [duration, setDuration] = useState(90);
  const [result, setResult] = useState(null);
  const [runs, setRuns] = useState({});
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");
  const [person, setPerson] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setResult(null);
    setRuns({});
    api
      .get(`/people/${personId}`)
      .then((response) => setPerson(response.data.person))
      .catch((err) => setError(messageFor(err)));
  }, [personId]);

  const run = async (days = duration) => {
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/scenarios/simulate", {
        person_id: personId,
        duration_days: days,
      });
      setResult(response.data);
      setRuns((previous) => ({ ...previous, [days]: response.data }));
    } catch (err) {
      setError(messageFor(err));
    }
    setBusy(false);
  };

  const compareAll = async () => {
    setComparing(true);
    try {
      const responses = await Promise.all(
        DURATIONS.map((option) =>
          api.post("/scenarios/simulate", { person_id: personId, duration_days: option.days }),
        ),
      );
      const next = {};
      responses.forEach((response) => {
        next[response.data.duration_days] = response.data;
      });
      setRuns(next);
      setResult(next[duration] || responses[responses.length - 1].data);
    } catch (err) {
      setError(messageFor(err));
    }
    setComparing(false);
  };

  if (error && !person) return <ErrorState message={error} onRetry={() => navigate("/people")} />;
  if (!person) return <LoadingState label="Loading dependency footprint…" />;

  return (
    <div className="page" data-testid="simulation-page">
      <button className="back-button" onClick={() => navigate(`/people/${personId}`)} data-testid="simulation-back-button">
        <ArrowLeft size={14} /> {person.name}
      </button>

      <div className="page-intro">
        <div>
          <span className="eyebrow">ABSENCE SIMULATOR / COUNTERFACTUAL VIEW</span>
          <h1>What happens if {person.name.split(" ")[0]} is unavailable?</h1>
          <p>Estimated impact propagated through the dependency graph — not a prediction.</p>
        </div>
        <StatusBadge tone="calm" testId="model-badge">Deterministic model</StatusBadge>
      </div>

      <section className="simulation-setup panel" data-testid="simulation-setup-panel">
        <div>
          <span className="eyebrow">SCENARIO DURATION</span>
          <h2>Choose the absence window</h2>
          <p className="muted">
            Longer windows compound the damage: unbacked work queues, client context decays and
            undocumented decisions stall.
          </p>
        </div>
        <div className="duration-selector">
          {DURATIONS.map((option) => (
            <button
              key={option.days}
              className={duration === option.days ? "active" : ""}
              onClick={() => setDuration(option.days)}
              data-testid={`simulation-duration-${option.label.toLowerCase().replace(" ", "-")}-button`}
            >
              {option.label}
              <span>{option.days === 90 ? "Demo path" : ""}</span>
            </button>
          ))}
        </div>
        <div className="simulation-buttons">
          <button className="primary-button" onClick={() => run()} disabled={busy} data-testid="run-simulation-button">
            {busy ? "Propagating dependency impact…" : "Run simulation"}
            <ArrowRight size={16} />
          </button>
          <button className="secondary-button" onClick={compareAll} disabled={comparing} data-testid="compare-all-durations-button">
            {comparing ? "Comparing…" : "Compare all durations"}
          </button>
        </div>
      </section>

      {error ? <ErrorState message={error} onRetry={() => run()} /> : null}

      {result ? (
        <div className="result-view" data-testid="simulation-result-view">
          <section className="result-head panel">
            <div>
              <span className="eyebrow">{result.duration_label.toUpperCase()} ABSENCE SIMULATION</span>
              <h2>
                {result.person.name} unavailable for {result.duration_label.toLowerCase()}
              </h2>
              <p>Estimated organizational impact based on the dependencies recorded today.</p>
            </div>
            <div className="confidence">
              <span>SIMULATION CONFIDENCE</span>
              <strong>{Math.round(result.confidence * 100)}%</strong>
              <small>estimated · evidence-backed</small>
            </div>
          </section>

          <div className="metric-grid result-metrics">
            <Metric label="Processes affected" value={result.counts.processes} note="Direct and downstream" tone="danger-text" testId="metric-processes-affected" />
            <Metric label="Clients at risk" value={result.counts.clients} note={money(result.revenue_at_risk)} tone="warning-text" testId="metric-clients-at-risk" />
            <Metric label="Knowledge gaps" value={result.counts.knowledge_gaps} note="Below 70% coverage" testId="metric-knowledge-gaps" />
            <Metric label="Critical findings" value={result.counts.critical_findings} note="Review recommended" tone="danger-text" testId="metric-critical-findings" />
          </div>

          <ScoreJourney result={result} />
          <Comparison runs={runs} active={result.duration_days} />

          <div className="result-grid">
            <section className="panel findings">
              <SectionHeading eyebrow="PROPAGATED IMPACT" title="What changes downstream" />
              {result.findings.map((finding, index) => (
                <div className="finding" key={finding.id} data-testid={`simulation-finding-${finding.id}`}>
                  <span className="finding-number">0{index + 1}</span>
                  <div>
                    <StatusBadge>{finding.severity}</StatusBadge>
                    <h3>{finding.title}</h3>
                    <p>{finding.explanation}</p>
                    <EvidenceChip confidence={finding.confidence}>
                      {finding.evidence} · {finding.references} refs
                    </EvidenceChip>
                  </div>
                </div>
              ))}
              <div className="manual-block">
                <h3>Affected processes</h3>
                {result.affected_processes.map((process) => (
                  <div className="list-line" key={process.id} data-testid={`affected-process-${process.id}`}>
                    <div>
                      <b>{process.name}</b>
                      <span>{process.reason}</span>
                    </div>
                    <StatusBadge>{process.impact}</StatusBadge>
                    <StatusBadge>{process.criticality}</StatusBadge>
                  </div>
                ))}
              </div>
              <div className="manual-block">
                <h3>Clients at risk</h3>
                {result.clients_at_risk.map((client) => (
                  <div className="list-line" key={client.id} data-testid={`at-risk-client-${client.id}`}>
                    <div>
                      <b>{client.name}</b>
                      <span>{client.reason}</span>
                    </div>
                    <span className="mono">{money(client.annual_revenue)}</span>
                  </div>
                ))}
              </div>
              <div className="assumptions">
                <span className="eyebrow">ASSUMPTIONS</span>
                {result.assumptions.map((assumption) => (
                  <p key={assumption}>
                    <Check size={14} /> {assumption}
                  </p>
                ))}
              </div>
            </section>

            <section className="panel recovery">
              <SectionHeading eyebrow="ACTION CENTER" title="Recommended recovery plan" />
              {result.recovery_plan.map((action) => (
                <div className="action-preview" key={action.id} data-testid={`recovery-action-${action.id}`}>
                  <span className="action-icon">
                    <Check size={14} />
                  </span>
                  <div>
                    <b>{action.title}</b>
                    <small>
                      {action.type} · {action.effort} effort
                    </small>
                  </div>
                  <strong>+{action.scenario_reduction}</strong>
                </div>
              ))}
              {result.recovery_plan.length === 0 ? (
                <p className="muted">No recovery actions are queued for this person yet.</p>
              ) : null}
              <button className="primary-button full-button" onClick={() => navigate("/actions")} data-testid="open-action-center-button">
                Open action center <ArrowRight size={15} />
              </button>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
