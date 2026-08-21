import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Mic, Sparkles } from "lucide-react";
import { api, messageFor, money } from "@/api";
import {
  Bar, EmptyState, ErrorState, EvidenceChip, LoadingState, ScoreRing, SectionHeading, StatusBadge,
} from "@/components/primitives";
import { AskPanel } from "@/components/AskPanel";
import { KnowledgeInterview } from "@/components/KnowledgeInterview";

const TABS = [
  ["overview", "Ringkasan"],
  ["knowledge", "Pengetahuan"],
  ["relationships", "Relasi"],
  ["processes", "Proses"],
  ["gaps", "Celah"],
  ["evidence", "Bukti"],
];

export default function HumanManual() {
  const { personId } = useParams();
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [insight, setInsight] = useState(null);
  const [error, setError] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [interviewId, setInterviewId] = useState("");
  const navigate = useNavigate();

  const load = () => {
    api
      .get(`/people/${personId}`)
      .then((response) => setData(response.data))
      .catch((err) => setError(messageFor(err)));
  };

  useEffect(() => {
    setData(null);
    setError("");
    setTab("overview");
    load();
    api
      .get(`/insights/${personId}`)
      .then((response) => setInsight(response.data))
      .catch(() => setInsight(null));
  }, [personId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState message={error} onRetry={() => navigate("/people")} />;
  if (!data) return <LoadingState label="Menyusun Human Manual…" />;

  const { person, owns, knowledge, knowledge_gaps: gaps, findings, evidence, score_breakdown: breakdown, actions } = data;
  const firstName = person.name.split(" ")[0];

  return (
    <div className="page" data-testid="human-manual-page">
      <button className="back-button" onClick={() => navigate(`/map?focus=${person.id}`)} data-testid="human-manual-back-button">
        <ArrowLeft size={14} /> Dependency Map
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
              <span className="mono">MASA KERJA {person.tenure}</span>
              <span className="mono">ATASAN {person.manager}</span>
              <span className="mono">{money(person.revenue_at_risk)} PENDAPATAN DIPEGANG</span>
            </div>
          </div>
        </div>
        <div className="manual-cta">
          <span className="eyebrow">RISIKO KETERGANTUNGAN</span>
          <strong data-testid="manual-dependency-score">
            {person.dependency_score}
            <small>/100</small>
          </strong>
          <button
            className="primary-button"
            onClick={() => navigate(`/simulate/${person.id}`)}
            data-testid="human-manual-simulate-button"
          >
            Simulasikan ketidakhadiran <ArrowRight size={15} />
          </button>
          <button className="secondary-button" onClick={() => setAskOpen(true)} data-testid="manual-ask-button">
            <Sparkles size={15} /> Apa saja yang bergantung pada {firstName}?
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            data-testid={`human-manual-tab-${id}-button`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="manual-grid" data-testid="manual-tab-overview">
          <section className="panel">
            <SectionHeading eyebrow="PENGETAHUAN OPERASIONAL" title={`Apa yang dipikul ${firstName}`} />
            <div className="manual-block">
              <h3>Proses yang dimiliki</h3>
              <div className="tag-list">
                {owns.processes.map((process) => (
                  <span key={process.id} data-testid={`owned-process-${process.id}`}>
                    {process.name}
                  </span>
                ))}
                {owns.processes.length === 0 ? <span>Belum ada kepemilikan proses</span> : null}
              </div>
            </div>
            <div className="manual-block">
              <h3>Komposisi skor</h3>
              {breakdown.map((row) => (
                <div className="breakdown-row" key={row.label}>
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
              eyebrow="KETERALIHAN"
              title="Kesiapan backup"
              action={<StatusBadge tone={person.trained_backups ? "calm" : "critical"}>{person.trained_backups ? "Sebagian" : "Perlu tindakan"}</StatusBadge>}
            />
            <div className="readiness-number" data-testid="trained-backups-value">
              {person.trained_backups} <small>backup terlatih penuh</small>
            </div>
            <p className="muted">
              Organisasi bergantung pada satu orang untuk alur kerja berdampak tinggi. Ini sinyal
              desain sistem — bukan penilaian atas orangnya.
            </p>
            {insight ? (
              <div className="insight-block" data-testid="insight-block">
                <span className="eyebrow">
                  <Sparkles size={12} /> RINGKASAN TURUNAN
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
          <SectionHeading
            eyebrow="PENGETAHUAN"
            title="Inventaris pengetahuan"
            action={<span className="mono">{person.knowledge_coverage}% terdokumentasi</span>}
          />
          <p className="muted">
            Rekam sesi wawancara singkat untuk menaikkan cakupan dokumentasi dan menghitung ulang skor.
          </p>
          {knowledge.map((item) => (
            <div className="list-line" key={item.id} data-testid={`knowledge-item-${item.id}`}>
              <div>
                <b>{item.title}</b>
                <span>{item.domain}</span>
              </div>
              <Bar value={item.coverage_score} tone={item.coverage_score < 50 ? "danger" : ""} />
              <StatusBadge>{item.status}</StatusBadge>
              <span className="mono">{item.coverage_score}%</span>
              <button
                className="secondary-button small-button"
                onClick={() => setInterviewId(item.id)}
                data-testid={`capture-knowledge-${item.id}-button`}
              >
                <Mic size={13} /> Rekam
              </button>
            </div>
          ))}
          {knowledge.length === 0 ? <EmptyState title="Belum ada pengetahuan tercatat" body="Belum ada yang direkam untuk orang ini." /> : null}
        </section>
      ) : null}

      {tab === "relationships" ? (
        <section className="panel tab-panel" data-testid="manual-tab-relationships">
          <SectionHeading eyebrow="RELASI" title="Klien, vendor, dan sistem" />
          {[
            ["Klien", owns.clients, (row) => `${row.tier} · ${money(row.annual_revenue)}`],
            ["Vendor", owns.vendors, (row) => row.category],
            ["Sistem", owns.systems, (row) => (row.secondary_admin ? `Admin kedua: ${row.secondary_admin}` : "Administrator tunggal")],
          ].map(([label, rows, describe]) => (
            <div className="manual-block" key={label}>
              <h3>{label}</h3>
              {rows.length === 0 ? <p className="muted">Tidak ada catatan.</p> : null}
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
          <SectionHeading eyebrow="PROSES" title="Kepemilikan dan kelangsungan" />
          {owns.processes.map((process) => (
            <div className="list-line" key={process.id} data-testid={`process-line-${process.id}`}>
              <div>
                <b>{process.name}</b>
                <span>{process.backup_owner ? `Backup: ${process.backup_owner}` : "Belum ada backup owner tervalidasi"}</span>
              </div>
              <StatusBadge>{process.criticality}</StatusBadge>
              <StatusBadge>{process.documentation_status}</StatusBadge>
            </div>
          ))}
          {data.backs_up.length > 0 ? (
            <div className="manual-block">
              <h3>Menjadi backup untuk orang lain</h3>
              {data.backs_up.map((process) => (
                <div className="list-line" key={process.id}>
                  <div>
                    <b>{process.name}</b>
                    <span>Pemilik kedua</span>
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
          <SectionHeading eyebrow="CELAH" title="Mode kegagalan yang perlu ditutup" action={<span className="mono">{gaps.length} celah</span>} />
          {findings.map((finding, index) => (
            <div className="finding" key={finding.id} data-testid={`finding-${finding.id}`}>
              <span className="finding-number">0{index + 1}</span>
              <div>
                <StatusBadge>{finding.severity}</StatusBadge>
                <h3>{finding.title}</h3>
                <p>{finding.explanation}</p>
                <EvidenceChip confidence={finding.confidence}>
                  {finding.evidence} · {finding.references} rujukan
                </EvidenceChip>
              </div>
            </div>
          ))}
          {actions.length > 0 ? (
            <div className="manual-block">
              <h3>Aksi pemulihan terkait</h3>
              {actions.map((action) => (
                <div className="list-line" key={action.id} data-testid={`linked-action-${action.id}`}>
                  <div>
                    <b>{action.title}</b>
                    <span>{action.type}</span>
                  </div>
                  <StatusBadge>{action.priority}</StatusBadge>
                  <span className="mono">+{action.org_uplift} skor</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "evidence" ? (
        <section className="panel tab-panel" data-testid="manual-tab-evidence">
          <SectionHeading eyebrow="BUKTI" title="Setiap klaim punya jejak catatan" />
          {evidence.map((row) => (
            <div className="list-line" key={row.label}>
              <div>
                <b>{row.label}</b>
                <span>{row.source}</span>
              </div>
              <EvidenceChip confidence={row.confidence}>keyakinan</EvidenceChip>
            </div>
          ))}
          <p className="muted">
            KONTINŪM hanya menampilkan yang bisa dibuktikan. Apa pun yang disimpulkan diberi label,
            dan simulasi selalu disebut estimasi, bukan prediksi.
          </p>
        </section>
      ) : null}

      <AskPanel
        open={askOpen}
        onClose={() => setAskOpen(false)}
        initialQuestion={`Apa saja yang bergantung pada ${person.name}?`}
      />
      {interviewId ? (
        <KnowledgeInterview
          knowledgeId={interviewId}
          onClose={() => setInterviewId("")}
          onCaptured={() => load()}
        />
      ) : null}
    </div>
  );
}
