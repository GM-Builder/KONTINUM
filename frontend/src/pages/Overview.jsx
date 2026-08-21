import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowRight, ChevronRight, ShieldAlert } from "lucide-react";
import { api, messageFor, money } from "@/api";
import {
  Bar, ErrorState, EvidenceChip, LoadingState, Metric, ScoreRing, SectionHeading, StatusBadge,
} from "@/components/primitives";

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = () => {
    setError("");
    api
      .get("/overview")
      .then((response) => setData(response.data))
      .catch((err) => setError(messageFor(err)));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState />;

  const { score, metrics, top_dependencies: people, critical_knowledge: knowledge, trend } = data;

  return (
    <div className="page" data-testid="overview-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">RINGKASAN ORGANISASI</span>
          <h1>Ketahanan yang terlihat jelas.</h1>
          <p>Lihat di mana pengetahuan menumpuk — dan apa yang perlu diperkuat lebih dulu.</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => navigate("/people/sarah-mitchell")}
          data-testid="explore-critical-dependencies-button"
        >
          Telusuri ketergantungan teratas <ArrowRight size={16} />
        </button>
      </div>

      <section className="hero-score" data-testid="resilience-score-panel">
        <div className="hero-score-copy">
          <span className="eyebrow">RESILIENCE SCORE SAAT INI</span>
          <div className="hero-number" data-testid="resilience-score-value">
            {score.current_score} <small>/ 100</small>
          </div>
          <StatusBadge tone="critical" testId="critical-dependency-badge">
            {metrics.critical_people} ketergantungan manusia kritis terdeteksi
          </StatusBadge>
          <p className="muted">
            Dihitung dari dokumentasi pengetahuan, kepemilikan backup, dokumentasi proses, dan
            ketahanan akses — bukan dari data kinerja siapa pun.
          </p>
          <div className="dimension-list" data-testid="score-dimensions">
            {score.dimensions.map((dimension) => (
              <div key={dimension.label} className="dimension-row">
                <span>{dimension.label}</span>
                <Bar value={dimension.value} tone={dimension.value < 55 ? "warn" : ""} />
                <b>{dimension.value}%</b>
                <small>×{dimension.weight}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="trend-chart">
          <span className="chart-label">
            LINTASAN SKOR <b>MODEL DETERMINISTIK</b>
          </span>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={trend}>
              <XAxis dataKey="label" hide />
              <Tooltip
                contentStyle={{ background: "#202b32", border: "1px solid #34434a", color: "#f2f5f3" }}
              />
              <Area type="monotone" dataKey="value" stroke="#d7f36b" fill="#d7f36b" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="chart-foot">
            <span>
              BASELINE <b>{score.baseline_score}</b>
            </span>
            <span>
              TARGET <b className="green">{score.target_score}</b>
            </span>
          </div>
        </div>
      </section>

      <div className="metric-grid">
        <Metric label="Orang kritis" value={metrics.critical_people} note="Tier High atau Critical" tone="danger-text" />
        <Metric label="Cakupan pengetahuan kritis" value={`${metrics.critical_knowledge_coverage}%`} note="Untuk item kritis & tinggi" />
        <Metric label="Proses tanpa backup" value={metrics.processes_without_backup} note="Dari 18 proses terpetakan" tone="warning-text" />
        <Metric label="Pendapatan terekspos" value={money(metrics.revenue_at_risk)} note="Dipegang ketergantungan kritis" />
      </div>

      <div className="overview-grid">
        <section className="panel">
          <SectionHeading
            eyebrow="FOKUS DULU DI SINI"
            title="Ketergantungan kritis"
            action={
              <button className="text-button" onClick={() => navigate("/people")} data-testid="view-all-people-button">
                Lihat semua orang <ArrowRight size={14} />
              </button>
            }
          />
          <div className="people-list">
            {people.map((person) => (
              <button
                className="person-row"
                key={person.id}
                onClick={() => navigate(`/people/${person.id}`)}
                data-testid={`critical-person-${person.id}-button`}
              >
                <ScoreRing score={person.dependency_score} coverage={person.knowledge_coverage} size="sm" name={person.name} />
                <div className="person-info">
                  <b>{person.name}</b>
                  <span>{person.role}</span>
                  <small>
                    {person.critical_process_count} proses kritis tanpa backup <i /> {person.client_count} klien <i />{" "}
                    {person.knowledge_gap_count} celah pengetahuan
                  </small>
                </div>
                <StatusBadge testId={`tier-${person.id}`}>{person.tier}</StatusBadge>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionHeading
            eyebrow="LAPISAN BUKTI"
            title="Pengetahuan kritis terlemah"
            action={<span className="mono">rata-rata {metrics.critical_knowledge_coverage}%</span>}
          />
          <p className="muted">Pengetahuan kritis yang sudah terdokumentasi, tervalidasi, dan bisa dialihkan.</p>
          {knowledge.map((item) => (
            <div className="coverage-row" key={item.id} data-testid={`knowledge-coverage-${item.id}`}>
              <div>
                <b>{item.title}</b>
                <span>{item.domain}</span>
              </div>
              <Bar value={item.coverage_score} tone={item.coverage_score < 50 ? "danger" : "warn"} />
              <strong>{item.coverage_score}%</strong>
            </div>
          ))}
          <div className="evidence-callout">
            <ShieldAlert size={16} />
            <span>
              <b>Bukti dulu, kesimpulan kemudian.</b> Cakupan rendah adalah sinyal untuk divalidasi,
              bukan penilaian atas seseorang.
            </span>
          </div>
          <EvidenceChip confidence={0.94}>penilaian cakupan pengetahuan · {knowledge.length} rujukan</EvidenceChip>
        </section>
      </div>
    </div>
  );
}
