import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api, messageFor } from "@/api";
import { EmptyState, ErrorState, LoadingState, SectionHeading, StatusBadge } from "@/components/primitives";

export default function ActionCenter() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const navigate = useNavigate();

  const load = () => {
    setError("");
    api
      .get("/actions")
      .then((response) => setData(response.data))
      .catch((err) => setError(messageFor(err)));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (action) => {
    const nextStatus = action.status === "Completed" ? "Open" : "Completed";
    setPending(action.id);
    try {
      const response = await api.patch(`/actions/${action.id}`, { status: nextStatus });
      toast.success(nextStatus === "Completed" ? "Action completed" : "Action reopened", {
        description: `Resilience score is now ${response.data.score.current_score}/100`,
      });
      load();
    } catch (err) {
      toast.error("Could not update the action", { description: messageFor(err) });
    }
    setPending("");
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Prioritizing the recovery plan…" />;

  const { actions, summary } = data;

  return (
    <div className="page" data-testid="action-center-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ACTION CENTER / REMEDIATION QUEUE</span>
          <h1>Fix the weak links first.</h1>
          <p>Every action is tied to a finding and ranked by risk reduction against effort.</p>
        </div>
        <div className="action-summary">
          <strong data-testid="open-actions-count">{summary.open}</strong>
          <span>open actions</span>
        </div>
      </div>

      <div className="action-layout">
        <section className="panel action-queue">
          <SectionHeading eyebrow="PRIORITIZED QUEUE" title="Recovery plan" action={<span className="mono">SORT: RISK / EFFORT</span>} />
          {actions.length === 0 ? (
            <EmptyState title="Nothing queued" body="Run a simulation to generate a recovery plan." testId="actions-empty-state" />
          ) : null}
          {actions.map((action, index) => (
            <div
              className={`action-row ${action.status === "Completed" ? "completed" : ""}`}
              key={action.id}
              data-testid={`action-row-${action.id}`}
            >
              <div className="priority-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="action-main">
                <div className="action-tags">
                  <StatusBadge testId={`action-priority-${action.id}`}>{action.priority}</StatusBadge>
                  <span className="effort">{action.effort} effort</span>
                  <span className="effort">Owner: {action.owner}</span>
                </div>
                <h3>{action.title}</h3>
                <small>{action.rationale}</small>
                <button
                  className="text-button"
                  onClick={() => navigate(`/people/${action.person_id}`)}
                  data-testid={`action-person-${action.id}-button`}
                >
                  View dependency
                </button>
              </div>
              <div className="risk-lift">
                <strong>+{action.org_uplift}</strong>
                <span>score uplift</span>
                <small>+{action.scenario_reduction} scenario</small>
              </div>
              <button
                className={`complete-button ${action.status === "Completed" ? "done" : ""}`}
                onClick={() => toggle(action)}
                disabled={pending === action.id}
                data-testid={`complete-action-${action.id}-button`}
              >
                {action.status === "Completed" ? (
                  <>
                    <RotateCcw size={15} /> Reopen
                  </>
                ) : (
                  <>
                    <Check size={15} /> Mark complete
                  </>
                )}
              </button>
            </div>
          ))}
        </section>

        <aside className="panel action-impact" data-testid="action-impact-panel">
          <span className="eyebrow">MEASURED OUTCOME</span>
          <h2 data-testid="action-current-score">
            {summary.current_score}
            <span>/100</span>
          </h2>
          <p>Resilience score recalculated from the actions completed so far.</p>
          <div className="outcome-line">
            <span>Baseline</span>
            <b>{summary.baseline_score}</b>
          </div>
          <div className="outcome-line">
            <span>Current</span>
            <b className="green">{summary.current_score}</b>
          </div>
          <div className="outcome-line">
            <span>Target with full plan</span>
            <b>{summary.target_score}</b>
          </div>
          <div className="outcome-line">
            <span>Uplift still available</span>
            <b>+{summary.available_uplift}</b>
          </div>
          <div className="green-callout">
            <Check size={16} />
            <span>Keeping knowledge moving is what creates resilience.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
