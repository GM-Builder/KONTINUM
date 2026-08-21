import { FileText, ShieldAlert } from "lucide-react";

const toneFor = (value = "") => {
  const key = String(value).toLowerCase();
  if (["critical", "missing"].includes(key)) return "critical";
  if (["high", "partial", "inferred"].includes(key)) return "high";
  if (["moderate", "medium"].includes(key)) return "medium";
  if (["documented", "completed", "low"].includes(key)) return "calm";
  return "medium";
};

export function StatusBadge({ children, tone, testId }) {
  const resolved = tone || toneFor(children);
  return (
    <span className={`status status-${resolved}`} data-testid={testId || `status-${String(children).toLowerCase().replaceAll(" ", "-")}`}>
      <i />
      {children}
    </span>
  );
}

export function ScoreRing({ score, coverage = 0, size = "md", name = "score" }) {
  const slug = String(name).toLowerCase().replaceAll(" ", "-");
  return (
    <div
      className={`score-ring score-ring-${size}`}
      style={{ "--fill": `${Math.min(100, score) * 3.6}deg` }}
      data-testid={`score-ring-${slug}`}
    >
      <div className="score-ring-inner">
        <strong>{score}</strong>
        <span>{coverage ? `${coverage}% dok` : "/100"}</span>
      </div>
    </div>
  );
}

export function Metric({ label, value, note, tone = "", testId }) {
  const slug = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="metric" data-testid={testId || `metric-${slug}`}>
      <span className="metric-label">{label}</span>
      <strong className={`metric-value ${tone}`} data-testid={`metric-value-${slug}`}>
        {value}
      </strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export function EvidenceChip({ children, confidence = 0.9, testId }) {
  return (
    <span className="evidence-chip" data-testid={testId || "evidence-chip"}>
      <FileText size={12} />
      {children}
      <b>{Math.round(Number(confidence) * 100)}%</b>
    </span>
  );
}

export function Bar({ value, tone = "" }) {
  return (
    <div className={`bar ${tone}`}>
      <i style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = "Memetakan ketergantungan organisasi…" }) {
  return (
    <div className="loading-state" data-testid="loading-state">
      <span className="loading-mark">K</span>
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state" data-testid="error-state">
      <ShieldAlert size={18} />
      <p>{message}</p>
      {onRetry ? (
        <button className="secondary-button" onClick={onRetry} data-testid="retry-button">
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, body, testId = "empty-state" }) {
  return (
    <div className="empty-state" data-testid={testId}>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
