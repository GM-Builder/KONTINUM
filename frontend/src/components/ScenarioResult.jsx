import { ArrowRight, Check } from "lucide-react";
import { money } from "@/api";
import { EvidenceChip, Metric, SectionHeading, StatusBadge } from "@/components/primitives";

export function ScoreJourney({ result }) {
  return (
    <section className="score-journey panel" data-testid="score-journey">
      <SectionHeading
        eyebrow="PERJALANAN KETAHANAN"
        title="Dari eksposur ke tindakan"
        action={<span className="mono">KEYAKINAN {Math.round(result.confidence * 100)}%</span>}
      />
      <div className="journey-values">
        <div data-testid="journey-baseline">
          <span>BASELINE</span>
          <strong>{result.baseline_score}</strong>
        </div>
        <ArrowRight size={18} />
        <div className="exposed" data-testid="journey-absence">
          <span>SAAT TIDAK ADA</span>
          <strong>{result.simulated_score}</strong>
        </div>
        <ArrowRight size={18} />
        <div className="improved" data-testid="journey-mitigated">
          <span>SETELAH MITIGASI</span>
          <strong>{result.mitigated_score}</strong>
        </div>
      </div>
      <p className="journey-note">
        Penurunan {result.score_drop} poin terpusat pada kelangsungan proses dan kepemilikan backup.
        Menyelesaikan rencana pemulihan mengangkat skenario ini ke {result.mitigated_score} dari 100.
      </p>
    </section>
  );
}

export function ScenarioResult({ result, onOpenActions }) {
  const names = result.people.map((person) => person.name).join(" & ");
  return (
    <div className="result-view" data-testid="simulation-result-view">
      <section className="result-head panel">
        <div>
          <span className="eyebrow">SIMULASI KETIDAKHADIRAN {result.duration_label.toUpperCase()}</span>
          <h2>
            {names} tidak tersedia selama {result.duration_label.toLowerCase()}
          </h2>
          <p>Estimasi dampak organisasi berdasarkan ketergantungan yang tercatat hari ini.</p>
        </div>
        <div className="confidence">
          <span>KEYAKINAN SIMULASI</span>
          <strong>{Math.round(result.confidence * 100)}%</strong>
          <small>estimasi · berbasis bukti</small>
        </div>
      </section>

      <div className="metric-grid result-metrics">
        <Metric label="Proses terdampak" value={result.counts.processes} note="Langsung dan turunan" tone="danger-text" testId="metric-processes-affected" />
        <Metric label="Klien berisiko" value={result.counts.clients} note={money(result.revenue_at_risk)} tone="warning-text" testId="metric-clients-at-risk" />
        <Metric label="Celah pengetahuan" value={result.counts.knowledge_gaps} note="Cakupan di bawah 70%" testId="metric-knowledge-gaps" />
        <Metric label="Temuan kritis" value={result.counts.critical_findings} note="Perlu ditinjau" tone="danger-text" testId="metric-critical-findings" />
      </div>

      <ScoreJourney result={result} />

      <div className="result-grid">
        <section className="panel findings">
          <SectionHeading eyebrow="DAMPAK BERANTAI" title="Apa yang berubah di hilir" />
          {result.findings.map((finding, index) => (
            <div className="finding" key={finding.id} data-testid={`simulation-finding-${finding.id}`}>
              <span className="finding-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <div className="action-tags">
                  <StatusBadge>{finding.severity}</StatusBadge>
                  {result.people.length > 1 ? <span className="effort">{finding.person_name}</span> : null}
                </div>
                <h3>{finding.title}</h3>
                <p>{finding.explanation}</p>
                <EvidenceChip confidence={finding.confidence}>
                  {finding.evidence} · {finding.references} rujukan
                </EvidenceChip>
              </div>
            </div>
          ))}
          <div className="manual-block">
            <h3>Proses terdampak</h3>
            {result.affected_processes.map((process) => (
              <div className="list-line" key={process.id} data-testid={`affected-process-${process.id}`}>
                <div>
                  <b>{process.name}</b>
                  <span>{process.reason}</span>
                </div>
                <StatusBadge tone={process.impact === "Langsung" ? "critical" : "medium"}>{process.impact}</StatusBadge>
                <StatusBadge>{process.criticality}</StatusBadge>
              </div>
            ))}
          </div>
          <div className="manual-block">
            <h3>Klien berisiko</h3>
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
            <span className="eyebrow">ASUMSI</span>
            {result.assumptions.map((assumption) => (
              <p key={assumption}>
                <Check size={14} /> {assumption}
              </p>
            ))}
          </div>
        </section>

        <section className="panel recovery">
          <SectionHeading eyebrow="ACTION CENTER" title="Rencana pemulihan yang disarankan" />
          {result.recovery_plan.map((action) => (
            <div className="action-preview" key={action.id} data-testid={`recovery-action-${action.id}`}>
              <span className="action-icon">
                <Check size={14} />
              </span>
              <div>
                <b>{action.title}</b>
                <small>
                  {action.type} · usaha {action.effort} · PIC {action.owner}
                </small>
              </div>
              <strong>+{action.scenario_reduction}</strong>
            </div>
          ))}
          {result.recovery_plan.length === 0 ? (
            <p className="muted">Belum ada aksi pemulihan untuk orang ini.</p>
          ) : null}
          {onOpenActions ? (
            <button className="primary-button full-button" onClick={onOpenActions} data-testid="open-action-center-button">
              Buka Action Center <ArrowRight size={15} />
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
