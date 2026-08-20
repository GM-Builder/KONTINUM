import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { api, messageFor, money } from "@/api";
import {
  Bar, EmptyState, ErrorState, EvidenceChip, LoadingState, ScoreRing, SectionHeading, StatusBadge,
} from "@/components/primitives";

const TABS = ["overview", "knowledge", "relationships", "processes", "gaps", "evidence"];

export default function HumanManual() {
  const { personId } = useParams();
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [insight, setInsight] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setData(null);
    setError("");
    setTab("overview");
    api
      .get(`/people/${personId}`)
      .then((response) => setData(response.data))
      .catch((err) => setError(messageFor(err)));
    api
      .get(`/insights/${personId}`)
      .then((response) => setInsight(response.data))
      .catch(() => setInsight(null));
  }, [personId]);

  if (error) return <ErrorState message={error} onRetry={() => navigate("/people")} />;
  if (!data) return <LoadingState label="Assembling the human manual…" />;

  const { person, owns, knowledge, knowledge_gaps: gaps, findings, evidence, score_breakdown: breakdown, actions } = data;

  return (
    <div className="page" data-testid="human-manual-page">
      <button className="back-button" onClick={() => navigate("/map?focus=" + person.id)} data-testid="human-manual-back-button">
        <ArrowLeft size={14} /> Dependency map
      </button>

      <div className="manual-header">
        <div className="manual-identity">
          <ScoreRing score={person.dependency_score} coverage={person.knowledge_coverage} size="lg" name={person.name} />
          <div>
            <span className="eyebrow">HUMAN MANUAL</span>
            <h1>{person.name}</h1>
            <p>
              {person.role} · {person.team}
            </p>
            <div className="manual-meta">
              <StatusBadge testId="manual-tier-badge">{person.tier}</StatusBadge>
              <span className="mono">TENURE {person.tenure}</span>
              <span className="mono">MANAGER {person.manager}</span>
              <span className="mono">{money(person.revenue_at_risk)} REVENUE OWNED</span>
            </div>
          </div>
        </div>
        <div className="manual-cta">
          <span className="eyebrow">DEPENDENCY RISK</span>
          <strong data-testid="manual-dependency-score">
            {person.dependency_score}
            <small>/100</small>
          </strong>
          <button
            className="primary-button"
            onClick={() => navigate(`/simulate/${person.id}`)}
            data-testid="human-manual-simulate-button"
          >
            Simulate absence <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
            data-testid={`human-manual-tab-${item}-button`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="manual-grid" data-testid="manual-tab-overview">
          <section className="panel">
            <SectionHeading eyebrow="OPERATING KNOWLEDGE" title={`What ${person.name.split(" ")[0]} carries`} />
            <div className="manual-block">
              <h3>Owned processes</h3>
              <div className="tag-list">
                {owns.processes.map((process) => (
                  <span key={process.id} data-testid={`owned-process-${process.id}`}>
                    {process.name}
                  </span>
                ))}
                {owns.processes.length === 0 ? <span>No process ownership recorded</span> : null}
              </div>
            </div>
            <div className="manual-block">
              <h3>Score composition</h3>
              {breakdown.map((row) => (
                <div className="breakdown-row" key={row.label} data-testid={`breakdown-${row.label.toLowerCase().replaceAll(" ", "-")}`}>
                  <div>
                    <b>{row.label}</b>
                    <small>{row.detail}</small>
                  </div>
                  <span className="mono">+{row.points}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <SectionHeading
              eyebrow="TRANSFERABILITY"
              title="Backup readiness"
              action={<StatusBadge tone={person.trained_backups ? "calm" : "critical"}>{person.trained_backups ? "Partial" : "Needs action"}</StatusBadge>}
            />
            <div className="readiness-number" data-testid="trained-backups-value">
              {person.trained_backups} <small>fully trained backups</small>
            </div>
            <p className="muted">
              The organization is dependent on one person for high-impact workflows. This is a system design
              signal — not a judgment about the person.
            </p>
            {insight ? (
              <div className="insight-block" data-testid="insight-block">
                <span className="eyebrow">
                  <Sparkles size={12} /> DERIVED SUMMARY
                </span>
                {insight.summary.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <EvidenceChip confidence={insight.confidence}>{insight.derivation}</EvidenceChip>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === "knowledge" ? (
        <section className="panel tab-panel" data-testid="manual-tab-knowledge">
          <SectionHeading eyebrow="KNOWLEDGE" title="Knowledge inventory" action={<span className="mono">{person.knowledge_coverage}% documented</span>} />
          {knowledge.map((item) => (
            <div className="list-line" key={item.id} data-testid={`knowledge-item-${item.id}`}>
              <div>
                <b>{item.title}</b>
                <span>{item.domain}</span>
              </div>
              <Bar value={item.coverage_score} tone={item.coverage_score < 50 ? "danger" : ""} />
              <StatusBadge>{item.status}</StatusBadge>
              <span className="mono">{item.coverage_score}%</span>
            </div>
          ))}
          {knowledge.length === 0 ? <EmptyState title="No knowledge recorded" body="Nothing has been captured for this person yet." /> : null}
        </section>
      ) : null}

      {tab === "relationships" ? (
        <section className="panel tab-panel" data-testid="manual-tab-relationships">
          <SectionHeading eyebrow="RELATIONSHIPS" title="Clients, vendors and systems" />
          {[
            ["Clients", owns.clients, (row) => `${row.tier} · ${money(row.annual_revenue)}`],
            ["Vendors", owns.vendors, (row) => row.category],
            ["Systems", owns.systems, (row) => (row.secondary_admin ? `Secondary admin: ${row.secondary_admin}` : "Sole administrator")],
          ].map(([label, rows, describe]) => (
            <div className="manual-block" key={label}>
              <h3>{label}</h3>
              {rows.length === 0 ? <p className="muted">None recorded.</p> : null}
              {rows.map((row) => (
                <div className="list-line" key={row.id} data-testid={`relationship-${row.id}`}>
                  <div>
                    <b>{row.name}</b>
                    <span>{describe(row)}</span>
                  </div>
                  <StatusBadge>{row.criticality}</StatusBadge>
                </div>
              ))}
            </div>
          ))}
        </section>
      ) : null}

      {tab === "processes" ? (
        <section className="panel tab-panel" data-testid="manual-tab-processes">
          <SectionHeading eyebrow="PROCESSES" title="Ownership and continuity" />
          {owns.processes.map((process) => (
            <div className="list-line" key={process.id} data-testid={`process-line-${process.id}`}>
              <div>
                <b>{process.name}</b>
                <span>{process.backup_owner ? `Backup: ${process.backup_owner}` : "No validated backup owner"}</span>
              </div>
              <StatusBadge>{process.criticality}</StatusBadge>
              <StatusBadge>{process.documentation_status}</StatusBadge>
            </div>
          ))}
          {data.backs_up.length > 0 ? (
            <div className="manual-block">
              <h3>Backs up for others</h3>
              {data.backs_up.map((process) => (
                <div className="list-line" key={process.id}>
                  <div>
                    <b>{process.name}</b>
                    <span>Secondary owner</span>
                  </div>
                  <StatusBadge>{process.criticality}</StatusBadge>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "gaps" ? (
        <section className="panel tab-panel" data-testid="manual-tab-gaps">
          <SectionHeading eyebrow="GAPS" title="Failure modes to close" action={<span className="mono">{gaps.length} gaps</span>} />
          {findings.map((finding, index) => (
            <div className="finding" key={finding.id} data-testid={`finding-${finding.id}`}>
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
          {actions.length > 0 ? (
            <div className="manual-block">
              <h3>Linked recovery actions</h3>
              {actions.map((action) => (
                <div className="list-line" key={action.id} data-testid={`linked-action-${action.id}`}>
                  <div>
                    <b>{action.title}</b>
                    <span>{action.type}</span>
                  </div>
                  <StatusBadge>{action.priority}</StatusBadge>
                  <span className="mono">+{action.org_uplift} score</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "evidence" ? (
        <section className="panel tab-panel" data-testid="manual-tab-evidence">
          <SectionHeading eyebrow="EVIDENCE" title="Every claim, traced to a record" />
          {evidence.map((row) => (
            <div className="list-line" key={row.label} data-testid={`evidence-row-${row.label.toLowerCase().replaceAll(" ", "-").replaceAll("%", "")}`}>
              <div>
                <b>{row.label}</b>
                <span>{row.source}</span>
              </div>
              <EvidenceChip confidence={row.confidence}>confidence</EvidenceChip>
            </div>
          ))}
          <p className="muted">
            Continuum shows what it can evidence. Anything inferred is labelled, and simulations are
            estimates rather than predictions.
          </p>
        </section>
      ) : null}
    </div>
  );
}
